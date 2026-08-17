# HANDOFF — KnowTheW

Forward-looking handoff for the active work-stream. **Overwrite** each session; history lives in git. Durable architecture/design rules live in `docs/design/` (see `docs/design/design.md`), not here — this file is transient work-stream state only.

```yaml
last-model: claude-haiku-4-5-20251001
last-session: 2026-08-16 (Pre-game notification bell built across backend-dev ‖ frontend-dev → critic (2 rounds) → test-engineer (2 rounds); all pipeline tests passing, lint clean, client build clean; uncommitted in master branch)
state: ready-for-review — feature fully implemented and tested; NOT yet committed/pushed/deployed; Heroku Scheduler provisioning is a fully manual pending step after deploy
```

## Next action

**User decision required.** All changes are currently uncommitted in the working tree (master branch).

1. **Commit + push** (will auto-deploy via Heroku GitHub integration): Pending explicit user approval to commit and push to `origin/master`. Push will trigger automatic Heroku production deploy. After deploy, production will be live but notifications will NOT run until Scheduler is provisioned (see step 2).

2. **Heroku Scheduler provisioning** (fully manual, no automation): Even after a successful Heroku deploy, the notification-creation job will never run until manually provisioned. User must run:
   ```
   heroku addons:create scheduler:standard
   heroku config:set SCHEDULER_TOKEN=<random-secret>
   ```
   Then configure a Heroku Scheduler job (via Heroku dashboard) to run every 10 minutes:
   ```
   POST https://knowthew.net/internal/jobs/notifications/poll
   Header: x-scheduler-token: <SCHEDULER_TOKEN>
   ```
   (Use a strong random token, e.g., `openssl rand -hex 32`. The SCHEDULER_TOKEN env var is new and distinct from JWT_SECRET.)

**What's ready to ship:** Feature is code-complete and fully tested via the complete pipeline. No blockers.

## What's been tested

**Local build and tests:**
- 201 tests passing (backend + frontend)
- Lint and typecheck clean
- Client build clean (Vite)

**Testing across the pipeline:**
- **backend-dev:** Server-side notification creation, error handling under failure conditions, MongoDB TTL expiry, `users.teamRepId` indexing for performance
- **frontend-dev:** Bell rendering, polling behavior (pause on hidden tab, resume on focus), team-switch re-sync
- **critic round 1:** Caught critical bug — `insertMany` error handling was miscounting total driver failures as full success. backend-dev fixed.
- **critic round 2:** Re-verified error-handling fix works correctly
- **test-engineer round 1:** Caught 3 UI bugs — bell z-index/overlap with Search button on mobile, dropdown rendering off-screen (left edge, then right edge after incomplete fix), stale notifications after team switch
- **test-engineer round 2:** Re-verified all 3 UI fixes via live re-measurement (viewport hit-testing, network-timing instrumentation)

## Known cosmetic follow-ups (non-blocking, do not hold release)

1. **Notification dropdown flush margin on narrow mobile** — On ≤360px viewports, dropdown has no side margin; renders as a "bar" rather than a floating card. Fix would adjust mobile positioning while adding gutter; not urgent.

2. **Silent "?" on malformed opponent shape** — If ESPN API returns an unexpectedly shaped `opponent` field, dropdown silently renders bare "?" with no console warning, making it undiagnosable. Future pass: add console.warn or fallback label.

## Traps

- **New `SCHEDULER_TOKEN` env var:** The `/internal/jobs/notifications/poll` endpoint checks this via shared-secret model (like admin endpoints). The Heroku Scheduler job must send it in the `x-scheduler-token` header. Missing or mismatched token will 401. Use a strong random string (e.g., `openssl rand -hex 32`); do NOT reuse `JWT_SECRET`.

- **Notification polling pauses on hidden tab:** The client's `useNotifications` hook respects `visibilitychange`, so polling stops when the tab is backgrounded. This is intentional (reduce request volume to match active users) but means users won't see notifications if the tab is hidden during the pregame window; they'll see them on focus. This is acceptable UX.

- **Client refetch on team switch:** When a user changes `teamRepId`, the client immediately calls `refreshNotifications()` to fetch the new team's notifications. If the switch happens between polling intervals, there's a ~60-second grace period where old notifications linger — this was mitigated by the immediate refetch, but if polling interval is widened in a future change, the grace period widens with it.

- **MongoDB TTL index on notifications:** Notifications expire 4 hours after game kickoff via TTL on the `expiresAt` field. If the field name changes or the timestamp format changes without updating the index definition, the index silently stops working and notifications pile up indefinitely.

- **insertMany error semantics:** The job uses `insertMany(docs, { ordered: false })` so one failed doc doesn't block the rest. A total collection error (e.g., Mongo down) returns a driver-level error — the code now checks for this. Partial success (some docs inserted, some failed) doesn't throw but has `writeErrors` in the result — the job logs both cases distinctly.

- **`users.teamRepId` index performance:** This index is critical for avoiding a full collection scan on every poll cycle. Do not drop or rename without benchmarking the poll-time impact.

## Do not touch

- `server/routes/api.js` (God-Module, already refactored as of 2026-08-04; do not add new routes directly to it).
- The `users.teamRepId` index — critical for poll performance.
- The `notifications` TTL index on `expiresAt` — without it, notifications linger indefinitely.

## Recent context

- 2026-08-16: Pre-game notification bell feature completed via full agent-team pipeline (backend-dev ‖ frontend-dev → critic → test-engineer, 2 critic fix rounds and 2 test-engineer fix rounds). Notifications created by internal job (not yet running), expire via TTL, fetched by client on polling interval. Bell icon in header with count badge. All tests passing, lint clean, client build clean. One critical bug caught by critic (insertMany error handling) and fixed by backend-dev. Three UI bugs caught by test-engineer and fixed by frontend-dev. Feature uncommitted; next step is user decision to commit/push/deploy, followed by manual Heroku Scheduler provisioning step.
- 2026-08-16: Username/password account system (signup/login/logout/me + team-rep PUT/DELETE) built and deployed. Critic review caught four security findings (rate-limiter bucketing, signup race condition, unawaited index, defunct franchises in dropdown) — all fixed. Committed in 5 commits, deployed to production (release v221).
