# HANDOFF — KnowTheW

Forward-looking handoff for the active work-stream. **Overwrite** each session; history lives in git. Durable architecture/design rules live in `docs/design/` (see `docs/design/design.md`), not here — this file is transient work-stream state only.

```yaml
last-model: claude-sonnet-5
last-session: 2026-08-16 (Auth system built, critic-reviewed across 2 rounds, 201 passing tests, lint clean, client build clean; committed locally in 3 commits)
state: yellow — committed locally, not yet browser-smoke-tested or pushed; JWT_SECRET is not set anywhere yet (not in local .env, not in Heroku config)
```

## Next action

**Browser-smoke-test locally, then push.**
1. Set a real `JWT_SECRET` in local `.env` (e.g. `openssl rand -hex 32`) — without it every auth endpoint 500s.
2. Manually walk signup → logout → login → set team rep → clear team rep in a real browser against `npm run dev` + `npm run client`. Confirm `ktw_token` shows in DevTools → Application → Cookies as `httpOnly`, `sameSite=lax` (and `secure` once tested against a prod build).
3. Before pushing to `origin/master` (which auto-deploys), set `JWT_SECRET` in Heroku config (`heroku config:set JWT_SECRET=...`) — the deploy will otherwise go live with auth silently 500ing.
4. Post-deploy: signup a throwaway account on https://knowthew.net, confirm the team-rep dropdown only offers active franchises.

The 201 passing tests and two rounds of critic review (live-reproduced probes against a booted instance) cover the logic; this step is specifically about the real-browser cookie mechanics and UI flow, which weren't exercised by either.

## Traps

- **New `server/lib/auth.js` conventions:** Auth helpers (`signToken`, `cookieOptions`, `requireAuth`) follow the same fail-closed-on-missing-secret pattern as `server/lib/adminAuth.js`. When adding new protected routes, use `requireAuth` as middleware (see `server/routes/users.js` for the pattern) rather than checking a header/cookie inline.
- **Shared numeric-id validation:** Both `server/lib/routeValidation.js` (team-rep body validation in users.js) and `client/src/pages/AccountPage.jsx` (team dropdown filtering) use `NUMERIC_ID_RE` (regex: `^\d+$`) to check ESPN team IDs. The regex is duplicated across client and server because there's no shared validation module — this is an accepted drift risk per the critic's nit. Both are gated behind an active-team lookup, so the risk is low. If you add a third use of this pattern (e.g., a new endpoint accepting team IDs), consider extracting to a shared constant or document the duplication explicitly.
- **Team-rep scope:** The backend whitelist in `server/routes/users.js` (team ID validation) and the client dropdown in `AccountPage.jsx` (active-franchise-only list) must stay in sync. If a new team joins the WNBA (or a franchise relocates), both files need updates. The `findTeam()` helper in `server/lib/teamLookup.js` (backed by `server/providers/espn/client.js`'s `fetchTeams()`) is the source of truth for active teams.
- **Existing route structure:** After the 2026-08-04 `server/routes/api.js` refactor, auth routes live in their own `server/routes/auth.js` (signup/login/logout/me) and `server/routes/users.js` (team-rep PUT/DELETE, requires `requireAuth`). Don't add new auth endpoints to `meta.js` or another generic bucket — keep auth grouped in `auth.js` or `users.js` or create a new focused route file.
- The `api.js` God-Module refactor, Compare-page breakpoints, and BrefTable export pattern remain do-not-touch zones (see traps from prior handoff + `docs/design/mobile-refresh.md`).

## Do not touch

- Nothing mid-edit as of this handoff.

## Recent context

- 2026-08-16: Username/password account system (signup/login/logout/me + team-rep PUT/DELETE) built via the agent-team pipeline, verified with 201 passing tests, lint clean, client build clean. Critic review round 1 and round 2 found and fixed: Heroku rate-limiter bucketing on dyno IP (fixed via `app.set('trust proxy', 1)`), signup race condition (JWT signed before insert), unawaited unique index on username (now awaited), defunct franchises in dropdown (now filtered client-side). Design doc (`docs/design/accounts.md`), CHANGELOG entry, and design.md index update all complete. Committed locally in 3 commits (backend, frontend, tests) — not yet pushed; see Next action.
- 2026-08-04: `server/routes/api.js` God-Module refactor complete (split into teams/players/playerAnalysis/reports/meta). Pushed to origin/master.
- Live at `https://knowthew.net`; production Heroku auto-deploys on every push to `origin/master` (GitHub integration, not visible in the repo's own CI config).
