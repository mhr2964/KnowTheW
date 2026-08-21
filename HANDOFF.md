# HANDOFF — KnowTheW

Forward-looking handoff for the active work-stream. **Overwrite** each session; history lives in git. Durable architecture/design rules live in `docs/design/` (see `docs/design/design.md`), not here — this file is transient work-stream state only.

> **Note on account handoff:** the 25-commit "Recent context" section below (through `728cff0`) was shipped by a prior Claude Code account/session that ran out of usage; this account picked up cold and reconstructed that history from `git log`/`git diff` rather than first-hand memory (still accurate for *what shipped*, thinner on *why/iteration* texture). This same (second) account then completed the mobile-UI/table-normalization effort described below, with full first-hand context.

```yaml
last-model: claude-sonnet-5
last-session: 2026-08-21 — completed the mobile-UI + table-normalization effort (see below): mobile hamburger nav for the 10-tab strip, unified Study/Export/Percentile toolbar across all 10 tabs via a new shared TableToolbar, and a real percentile-data bug fix (Adj. Shooting) that required a distribution-cache version bump. Uncommitted -- npm run check clean (324/328, same 4 pre-existing JWT_SECRET-env failures), live-verified on a real mobile viewport and desktop.
state: BDL is the live production stats source for essentially everything (team stats, advanced/Win Shares, game log, schedule, season stats, percentiles/leaderboards, shot chart) for season >= 2008; ESPN covers identity/roster, pre-2008 seasons, and playoffs permanently. Player-page mobile UI and table normalization is now consistent across all 10 stat-type tabs. No open blockers.
```

## Next action

**Commit and push the mobile-UI/table-normalization work (uncommitted, verified, not yet pushed).** Nothing left to build for this effort -- see "What shipped" below. Standing rule: get explicit go-ahead before pushing (Heroku auto-deploys on push to origin/master).

**One thing to spot-check before/soon after shipping:** Advanced and Play-by-Play tabs' live click-through wasn't finished this session -- BDL rate-limiting (compounded by this session's own repeated direct-curl testing against the current, always-live 2026 season) made the current-season fetch time out repeatedly in local dev. Both tabs' toolbar wiring was verified by (a) lint, (b) the exact same TableToolbar/buildStudyDeck pattern working live on GameLog/Splits/ShotChart/Adj. Shooting, and (c) the real `/advanced-pbp-all` response shape confirmed to match what AdvancedTab.jsx's `buildStudyDeck` call expects -- high confidence, but not click-verified end-to-end the way every other tab was. Worth 60 seconds in a browser next time the dev server's BDL budget is fresh.

## What shipped this session (player-page mobile UI + table normalization)

Design/root-cause was already done by the plan doc (`C:\Users\Owner\.claude\plans\player-page-mobile-and-table-normalization.md`): a clean two-way split where 5 "generic" `BrefTable`-driven tabs shared one toolbar and 5 "raw" tabs (GameLog/Advanced/Splits/PBP/ShotChart) each hand-rolled their own, which is why Study/Export/Percentile were inconsistent. This session finished the actual fix:

- **Mobile tab nav**: the 10-tab `.stat-type-tabs` strip was just wrapping into 3 messy rows on a real narrow viewport (confirmed live before building anything). Replaced with a collapsed toggle (`.stat-type-nav-toggle`, active tab label + caret) that opens a dropdown list overlay at the 600px breakpoint -- same tabs, same click handler, CSS-only breakpoint switch (no JS media-query listener). Desktop pill-tab strip is untouched. Live-verified open/select/close on a 390px viewport.
- **`TableToolbar` wired into all 10 tabs** (`client/src/components/TableToolbar.jsx`, built last session but unwired): the generic branch in `DetailedStats.jsx` and all 5 raw-tab components (`GameLogTab`, `AdvancedTab`, `SplitsTab`, `PlayByPlayTab`, `ShotChart`) now render through it instead of 3 different hand-rolled containers (`.stat-table-header`, `.gl-controls`, `.bref-toolbar` -- the last of these is now dead CSS, removed). Export CSV now sits in the same spot on every tab.
- **"Study this table" added to all 5 raw tabs**, which never had it before (`buildStudyDeck()` from `client/src/lib/studyData.js`, also built last session). GameLog's deck covers the *whole season* (not just the visible page). Shot Chart's zone data doesn't fit `buildStudyDeck`'s positional-array assumption (zones are keyed objects: label/fgm/fga/fgPct/leagueAvgPct), so it builds its `{data, columns}` shape directly instead of forcing a mismatch -- confirmed correct pattern per the plan's own guidance not to force uniformity where it doesn't apply.
- **Percentile toggle now only shows where it has real coverage**: `PERCENTILE_ELIGIBLE = {perGame, totals, per36, adjShooting}` in `DetailedStats.jsx` -- Per 100 Poss and all 5 raw tabs (per-game/split/zone granularity, not season-aggregate) never show it, which is a legitimate difference, not a bug. This fixes the "percentile toggle doesn't work on some tabs" complaint's absence-half.
- **Fixed the toggle's actually-broken half**: Adj. Shooting's percentile toggle showed but colored nothing. Root cause #1 (already partly fixed, uncommitted, when this session started): `percentileClient.js` didn't compute TS_PCT/EFG_PCT/TPAr/FTr at all. Root cause #2, found live this session: completed-season distributions are cached in Mongo *forever* by design (`getOrBuildDistribution`'s own comment), so every season cached before that fix landed had no `TS_PCT` array and silently returned `null` for every player, every season -- confirmed live via a direct API check (`TS_PCT: null` for a season with real games). Fixed with a `DIST_CACHE_VERSION` bump (same pattern as `advancedStats.js`'s existing `v` field) so stale docs recompute once. Verified live: every season's TS%/eFG% now colors correctly.

**Not touched, out of scope:** `OnOffTab.jsx` still hand-rolls `.gl-controls` -- it's dead code (not imported/rendered anywhere in the app currently), so it wasn't part of the 10-tab surface this effort covers. Worth a cleanup pass or a decision on whether it's meant to ship eventually.

## Recent context (prior account, all committed, chronological)

This is the part this account did not witness first-hand — reconstructed from `git log 687a18c..728cff0` (25 commits, 2026-08-18 through 2026-08-21). Grouped by theme, not strict chronological order; see individual commits for full EXPECTED/VERIFIED-BY detail.

**ESPN → BallDontLie migration reached near-completion:**
- Player game log migrated (`a3e9ffa`) — shadow-compared 0 mismatches across 52 real games; caught and fixed a phantom-DNP-row bug before shipping.
- Regular-season team schedule migrated (`8fd480a`) — playoffs stay ESPN-forever (BDL has no round-label field, confirmed via live spike). Also fixed a real bug: the schedule cache key wasn't provider-scoped, so a stale ESPN-cached schedule could have silently masked the new BDL path forever.
- Player season stats normalized to a provider-neutral `PlayerSeasonRow[]` contract, then migrated (`c84873e`, design doc `ff7793b`) — this was a real architectural decision: an initial "reproduce ESPN's raw shape from BDL" plan was superseded by normalizing the contract itself once it was clear 4 separate files parsed the raw shape directly. Confirmed numerically equivalent to pre-refactor output for a real 9-season career (max diff 0.05, explained by rounding).
- Percentile system (leaderboards + player season averages) migrated together as one unit (`d3f8e1b`) — deliberately NOT split across commits, since a partial migration would have silently skewed percentile rankings (one side of the comparison BDL-sourced, the other ESPN-sourced).
- Feature-backlog entry for this whole effort removed once shipped (`63125aa`), per that file's own "remove once shipped" convention.
- **Net result: the only permanent ESPN-forever territory left is identity/roster/branding (no logos/colors/headshots exist in BDL's WNBA tier, confirmed dead end), pre-2008 seasons, and playoff schedule round labels.**

**Shot Chart feature shipped, then iterated on user feedback (all live in prod):**
- Initial ship (`33dc7fc`) — zone-aggregated FG% (7 zones), not per-shot x/y (a live spike disproved the original backlog assumption before any code was written).
- Fixed a real rendering bug found via live prod check on knowthew.net: "Above the Break 3" zone never painted because its SVG path was drawn underneath other zones (`3c22b09`).
- Full color-scale and linework redesign (`adf70e3`) — iterated against user review via a throwaway artifact mockup (rainbow → single-hue → muted diverging → vivid diverging → final flat/quiet pass) before porting into the real component.
- Most recent commit (`728cff0`, today): user correctly reported the color scale was misleading — it centered every zone at a flat 50%, but real zone averages vary wildly (e.g. restricted-area ~63% vs. above-the-break-3 ~34%), so a good rim shot and a good three looked the same color. Fixed by pulling real per-zone league averages (`getLeagueShotZones`) and re-centering the sigmoid on each zone's own average instead of a fixed midpoint.

**Play-by-Play / Advanced tabs: a real reliability effort, several rounds of root-causing:**
- Originally computed a player's whole career server-side before returning anything — could sit on a spinner as long as the slowest season took. Rebuilt as true per-season progressive loads (`71d0727`, `0829a65`) after confirming live in production that even the "fast path" was still racing a structurally-broken whole-career background call that BDL's ~500/min rate limit could never clear inside Heroku's 30s router timeout (both endpoints were H12-timing-out in prod before the fix).
- Prefetch moved to page-load instead of tab-click (`3292ef1`), deliberately serialized one-request-at-a-time across both tabs to protect the shared site-wide BDL rate budget.
- Per-season routes now race a 20s internal budget and return an explicit `504 timeout:true` instead of silently vanishing a season with no error shown (`4a551c9`) — this was a real user-facing bug: a specific season (e.g. an MVP year) could disappear from the tab entirely, indistinguishable from normal partial coverage.
- Per-game PBP data gained caching for the first time (`a0e4251`), then that caching was fixed to be keyed per-*game* rather than per-(game, player) (`2d88670`) — a roster's worth of players sharing a game had been paying the real fetch cost once each, up to ~12x more BDL requests than necessary.
- A pre-warm script (`7224c98`) and its throttle/timeout were recalibrated twice against BDL's *real* behavior (`d8c556d`) — what looked like a hang on a real long-career player (Tina Charles) was actually BDL correctly returning `429 Retry-After: 60`, and the backfill's own timeout was cutting it off one step from succeeding.
- Cleanup once the above stabilized: removed the now-superseded `/pbp-stats` endpoint and its dead code (`911e050`), deduped season-scoped fetch/cache/abort boilerplate across GameLog/Splits/ShotChart/OnOff into one `useSeasonScopedFetch` hook (`835a173`).
- **Known gap, not fixed, flagged in `7224c98`:** when a player's BDL id resolution fails, `getRegularSeasonEventIds`/`getGamePbpStats` just return nothing — unlike season-stats methods, there's no graceful ESPN fallback, so PBP/Advanced data goes silently missing for that player's BDL-era seasons. Worth a future pass.

**Real production incident: Mongo free-tier quota (512MB) got filled mid-backfill, breaking live writes site-wide** (same day as the PBP caching work above):
- Root cause: BDL's raw `/plays` row embeds a full team object plus several unused fields on every play; a 407-play game serialized to ~133KB, almost entirely repeated/unused data. The very first backfill run filled the *entire* free-tier quota after only 59 of 459 players, breaking live writes including security-relevant unique indexes. Restored service by dropping the (pure-cache, safely rebuildable) collection.
- Fixed at three layers: trimmed the specific PBP payload to only the fields actually read (`0529e60`, ~57% smaller) plus a hard 400MB safety-valve check in the backfill script itself; then generalized the same trim to ESPN's raw game-summary cache, which had the identical bug and was caching a 361.6KB document (`e520c00`); then added the storage guard to the *shared* `writeCache()` path every cache collection in the app uses, not just PBP (`9b4efa4`), so no future cache addition can repeat this incident.
- Real follow-up finding: WiredTiger's own on-disk compression does nothing for the Atlas free-tier quota, which is enforced against *logical* (uncompressed) size — so gzip-compressing payloads before writing was added on top of the trimming (`e5eb71d`), a genuine 11-16x reduction on already-trimmed payloads. CI (not this account) caught a real bug in the compressed-read path before it reached production: it assumed `payloadGz` was always a BSON Binary wrapper, but a test's in-memory fake db stored a plain Buffer, corrupting reads for that case (`e21c73f`).

**Other real bugs fixed along the way:**
- A **live, ad-blocker-triggered blank-page crash affecting real users**, not just a dev-only quirk (`e8ac8d5`): `main.jsx` statically imported `./lib/analytics`, and ad-block filter lists commonly block any file literally named `analytics.js` — a blocked static import throws before React ever mounts, so nothing renders, not even the Sentry error boundary (defined in the same module). This was chased down while investigating a previously-documented local dev-only "blank page" bug that turned out to be the exact same failure, live, in that dev browser's own profile. **This closes out the old HANDOFF's "local Vite blank-page bug, not root-caused" item — it was this, and it's fixed.** Same commit also fixed a sticky-column horizontal-scroll gap (border-collapse Chromium compositing quirk) and added Shot Chart's Export CSV button.
- Dev environment defaulted to ESPN while production had run BDL for a while, making BDL-specific behavior (its rate limiter especially) impossible to verify locally — flipped the dev default to BDL and gave ESPN the same retry/backoff resilience BDL already had (`3328b26`).
- Built the long-standing "coming soon" Per 100 Poss and Adj. Shooting tab placeholders (`d151f03`) — both reuse data `/detailed-stats` already fetches synchronously (team pace, league averages), zero new provider calls or timeout exposure. Caught and fixed a real bug during verification: `PlayerRoutePage.jsx`'s `VALID_TABS` set didn't include the new `adjShooting` key, so opening that tab's URL directly bounced to the default tab.

## What's been tested (as of the last committed session, 728cff0)

Every commit above paired `npm run check` (lint + the then-current test count, consistently 324-341 passing with 4 pre-existing unrelated `JWT_SECRET`-env failures as baseline) with a live verification step — shadow-compares against real BDL/ESPN data, live curl smoke tests, or live browser checks. See individual commit VERIFIED-BY blocks for specifics; not reproduced in full here.

## Known cosmetic follow-ups (non-blocking, carried forward, not re-verified by this account)

1. **Notification dropdown flush margin on narrow mobile** — On ≤360px viewports, dropdown has no side margin; renders as a "bar" rather than a floating card.
2. **Silent "?" on malformed opponent shape** — If ESPN API returns an unexpectedly shaped `opponent` field, dropdown silently renders bare "?" with no console warning.

## Traps

- **BDL id-resolution failures silently drop PBP/Advanced data** for that player's BDL-era seasons (no ESPN fallback unlike other methods) — flagged, not fixed. See `7224c98`.
- **`writeCache()`'s 400MB storage guard (`9b4efa4`) is now load-bearing for every cache collection in the app**, not just PBP — do not remove or raise casually; this exists because a real incident filled the entire free-tier Mongo quota once already.
- **Cache payloads are gzip-compressed (`payloadGz`), with a legacy plain `payload` fallback** — `getCached()` must handle both a BSON Binary wrapper (real Mongo driver) and a plain Buffer (`Buffer.isBuffer()` check, fixed in `e21c73f`) when reading `payloadGz`. Any new direct cache read path must do the same check.
- **Local dev now defaults to `STATS_PROVIDER=balldontlie`** (flipped in `3328b26`) — if you need to test the ESPN path locally, set `STATS_PROVIDER=espn` explicitly; it no longer happens by default.
- **`GET /players/:id/pbp-stats` and `pbpStatsClient.js` are gone** (`911e050`) — superseded by the `pbp-table`/`advanced-pbp-all` per-season split. Don't resurrect a caller expecting the old endpoint.
- **BDL's per-game PBP/rate-limit backfill script (`scripts/warm-pbp-cache.js`) throttles to 100/min with a 75s per-call timeout** — both were recalibrated against real observed `429 Retry-After` behavior; don't shorten the timeout without re-confirming it still comfortably covers a real cooldown wait.
- **Percentile coverage (`PERCENTILE_STATS` in `percentileClient.js`) covers perGame/totals/per36/adjShooting only** — Per 100 Poss has no percentile support yet (would need a league-wide team-pace fetch that doesn't exist), so its toggle is intentionally hidden rather than shown-and-broken. Keep this in mind when wiring `TableToolbar`'s percentile prop into that tab.
- Everything under "Traps" in the pre-2026-08-18 history (SCHEDULER_TOKEN, notification TTL index, `users.teamRepId` index, `insertMany` error semantics, BDL rate-limiting/retry basics, `resolveBdlPlayerId`/advanced-stats cache poisoning fixes) is unchanged and still load-bearing — trimmed from this file only because it hadn't come up again in the 25-commit window audited above, not because it's been superseded. Consult git blame / the commit range before `687a18c` if a deep dive on any of those is needed.

## Do not touch

- `server/routes/api.js` (God-Module, already refactored as of 2026-08-04; do not add new routes directly to it).
- The `users.teamRepId` index — critical for poll performance.
- The `notifications` TTL index on `expiresAt` — without it, notifications linger indefinitely.
- `writeCache()`'s storage guard (see Traps) — real-incident-driven, do not remove to "simplify."

See `docs/design/feature-backlog.md` for remaining unscheduled ideas (injury report, odds/spread on schedule) from the 2026-08-17 BallDontLie brainstorm — the advanced-stats-provider-swap item was removed from that file once shipped.
