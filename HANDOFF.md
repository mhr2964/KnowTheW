# HANDOFF — KnowTheW

Forward-looking handoff for the active work-stream. **Overwrite** each session; history lives in git. Durable architecture/design rules live in `docs/design/` (see `docs/design/design.md`), not here — this file is transient work-stream state only.

```yaml
last-model: claude-sonnet-5
last-session: 2026-08-16 (Auth system built, critic-reviewed across 2 rounds, 201 passing tests, lint clean, client build clean; committed in 5 commits; verified locally via curl + full Playwright click-through, then deployed to production and re-verified live via Playwright)
state: green — live on https://knowthew.net (Heroku release v221, deploy c7688ac). JWT_SECRET set in Heroku config (v220). Full signup/login/team-rep/logout flow verified in production via Playwright; throwaway test account deleted afterward.
```

## Next action

Nothing blocking. Optional follow-up: a real manual (human) click-through on knowthew.net, since all automated verification so far has been via Playwright/curl.

**What's verified (2026-08-16):**
- **Local, via curl** against `NODE_ENV=production node server/index.js`: signup sets cookie, `/me` reflects it, team-rep PUT persists across logout+re-login, a legacy/defunct team id 400s, wrong password gets the generic 401, logout's `Set-Cookie` actually expires the cookie.
- **Local, via Playwright** (dev mode, `localhost:3051`): full click-through — signup → `/account` redirect, team-rep dropdown shows only the 15 active franchises, selection persists across logout+re-login, duplicate signup shows "username already taken", wrong password shows the generic invalid-credentials error, header toggles between "Log in" and username correctly.
- **Production, via Playwright** (`https://knowthew.net`, after push + deploy): same full click-through repeated live — signup, team-rep set (New York Liberty) persisted across logout+re-login, dropdown correctly active-teams-only. Test accounts (`playwrighttest` locally, `prodsmoketest` in prod) both deleted from the shared Mongo cluster afterward.

**Unrelated environment note, not a bug:** `npm run dev` + `npm run client` (Vite dev server) renders a blank page in this machine's Chrome — some installed extension blocks any request whose URL contains the literal string "analytics" (`client/src/lib/analytics.js`, a static import in `main.jsx`), which aborts the whole module graph in dev mode only. Doesn't reproduce against the production build (bundled/hashed filenames) or in real users' browsers unless they have the same specific blocklist rule. Pre-existing file, unrelated to this session's changes — not something to fix here.

## Traps

- **New `server/lib/auth.js` conventions:** Auth helpers (`signToken`, `cookieOptions`, `requireAuth`) follow the same fail-closed-on-missing-secret pattern as `server/lib/adminAuth.js`. When adding new protected routes, use `requireAuth` as middleware (see `server/routes/users.js` for the pattern) rather than checking a header/cookie inline.
- **Shared numeric-id validation:** Both `server/lib/routeValidation.js` (team-rep body validation in users.js) and `client/src/pages/AccountPage.jsx` (team dropdown filtering) use `NUMERIC_ID_RE` (regex: `^\d+$`) to check ESPN team IDs. The regex is duplicated across client and server because there's no shared validation module — this is an accepted drift risk per the critic's nit. Both are gated behind an active-team lookup, so the risk is low. If you add a third use of this pattern (e.g., a new endpoint accepting team IDs), consider extracting to a shared constant or document the duplication explicitly.
- **Team-rep scope:** The backend whitelist in `server/routes/users.js` (team ID validation) and the client dropdown in `AccountPage.jsx` (active-franchise-only list) must stay in sync. If a new team joins the WNBA (or a franchise relocates), both files need updates. The `findTeam()` helper in `server/lib/teamLookup.js` (backed by `server/providers/espn/client.js`'s `fetchTeams()`) is the source of truth for active teams.
- **Existing route structure:** After the 2026-08-04 `server/routes/api.js` refactor, auth routes live in their own `server/routes/auth.js` (signup/login/logout/me) and `server/routes/users.js` (team-rep PUT/DELETE, requires `requireAuth`). Don't add new auth endpoints to `meta.js` or another generic bucket — keep auth grouped in `auth.js` or `users.js` or create a new focused route file.
- The `api.js` God-Module refactor, Compare-page breakpoints, and BrefTable export pattern remain do-not-touch zones (see traps from prior handoff + `docs/design/mobile-refresh.md`).

## Do not touch

- Nothing mid-edit as of this handoff.

## Recent context

- 2026-08-16: Username/password account system (signup/login/logout/me + team-rep PUT/DELETE) built via the agent-team pipeline, verified with 201 passing tests, lint clean, client build clean. Critic review round 1 and round 2 found and fixed: Heroku rate-limiter bucketing on dyno IP (fixed via `app.set('trust proxy', 1)`), signup race condition (JWT signed before insert), unawaited unique index on username (now awaited), defunct franchises in dropdown (now filtered client-side). Design doc (`docs/design/accounts.md`), CHANGELOG entry, and design.md index update all complete. Committed in 5 commits, `JWT_SECRET` set in Heroku config, pushed to `origin/master` (deploy c7688ac, release v221), and re-verified live in production via Playwright.
- 2026-08-04: `server/routes/api.js` God-Module refactor complete (split into teams/players/playerAnalysis/reports/meta). Pushed to origin/master.
- Live at `https://knowthew.net`; production Heroku auto-deploys on every push to `origin/master` (GitHub integration, not visible in the repo's own CI config).
