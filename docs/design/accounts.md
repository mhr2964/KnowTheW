# Username/password account system

## Architecture overview

A minimal session-based login and team-rep selection system: username + password signup/login, JWT in an httpOnly cookie for sessions, and a single optional `teamRepId` field per user (numeric ESPN team ID, restricted to active franchises). No email, no password reset, no server-side session store — v1 is deliberately narrow, extensible via the existing patterns.

## JWT in httpOnly cookie vs. server-side sessions

**Decision: JWT in an httpOnly `ktw_token` cookie, no server-side session store.**

Rationale: The app has zero existing session infrastructure (no session middleware, no cache like Redis, no database session collection pattern). A server-side session would require adding a new MongoDB collection + TTL indexes + cleanup logic + a request-time lookup on every protected route. By contrast, the JWT payload is self-contained and cryptographically verified — stateless, cacheable (the cookie's `maxAge` is verifiable client-side), and a natural fit for a Heroku environment where horizontal scaling is trivial and session store contention isn't a concern. The trade-off (signing key rotation is harder, revocation requires a blacklist) is accepted: key rotation can be deferred to v2 or handled via an env-var update + brief re-login window, and logout is implemented by deleting the cookie on the client (the backend doesn't need to track it).

**Why httpOnly:** Prevents JavaScript from reading the token, blocking XSS-based token theft. The `sameSite=lax` attribute mitigates CSRF for state-changing requests (login/logout/team-rep PUT/DELETE). The `secure` flag in production ensures it's only sent over HTTPS.

## JWT_SECRET fail-closed pattern

**Decision: Mirror the existing `ADMIN_TOKEN` pattern from `server/lib/adminAuth.js` — all token-signing and verification throw if `JWT_SECRET` is unset.**

Rationale: A default or empty-string secret would make every previously-issued or forged token trivially valid, and would be silently discovered by an attacker probing historical tokens. Explicitly failing at startup (or at the first sign/verify call, caught and logged by route handlers) is safer: it guarantees the secret was intentionally provisioned before the auth system could be used, and any future breach of the secret is detectable by requiring a re-provision and re-login cycle. `server/index.js` logs the failure with the `SECURITY:` prefix, matching `adminAuth.js`'s convention, so the missing var is visible in Heroku logs and dashboards without leaking to HTTP responses.

## Bcryptjs over native bcrypt

**Decision: Use the pure-JavaScript `bcryptjs` library, not the C++-based `bcrypt` npm package.**

Rationale: Heroku's build environment is minimal — native-module builds can fail silently or require `build-essential` / Python / node-gyp configuration. `bcryptjs` is slower (no native speedup) but avoids the build complexity entirely. For a web app at this traffic level (WNBA stats, not a high-throughput login service), the 10–20% performance cost is negligible. The cost parameter is set to 12 (default for bcryptjs), matching industry guidance for 2026 (adaptive: higher costs as hardware speeds up, but 12 is safe against brute-force for the next few years without making signup/login noticeably slow).

## Extensibility: email field (v2+)

The MongoDB `users` collection schema is schemaless; adding an `email` field later requires zero migration. Current `users.js` (team-rep PUT/DELETE) doesn't assume `email` is missing — if a future version adds it, the existing routes continue working. Password-reset, email verification, and OAuth are documented as future work, not omitted silently.

## CORS: credentials deliberately omitted

**Decision: `cors()` with an explicit origin allowlist, no `credentials: true`.**

Rationale: The app is same-origin in both dev and production. In dev, Vite's `/api` proxy routes all `/api/*` requests to the backend without leaving the browser's origin. In production, a single Heroku dyno serves both the static React client and the Express backend on the same domain (`knowthew.net`). All auth endpoints (`POST /auth/signup`, `POST /auth/login`, `DELETE /auth/logout`, `GET /auth/me`, `PUT /users/:id/team-rep`) are same-origin; they don't need CORS at all. The `X-Admin-Token` header for admin-gated endpoints is also same-origin-only.

Adding `credentials: true` without an explicit allowlist would fall back to a bare `cors()` (reflected `Origin`), which is overly permissive. With an explicit allowlist (see `server/index.js`), CORS is safely restricted to `https://knowthew.net` and `https://www.knowthew.net` only, an abuse of CORS (third-party script loading tokens from a cross-origin iframe) is impossible. This is not a security boundary — CORS is browser-enforced, not server-enforced — but it keeps the config tighter than necessary and matches the principle of least privilege.

## Team rep scope: active franchises only

**Decision: `teamRepId` is restricted to currently-active ESPN team IDs; defunct franchises (Cleveland Rockers, Houston Comets, etc.) are rejected on signup/update.**

Rationale: The team-rep field is used on the home page to highlight a user's preferred team and power the future "my team's next game" widget. Defunct franchises have no upcoming games and no current roster. Allowing them to be selected creates a misleading UX ("my team" points to a team that hasn't existed for 20+ years). The frontend filtering in `AccountPage.jsx` and the backend validation in `server/routes/users.js` both cross-reference a shared numeric-id predicate (`NUMERIC_ID_RE` in `server/lib/routeValidation.js`, client-side redefined in `AccountPage.jsx` to avoid a cross-module dep). Known drift: the regex is duplicated on both client and server due to lack of a shared validation module; both check `^\d+$`, and both are gated behind an active-team lookup, so the risk is low and acknowledged in the critic's nit (see "Known issues found and fixed during review" section).

## Known issues found and fixed during review

The auth system went through two critic-review cycles; these findings were caught and fixed:

1. **Heroku rate-limiting regression (Round 1)** — `express-rate-limit` was configured with `skip: (req) => !req.ip`, relying on `req.ip` to partition buckets per-user. On Heroku, `req.ip` is always the dyno's outbound IP (the Heroku router's IP, since the app doesn't know the real client IP) unless `app.set('trust proxy', 1)` is configured. Without it, every login attempt — from every user — increments a single global bucket, causing the 100-request-per-minute limit to apply site-wide instead of per-IP. A single user with a typo could lock out the entire site. Fixed by adding `app.set('trust proxy', 1)` before mounting the rate limiter in `server/index.js`.

2. **Signup race condition (Round 1)** — The signup route inserted a new user document into MongoDB *before* signing the JWT. If JWT signing failed (e.g., `JWT_SECRET` unset), the user was already in the database, and a retry would fail with a duplicate-username error rather than revealing the underlying JWT failure. Worse: an attacker could register a username, disconnect mid-response, and cause the signup handler to orphan the username (squatting it permanently). Fixed by signing the JWT *before* inserting the user, so failures are atomic.

3. **Unawaited unique index (Round 1)** — `server/db.js` created a unique index on `users.username` in a fire-and-forget callback without awaiting. If the index creation failed (e.g., duplicate-key corruption on an earlier run), the app would start successfully but the unique constraint would never be enforced, allowing duplicate usernames to be inserted. Fixed by awaiting the index creation as part of the connection/setup promise chain, so the app logs a `SECURITY:` error and refuses to start if the index fails.

4. **Defunct franchise options in the signup dropdown (Round 2)** — The frontend's team-rep dropdown on `AccountPage.jsx` was seeded with all ESPN team IDs (1–30+), including defunct franchises. The backend correctly rejected them with 400, but users could see and click options the backend wouldn't accept. Fixed by filtering the dropdown client-side to active/numeric-id franchises only, matching the backend's allowlist.

All four issues were independently re-verified by the critic in round 2 with zero remaining blocking issues.

## Accepted tradeoffs (deliberate, not gaps)

- **No email field in v1:** The schema is schemaless and extensible; email can be added in v2 without a migration script.
- **No password-reset or email-confirmation flow:** Future work, documented in the prompt as extensibility, not hidden as a surprise.
- **No refresh-token or sliding-session pattern:** The 7-day JWT expiry is a flat deadline; refresh tokens can be added in v2. Users log out and back in if they want to extend an expired session (acceptable for a stats/reference app, not a productivity tool).
- **No server-side logout blacklist:** Deleting the cookie on the client is sufficient for the v1 threat model (no high-security use case like banking). A blacklist (or a short-lived access token + refresh token) is deferred to v2 if needed.
