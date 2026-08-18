# HANDOFF — KnowTheW

Forward-looking handoff for the active work-stream. **Overwrite** each session; history lives in git. Durable architecture/design rules live in `docs/design/` (see `docs/design/design.md`), not here — this file is transient work-stream state only.

```yaml
last-model: claude-sonnet-5
last-session: 2026-08-18 (BallDontLie hybrid provider: LIVE IN PRODUCTION. Fixed the H12-timeout blocker from the prior attempt via a cache-warming script, found and fixed 3 more real bugs along the way (dead .env key, two cache-poisoning bugs, a pre-existing provider-agnostic league-averages gap), warmed 200/211 active players, flipped STATS_PROVIDER=balldontlie on Heroku (v230), verified live via Playwright -- confirmed working for both a long-career star and a current-season rookie.)
state: BDL is now the live production stats source for season >= 2008; ESPN still covers everything else (identity/roster/schedule, pre-2008 seasons). Healthy, no open blockers.
```

## Next action

**Notification feature: done.** Committed (`d8c36b3`→`02cbb02`), deployed (Heroku v223), Scheduler provisioned and running (`SCHEDULER_TOKEN` set via v222, job polls `/internal/jobs/notifications/poll` every 10 minutes). Verified against a real WNBA game on 2026-08-17 via the scheduled one-shot check (poll → notification created → correct opponent/gameDate confirmed, test data cleaned up). No pending steps.

**BallDontLie GOAT-tier provider swap: shipped and live.** `STATS_PROVIDER=balldontlie` is set in production (Heroku v230) — team stats, Win Shares, on/off, shooting splits, and the PBP table now source from BDL for season ≥ 2008; ESPN covers identity/roster/schedule always and everything for seasons before 2008. Full history (spikes, both build phases, every bug found, the reverted first rollout attempt, and the fix) lives at `C:\Users\Owner\.claude\plans\can-we-plan-out-polished-catmull.md` if a deep dive is ever needed — this file just tracks current state now.

The original blocker (H12 request timeout on a long career's first cold Advanced-tab load — BDL needs ~3x ESPN's request count per game) is fixed via `scripts/seed-balldontlie-cache.js`, a re-runnable warm pass over the active roster that populates the exact same cache the live route reads. 200 of 211 active players are warmed with real data; the other 11 are a genuine, narrow BDL data gap for very recent international signees (confirmed directly against BDL's raw API — their identity resolves but BDL reports 0 games for them), not a bug — they degrade gracefully (empty result, never cached, self-heals automatically once BDL has their data). Rollback is `heroku config:unset STATS_PROVIDER` — no code change, and was proven to actually work during the reverted first attempt.

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

- **A first-ever (cold, uncached) Advanced-tab load for a long-career player can still be slow.** `computeAdvancedPbpAll` computes a player's whole career in one request; BDL needs ~3 HTTP round trips per game vs ESPN's ~1. `scripts/seed-balldontlie-cache.js` pre-warms the active roster so real traffic almost never hits this cold path, but a retired/historical player who was never on an active roster (or a newly-signed player before the next warm run) still risks a slow first load. Not a timeout risk anymore in practice (Heroku's 30s H12 limit was the failure mode, not the underlying slowness itself), but worth knowing if a specific player's first load feels sluggish. Re-run the seed script after signings/trades to keep the active-roster cache current.

- **`bdlFetch` (`server/providers/balldontlie/client.js`) rate-limits itself to ~500 req/min and retries both 429 and 401.** Found via the warm-run debugging on 2026-08-17/18: a concurrency-only cap doesn't prevent real 429s (throughput, not simultaneity, is the actual constraint against BDL's 600/min GOAT-tier quota), and `/players` specifically showed sustained 401s under real load that no isolated reproduction could explain — retrying 401 alongside 429 is a cheap defensive measure, not a diagnosed root cause for that specific case. If a real request comes back visibly wrong, check for `[balldontlie]` warn logs before assuming a data bug.

- **`resolveBdlPlayerId` (`idMap.js`) must never cache a *failed* BDL search the same way as a genuine zero-match result.** Fixed 2026-08-18 after a dead API key caused 149 of 150 player-identity resolutions to be permanently miscached as "unresolvable" — real, active players falsely marked as having no BDL data forever. `bdlPlayerIdMap` only gets a permanent write now when the search itself actually succeeded (even with zero/ambiguous matches); a fetch failure leaves the slot open for retry. If a player's BDL data mysteriously never appears, check `bdlPlayerIdMap` for `{bdlId: null}` before assuming it's a real data gap — it might be a stale poisoned entry from before this fix (delete the doc to force a re-resolution).

- **`computeAdvancedPbpAll`'s Mongo cache (`advancedStats` collection, keyed `<provider>-<playerId>`) will not permanently cache a fully-empty result if the player had real seasons to compute.** Fixed 2026-08-18 alongside the identity-cache fix above, for the same underlying reason (a systemic failure — bad key, provider outage — must never look identical to "this player genuinely has nothing"). The cache doc's `v` field also self-heals: bumping it forces every player to recompute once, used already for the 26→27 bump that fixed the league-averages gap below. Bump `v` again for any future fix that needs existing cache entries to recompute.

- **`WNBA_LG` (`server/constants/leagueAverages.js`) only covers completed seasons.** The current season's league average is now computed live (`server/lib/currentSeasonLeagueAverage.js`, 4h in-process TTL cache, warmed on server startup) and read through `getLeagueAverage(year)` — **use this accessor, never `WNBA_LG[year]` directly**, in any new code that needs league-average context. `stl`/`blk`/`pf` aren't in the normalized `TeamStats` contract for either provider, so the live average carries those three forward from the most recent completed season rather than fabricating them — expect them to lag slightly behind the season's real trend, which is fine given how little they move year to year for the WNBA.

## Do not touch

- `server/routes/api.js` (God-Module, already refactored as of 2026-08-04; do not add new routes directly to it).
- The `users.teamRepId` index — critical for poll performance.
- The `notifications` TTL index on `expiresAt` — without it, notifications linger indefinitely.

## Recent context

- 2026-08-18: Fixed the BDL rollout's H12 timeout blocker and shipped it live. Built `scripts/seed-balldontlie-cache.js` to pre-warm the active roster's advanced-stats cache before flipping the provider. Along the way found and fixed 3 more real bugs: (1) the local `.env`'s `BALLDONTLIE_KEY` was dead the entire session, causing hours of misleading "everything is failing" debugging before being caught by direct API probing; (2) a cache-poisoning bug where a failed BDL identity search got permanently cached as "unresolvable" (149/150 resolutions corrupted by the dead key in one run); (3) the same poisoning pattern in the top-level advanced-stats cache. Also found and fixed a completely separate, pre-existing, provider-agnostic bug: `WNBA_LG` had no entry for the in-progress season, silently blanking every current-season-only player's advanced stats under ESPN too — built a live-computed replacement (`server/lib/currentSeasonLeagueAverage.js`). Re-warmed the cache under the fix (200/211 active players now have real data; 11 are a genuine narrow BDL data gap for very recent signees, confirmed directly, not a bug). Flipped `STATS_PROVIDER=balldontlie` on Heroku (v230), verified live via Playwright: A'ja Wilson's full 9-season career (including live 2026 data) and Azzi Fudd's 2026-only rookie season both render correctly with real numbers, no console errors, fast responses (warm cache).
- 2026-08-17: Flipped `STATS_PROVIDER=balldontlie` live on Heroku (v224) and tested via Playwright — team-stats pages worked, but A'ja Wilson's Advanced tab hit an H12 request timeout (30s) computing her full 8-season career against BDL's higher per-request-count PBP walk. Reverted immediately (`heroku config:unset STATS_PROVIDER`, v226); confirmed the live site is back to fast, correct ESPN-sourced behavior. Full writeup in the plan file's "Rollout attempt #1" section — this was the attempt that got fixed and re-shipped the next day, see the entry above.
- 2026-08-17: Finished BallDontLie provider verification (task #10): live shadow-compared ESPN vs BDL for A'ja Wilson (2023, 2024) and Kierstan Bell (2023, 2025) — every advanced stat matched within noise. Found and fixed a real robustness bug along the way: a burst of concurrent per-game requests (computing a whole career at once) could get rate-limited, and `bdlFetch` swallowed it identically to any other failure with zero logging/retry — one live computation came back with ~half its games missing and Win Shares null. Added 429 retry-with-backoff + failure logging to `client.js`, re-verified against the exact scenario that exposed it, added `test/balldontlie-client.test.js` (7 tests). Full suite now 249/249. Only the production `STATS_PROVIDER` flip remains — not done without explicit go-ahead.
- 2026-08-17: Built the BallDontLie hybrid provider (Phase 1 team stats + Phase 2 PBP-walking, both season-conditional at 2008+). Mid-build discovered BDL's `/plays` has no structured player-attribution field (ESPN does), requiring name-based text parsing instead of a structural port. Live-testing surfaced and fixed a real bug: blocked shots weren't counted as FGA (see Traps). Added 13 tests (`test/balldontlie-plays.test.js`, `test/balldontlie-eventid-routing.test.js`, a `providers.test.js` contract block) — full suite 231/231. Cache keys across 5 call sites were prefixed with the provider name to make `STATS_PROVIDER` safely toggleable. Not yet flipped on in production; see Next action.
- 2026-08-17: Notification feature's production deploy/Scheduler status confirmed live (was undocumented after the last commit). Brainstormed BallDontLie GOAT-tier feature ideas; logged non-props ideas to `docs/design/feature-backlog.md`. Started viability check on swapping the ESPN-PBP-reconstructed advanced stats (`server/lib/advancedStats.js`) for BallDontLie's GOAT-tier data — findings logged in `docs/design/provider-architecture.md`.
- 2026-08-16: Pre-game notification bell feature completed via full agent-team pipeline (backend-dev ‖ frontend-dev → critic → test-engineer, 2 critic fix rounds and 2 test-engineer fix rounds). Notifications created by internal job (not yet running), expire via TTL, fetched by client on polling interval. Bell icon in header with count badge. All tests passing, lint clean, client build clean. One critical bug caught by critic (insertMany error handling) and fixed by backend-dev. Three UI bugs caught by test-engineer and fixed by frontend-dev. Feature uncommitted; next step is user decision to commit/push/deploy, followed by manual Heroku Scheduler provisioning step.
- 2026-08-16: Username/password account system (signup/login/logout/me + team-rep PUT/DELETE) built and deployed. Critic review caught four security findings (rate-limiter bucketing, signup race condition, unawaited index, defunct franchises in dropdown) — all fixed. Committed in 5 commits, deployed to production (release v221).
