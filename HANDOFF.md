# HANDOFF — KnowTheW

Forward-looking handoff for the active work-stream. **Overwrite** each session; history lives in git. Durable architecture/design rules live in `docs/design/` (see `docs/design/design.md`), not here — this file is transient work-stream state only.

```yaml
last-model: claude-sonnet-5
last-session: 2026-08-17 (BallDontLie hybrid provider: Phase 1 + Phase 2 built and tested (249/249 suite), shadow-compared clean locally, then flipped live on Heroku (v224) and immediately found a real blocker via Playwright -- a full-career Advanced-stats page load exceeds Heroku's 30s router timeout under BDL's higher per-game request count. Reverted (v226); production is back on ESPN and healthy.)
state: BDL hybrid provider is code-complete and unit-tested, but rollout is BLOCKED on a real timeout issue found in production testing -- do not re-flip STATS_PROVIDER until that's fixed (see Traps and the plan file's "Rollout attempt #1" section)
```

## Next action

**Notification feature: done.** Committed (`d8c36b3`→`02cbb02`), deployed (Heroku v223), Scheduler provisioned and running (`SCHEDULER_TOKEN` set via v222, job polls `/internal/jobs/notifications/poll` every 10 minutes). No pending steps.

**BallDontLie GOAT-tier provider swap: implementation done, rollout BLOCKED.** Full plan (context, decisions, spike findings, both phases, every bug found, and the full rollout-attempt writeup) lives at `C:\Users\Owner\.claude\plans\can-we-plan-out-polished-catmull.md` — read the "Rollout attempt #1" section before touching this again, it's the authoritative reference, not this file. Short version: `server/providers/balldontlie/` is code-complete and shadow-compared clean, but a live Playwright test on the real site (right after flipping `STATS_PROVIDER=balldontlie`) hit a real H12 request timeout loading a long-career player's Advanced tab — BDL needs ~3x ESPN's request count per game, and `/api/players/:id/advanced-pbp-all` computes a player's *entire* career in one request with no per-season granularity, so any sufficiently long BDL-era career risks a cold-cache timeout. **`STATS_PROVIDER` is unset in production right now (reverted, safe, ESPN-sourced).** Do not flip it again without first designing a fix — candidates are listed in the plan file (cache pre-warming, per-season request splitting, reducing BDL's request count). This needs a real design pass, not a quick retry.

See `docs/design/feature-backlog.md` for unscheduled feature ideas (shot charts, injury report, odds/spread on schedule) from the 2026-08-17 BallDontLie brainstorm.

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

- **BDL `/plays` text has no structured player field.** Every attribution in `server/providers/balldontlie/plays.js` is name-matched against free text, which means every new play-text phrasing is a potential silent undercount, not a crash. Confirmed example: blocked shots read `"<blocker> blocks <shooter>'s ..."` with no "makes"/"misses" — `isShotAttempt()` missed these entirely until caught by live cross-checking against real team totals (fixed 2026-08-17). If BDL PBP numbers ever look off, suspect an unhandled phrasing variant before suspecting the substitution/on-court logic (that part was hand-verified correct against a real game).

- **BDL rate-limits under concurrent load; `bdlFetch` now retries but only 3x.** Computing a whole career's advanced stats fires a burst of concurrent per-game requests (found via live shadow-compare: one player-season came back with ~half its games silently missing under this load). `bdlFetch` (`client.js`) retries a 429 with backoff, capped at 3 attempts. If a very long career (many uncached seasons) still comes back visibly wrong, check for a `[balldontlie]` warn in the logs before assuming a data bug — it may just mean the retry budget wasn't enough for that particular burst.

- **`STATS_PROVIDER=balldontlie` is NOT safe to enable yet — do not flip it without reading the plan's "Rollout attempt #1" section first.** `/api/players/:id/advanced-pbp-all` computes a player's whole career in one uncached request; BDL needs ~3 HTTP round trips per game vs ESPN's ~1, so a long career (Wilson: 8 seasons, ~280 games, ~800+ requests) blows through Heroku's 30s router timeout (H12) on the first cold load. Confirmed live on 2026-08-17, reverted same session. Needs a real fix (cache pre-warming and/or per-season request splitting) before the next attempt, not a retry.

## Do not touch

- `server/routes/api.js` (God-Module, already refactored as of 2026-08-04; do not add new routes directly to it).
- The `users.teamRepId` index — critical for poll performance.
- The `notifications` TTL index on `expiresAt` — without it, notifications linger indefinitely.

## Recent context

- 2026-08-17: Flipped `STATS_PROVIDER=balldontlie` live on Heroku (v224) and tested via Playwright — team-stats pages worked, but A'ja Wilson's Advanced tab hit an H12 request timeout (30s) computing her full 8-season career against BDL's higher per-request-count PBP walk. Reverted immediately (`heroku config:unset STATS_PROVIDER`, v226); confirmed the live site is back to fast, correct ESPN-sourced behavior. Full writeup in the plan file's "Rollout attempt #1" section. Rollout stays blocked until this is designed and fixed.
- 2026-08-17: Finished BallDontLie provider verification (task #10): live shadow-compared ESPN vs BDL for A'ja Wilson (2023, 2024) and Kierstan Bell (2023, 2025) — every advanced stat matched within noise. Found and fixed a real robustness bug along the way: a burst of concurrent per-game requests (computing a whole career at once) could get rate-limited, and `bdlFetch` swallowed it identically to any other failure with zero logging/retry — one live computation came back with ~half its games missing and Win Shares null. Added 429 retry-with-backoff + failure logging to `client.js`, re-verified against the exact scenario that exposed it, added `test/balldontlie-client.test.js` (7 tests). Full suite now 249/249. Only the production `STATS_PROVIDER` flip remains — not done without explicit go-ahead.
- 2026-08-17: Built the BallDontLie hybrid provider (Phase 1 team stats + Phase 2 PBP-walking, both season-conditional at 2008+). Mid-build discovered BDL's `/plays` has no structured player-attribution field (ESPN does), requiring name-based text parsing instead of a structural port. Live-testing surfaced and fixed a real bug: blocked shots weren't counted as FGA (see Traps). Added 13 tests (`test/balldontlie-plays.test.js`, `test/balldontlie-eventid-routing.test.js`, a `providers.test.js` contract block) — full suite 231/231. Cache keys across 5 call sites were prefixed with the provider name to make `STATS_PROVIDER` safely toggleable. Not yet flipped on in production; see Next action.
- 2026-08-17: Notification feature's production deploy/Scheduler status confirmed live (was undocumented after the last commit). Brainstormed BallDontLie GOAT-tier feature ideas; logged non-props ideas to `docs/design/feature-backlog.md`. Started viability check on swapping the ESPN-PBP-reconstructed advanced stats (`server/lib/advancedStats.js`) for BallDontLie's GOAT-tier data — findings logged in `docs/design/provider-architecture.md`.
- 2026-08-16: Pre-game notification bell feature completed via full agent-team pipeline (backend-dev ‖ frontend-dev → critic → test-engineer, 2 critic fix rounds and 2 test-engineer fix rounds). Notifications created by internal job (not yet running), expire via TTL, fetched by client on polling interval. Bell icon in header with count badge. All tests passing, lint clean, client build clean. One critical bug caught by critic (insertMany error handling) and fixed by backend-dev. Three UI bugs caught by test-engineer and fixed by frontend-dev. Feature uncommitted; next step is user decision to commit/push/deploy, followed by manual Heroku Scheduler provisioning step.
- 2026-08-16: Username/password account system (signup/login/logout/me + team-rep PUT/DELETE) built and deployed. Critic review caught four security findings (rate-limiter bucketing, signup race condition, unawaited index, defunct franchises in dropdown) — all fixed. Committed in 5 commits, deployed to production (release v221).
