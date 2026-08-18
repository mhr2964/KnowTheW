# Provider architecture

## The contract

All external stats access goes through one `SportsDataProvider` contract (`server/providers/`), documented in `server/providers/types.js`. `providers/espn/` is the only implementation today; a Sportradar (or similar) implementation could be dropped in without touching consumers, provided it implements every method in `CONTRACT_METHODS` (`test/providers.test.js` fails the build if a method is missing — this is the enforcement mechanism, not a convention someone has to remember).

**Consumers resolve the provider per-call, inside handlers/functions — never at module load.** A module-level `const provider = getProvider()` would freeze whichever provider was active at process start; per-call resolution is what makes swapping providers (or mocking them in tests) actually work.

## Why ESPN, and the real risk

All live stats come from ESPN's *undocumented* JSON endpoints (`server/providers/espn/`) — no API key, no ToS acceptance flow. Facts aren't copyrightable (*Feist v. Rural Telephone*) and commercial use of real player names/stats is protected (*C.B.C. Distribution v. MLB Advanced Media*, the fantasy-sports precedent) — but hitting ESPN's private endpoint specifically is a ToS/ban risk, not a copyright one. Current stance: stay on ESPN for teams/rosters/schedule/box scores (no budget reason to touch what already works). The BallDontLie advanced-stats swap below is now **implemented and unit-tested** as `server/providers/balldontlie/` (Option A, hybrid, as decided) — not yet flipped on in production (`STATS_PROVIDER` is unset, still ESPN). See `HANDOFF.md` for current rollout status and the plan file it points to for the full build log, including a real bug found and fixed via live cross-checking.

## BallDontLie GOAT-tier swap — viability review (2026-08-17; implemented same day, see note above)

The candidate for a swap is narrow: not the whole provider, just `advancedStats.js`'s ESPN-play-by-play reconstruction (USG%/AST%/ORB%/PER/Win-Shares, see `getSeasonPBPSummary` above) plus the on/off and shooting-split PBP consumers (`onOffClient.js`, `pbpStatsClient.js`). Teams/rosters/schedule/box scores stay on ESPN either way.

**What happened last time (git archaeology, all same day, 2026-04-19):** BDL was wired as the *primary* stats source (`78caf0d`, `e1d3e30`), hit persistent 401s (`558b0a7`→`23621e9` are a debug trail: header-format tests, then "test redirect behavior"), and was fully reverted back to ESPN (`0053451`) same day. The reverted code called `https://api.balldontlie.io/wnba/v1/...`.

**2026-08-17 spike, actual finding — the host was never the bug.** `https://wnba.balldontlie.io` turns out to be a marketing/docs page, not an API host (confirmed: `/wnba/v1/*` on it 404s). `https://api.balldontlie.io/wnba/v1` — the same host the April code used — is the real, correct API host: `GET /players?search=...` and `GET /games?seasons[]=...` both returned real 200 data against it.

Tried three key sources: the project's `.env` key 401s outright on every call (invalid/dead key); the key set in Heroku config was initially ALL-STAR-only (401 on GOAT-only endpoints) until the user fixed the account's subscription — after that, the same key authenticated fine against `player_season_stats` and `player_season_advanced_stats`. **GOAT is now confirmed active and working.**

**Spike results, run against `api.balldontlie.io/wnba/v1` with the confirmed GOAT key (player: A'ja Wilson, id 535, 2025 season):**

1. **Totals fidelity — fully solvable, exact (not approximate). Neither season-level endpoint gives it directly, but summing single-game box scores does.** `player_season_stats` never defines a `per_mode` parameter at all (confirmed against the docs at `https://wnba.balldontlie.io/#wnba-api` — it unconditionally returns per-game averages; the API silently ignores unknown query params rather than rejecting them, which is why passing one had no visible effect). `player_season_advanced_stats`'s `per_mode` does work, but only gives real totals for FGA/FGM — rebounds/assists/steals/blocks/turnovers there are percentages, not raw counts.

   The fix: `GET /player_stats?player_ids[]=<id>&seasons[]=<year>` returns one row per game with **real integer box-score values** (`fgm: 11, fga: 22, pts: 31`, etc. — not rounded). Summing every game's row client-side reproduces exact BRef-style season totals. Verified on A'ja Wilson's 2025 season: summing 42 game rows gave `fgm: 332, fga: 658, pts: 937` — the FGA/FGM exactly match `player_season_advanced_stats`'s totals field, and `937 ÷ 40 official games played = 23.425`, matching the officially-reported `23.43` per-game average almost to the decimal. Two independent cross-checks, both clean.

   The one real gotcha: `player_stats`'s own `season_type`/`postseason` query params are *also* silently ignored (same quirk as `player_season_stats`), so summing "all games for a season" naively pulls in All-Star/exhibition rows too (confirmed: one `TEAM CLARK` All-Star-game row showed up unfiltered). The fix is to independently fetch the team's game list (`GET /games?team_ids[]=<id>&seasons[]=<year>` — whose `postseason` boolean *does* work correctly) and use that as the source of truth for which game IDs are real regular-season games, same pattern `getRegularSeasonEventIds` already applies to ESPN's PBP event list (excludes All-Star/non-franchise games) — a straight port of existing logic, not new design work.

   **Corrected verdict**: exact BRef-level totals fidelity is achievable from BDL for every stat the formulas need, not just an approximation-path fallback. Costs one extra fetch-and-sum pass per player-season (mirrors the existing game-log-loop pattern the ESPN provider already uses), not a single-endpoint call.

2. **Play-by-play — fully viable, not a dead end.** The correct route is `GET /plays?game_id=<int>` (singular `game_id`, integer — not `/play_by_play` with a `game_ids[]` array, which 404s). Confirmed on a real 2025 game: rich event types including explicit `"Substitution"` events with text like `"Nia Coffey enters the game for Brionna Jones"` plus team attribution per play — structurally enough to reconstruct on-court lineups the same way `espn/gameSummary.js` does today. The PBP-exact refinement path is buildable whenever it's worth the effort; it was never actually blocked.

3. **Historical depth — a real, meaningful gap.** `games?seasons[]=N` returns 0 results for 1997/2000/2003/2006, and a full page for 2008/2009/2010 — real WNBA coverage on BDL starts around **2008**. This site's own league-average table (`server/constants/leagueAverages.js`, `WNBA_LG`) already has entries back to **1998**, a full decade earlier. A BDL-only advanced-stats provider would leave roughly ten historical seasons (1998–2007) with no advanced-stats source at all unless ESPN stays wired in as a fallback specifically for those older seasons — which stops this from being a clean single-provider swap and turns it into a season-range-conditional hybrid.

**Bottom line:** Option A (BDL data feeding the existing BRef-style formulas) is technically buildable for 2008-present with exact totals fidelity (see above) — no accuracy tradeoff needed. **Decided (2026-08-17): hybrid.** BDL becomes the advanced-stats source for 2008–present; ESPN's existing PBP-reconstruction path stays as-is for 1998–2007. This is a per-season provider selection inside the advanced-stats code path specifically — teams/rosters/schedule/box scores stay on ESPN regardless of season either way, this only affects `advancedStats.js`'s data source.

**The real fork is Option A vs Option B, not "can we auth":**

- **Option A — feed BDL's data into the existing BRef-style formulas.** Turns out cheaper than first thought: `advancedRow()` in `advancedStats.js` already has a **box-score-only approximation path** (used today whenever PBP data isn't available) that computes TS%/eFG%/USG%/AST%/ORB%/DRB%/TRB%/STL%/BLK%/PER from just the player's own box-score line + team *season-average* stats + the static `WNBA_LG` league-average table already in the codebase — no on-court/PBP reconstruction required. Win Shares (`computeWinShares`) is the same shape of inputs (box line + team stats + league averages + opponent points-allowed). A BDL provider could feed this path from `player_season_stats`/`team_season_stats` alone as a first cut — no PBP walking needed at all. The *more precise* PBP-exact path (mirroring on-court stats) is a real port of PBP-walking logic against BDL's play-by-play format, same effort as the current ESPN code — but it's an optional later refinement, not a blocker to shipping Option A.

- **Option B — consume BDL's official advanced stats directly, drop the homegrown formulas.** Even less code, but PER and Win Shares are Basketball-Reference inventions — no vendor "officially" publishes them, BDL included. A straight swap means either dropping PER/WS from the site (a visible stat-vocabulary change, a product decision, not just a data-source change) or keeping them ESPN-sourced forever alongside BDL-sourced everything-else, which isn't a clean single-provider swap at all.

**Given the user wants "a pretty clean swap"**, Option A is the one that preserves that promise, and — correction from the first pass at this doc — it's cheaper to get started than originally estimated, since the box-score-only approximation formulas are already-working code with no PBP dependency.

**Open unknowns, still need a real spike (a few throwaway API calls with a confirmed GOAT-tier key against `api.balldontlie.io/wnba/v1`) before committing to a build:**
- Does `player_season_stats`/`player_season_advanced_stats` support `per_mode=totals` cleanly, or only rounded per-game averages? (The original revert commit message cited needing "real season totals" — if BDL's totals mode is solid, this specific old blocker is moot.)
- Does a play-by-play-equivalent payload exist and carry lineup/substitution events, for the optional later PBP-exact refinement? (The `/play_by_play` path guessed during the spike 404'd — "Route not found" — so the real path name is still unconfirmed too.)
- How far back does BDL's WNBA season coverage go? Unauthenticated `games` probes suggest 0 results at 1997/2005 but 1+ at 2010/2015 — inconclusive without pagination, and this site has historical franchise-lineage pages (`team-season-dropdown.md`) that need matching depth.

~~No code should be written against BDL for this until a working GOAT key is confirmed and that spike is re-run.~~ Superseded same day: the spike was re-run with a confirmed working GOAT key (see above), and the build described here shipped as `server/providers/balldontlie/`.

## ESPN-migration Phase 1a: player game log (shipped 2026-08-18)

`getPlayerGameLog` now sources from BDL for season >= `BDL_MIN_SEASON` (2008), same
season-conditional dispatch as team stats. See `server/providers/balldontlie/gameLog.js`. Full
phased plan (this phase plus the schedule/season-stats/identity phases considered and their
verdicts) lives in the plan-file history if a deep dive is ever needed.

**Known, permanent, confirmed data-coverage gap vs ESPN:** BDL has no preseason game data at all,
and its `/player_stats` rows for games a player was rostered for but did not play (DNP) come back
with `min:"0"` and every counting stat `null` (filtered out via `isDnpRow` — without this, a naive
join invents phantom zero-stat games). Live-verified against A'ja Wilson's full real 2025 season:
after the DNP fix, 0 per-game mismatches across every game BDL and ESPN both have (exact
points/scores/opponents match). The only remaining difference is that BDL's game log omits
preseason games and the WNBA All-Star exhibition game — both present in ESPN's version, neither
present in BDL's regardless of season. This is a real, visible product difference (a BDL-sourced
player's game log for season >= 2008 will show fewer rows than the same player's ESPN-sourced log
would have), not a bug to fix — there is no BDL data source for either category.

## ESPN-migration Phase 2: regular-season team schedule (shipped 2026-08-18)

`getTeamSchedule` now sources regular-season games (`seasontype === 2`) from BDL for season >=
`BDL_MIN_SEASON`. Playoffs (`seasontype === 3`) always stay ESPN, permanently, regardless of
season — confirmed by live spike that BDL's `/games` has no field equivalent to ESPN's
`competition.type.text` round label (e.g. "Round of 16") on any real postseason game, and the
`postseason` query param remains a confirmed no-op (same quirk documented elsewhere in this file).
This required the BDL dispatch to branch on `seasontype`, not just `season`, since
`routes/teams.js`'s `/teams/:id/schedule` route uses this one method for both regular-season and
playoff views. `getPlayoffSchedule` (the separate convenience method `historyAggregator.js` uses)
was already an ESPN-forever passthrough and needed no change.

BDL's game rows carry no opponent logo (same gap as Phase 3's identity findings below) — enriched
via a join against ESPN's already-cached `getTeams()` by abbreviation, in
`server/providers/balldontlie/schedule.js`.

Live shadow-compare (LV Aces, 2025 regular season, real production data): 0 per-game mismatches
across all 44 games.

## ESPN-migration Phase 1b: player season stats + provider contract normalization (shipped 2026-08-18)

`getPlayerSeasonStats` now sources from BDL for season >= `BDL_MIN_SEASON`, merged with ESPN's real
pre-2008 data — one call spans a player's whole career, so this can't be a per-call season switch
the way other methods are (see `server/providers/balldontlie/seasonStats.js`'s header comment).

An initial design (template-substitution: reproduce ESPN's raw JSON shape from BDL data, leaving
`statsParser.js` untouched) was superseded by user preference for the architecturally cleaner
option: **the provider contract itself is now normalized.** `getPlayerSeasonStats` returns
`PlayerSeasonRow[]` (`server/providers/types.js`) instead of raw ESPN JSON. ESPN's own
implementation (`espn/playerStats.js`) now owns 100% of the ESPN-raw-shape parsing that used to
live in `statsParser.js`; `statsParser.js` itself is provider-neutral and has never seen an ESPN
category object. `schemas.js` validates the new shape (previously exempted as "source-raw JSON by
design"). Percentages (FG_PCT etc) are now derived from made/attempted uniformly for both providers
instead of trusting each source's own precomputed value — verified equivalent to the old
ESPN-trusting behavior via a git-stash old/new diff against a real 9-season career (differences
all sub-0.05, explained by ESPN's internal rounding vs exact division).

**A consumer missed on the first design pass, caught by grepping the whole codebase before
declaring this done:** `espn/leagueStats.js` (the percentile system — stays ESPN-forever,
unaffected by this migration) imported `parseStatMap` directly from `statsParser.js` for its own,
completely independent raw ESPN fetch. It needed the *original* `/100`-percentage-converting
behavior, which now genuinely differs from `playerStats.js`'s raw-counts-only version — restored as
a local copy there rather than shared, since these are two different jobs now, not one.

**Confirmed, permanent BDL gap:** no games-started (`GS`) field exists on any `/player_stats` row,
for any season — `GS` is `null` for every BDL-derived season row, and the *career* `GS` total is
also `null` if any contributing season lacks it (rather than silently reporting a partial sum as
complete).

**Verification:** beyond unit tests, an independent from-scratch script (raw `fetch()` calls, none
of this session's own code) split a real player's 2025 games by `postseason` and summed them —
exact match against the shipped output on both the regular-season and playoff splits. The full
`buildDetailedStats` pipeline was also fed real merged 9-season hybrid data end-to-end: zero `NaN`,
and career totals exactly equal the sum of the per-season rows.

## Shot chart: new BDL-only capability, not a migration (shipped 2026-08-18)

`getPlayerShotChart(playerId, season)` — the site's first zone-based shooting visual, from the
BDL GOAT-tier backlog. Unlike every entry above, this is **not** an ESPN→BDL migration: ESPN has
no shot-location data source at all, so `espn/index.js` implements the method as a hard `return
null` rather than inheriting the base class's throwing default (required, not cosmetic —
`STATS_PROVIDER` defaults to `'espn'`, so any non-BDL environment would otherwise 502 on this
route).

**The original backlog framing was wrong, corrected by a live spike before any code was written:**
BDL's `/player_shot_locations` and `/team_shot_locations` endpoints return **zone-aggregated FG
stats** (`{fga, fgm, fg_pct}` per named court zone), not per-shot x/y coordinates — a scatter/dot
shot chart isn't buildable from this data at all. The 7 real (non-overlapping) zones are
`restricted_area`, `in_the_paint_non_ra`, `mid_range`, `left_corner_3`, `right_corner_3`,
`above_the_break_3`, `backcourt`. BDL also returns a `corner_3` field that is just
`left_corner_3 + right_corner_3` summed (confirmed live) — dropped in the normalized shape to
avoid double-counting.

**Zone tracking has its own, much newer season floor than the rest of this provider's BDL
coverage:** confirmed empty at seasons 2010/2015/2018/2020/2021, present starting 2022. This is
`SHOT_CHART_MIN_SEASON` (`balldontlie/client.js`) — do not reuse `BDL_MIN_SEASON` (2008) for this
feature.

**Client side:** no charting library exists in this codebase (`FingerprintRadar.jsx` established
the hand-rolled-SVG convention). `ShotChart.jsx` follows the same pattern: a stylized (not
regulation-exact) half-court SVG with each zone as a fillable region, colored by FG% on a clamped
sequential scale, drawn widest-zone-first so smaller/more specific shapes visually overwrite the
broader ones beneath them — avoids any path-boolean subtraction.

**Verification:** since there's no ESPN equivalent, no shadow-compare is possible. Instead, a real
correctness check specific to this feature: summed each zone's `fgm` for a real player/season
(A'ja Wilson, 2023) and compared against the already-verified season-stats `totals.fgm` for the
same season — 335 (zone sum) vs. 337 (season total), a small, expected discrepancy (BDL not
categorizing every shot into a zone), not a mapping bug.

## `getSeasonPBPSummary` boundary

`getSeasonPBPSummary(playerId, season, seasontype)` (defined in the provider contract, implemented in `providers/espn/index.js`) is the **only** place raw per-game play-by-play data should be looped and summed to reconstruct team on-court stats / Win Shares team-averages — this is ESPN's specific workaround for having no season-level on-court endpoint. If a future Win-Shares or on-court-stat tweak needs raw per-game data again, it belongs inside the provider implementation, not back in `advancedStats.js` (the data-neutral analysis layer) — that boundary was deliberately drawn to keep provider-specific reconstruction logic out of code that's supposed to work with any provider.

## Caching discipline

Every ESPN-backed read should be cached — either `withCache` (permanent, past-season data) or `withTtlCache` (a bounded TTL, current-season data that can still change) from `server/providers/espn/client.js`. `getPlayerSeasonStats`, `getPlayerGameLog`, and `getGameLogEvents` all follow this pattern; if you add a new ESPN-backed read, give it the same treatment rather than fetching fresh on every request — this codebase has hit real production incidents (a Mongo free-tier quota outage, see `pbp-cache-refactor.md`) from uncached/over-cached reads.

**Tests must never hit ESPN or Atlas.** `NODE_ENV=test` gates the espnClient prefetch and the Mongo connection in every test file — don't remove that gate to "just try something quickly."

## Two calendar/season helpers that look interchangeable but aren't

`seasonWindow.js` exports two different functions for two different jobs — using one where the other belongs is an easy, wrong-looking-right mistake:
- `isPastSeason(season, now)` — a plain calendar-year check, answers "is it safe to cache this in Mongo forever."
- `latestCompletedSeason()` — a conservative Nov-1-cutoff jitter-safety cap, answers "should this season count toward a percentile distribution / fingerprint yet."

## Minor known-harmless quirks

- `advancedStats.js` iterates `PBP_OC_KEYS` to aggregate `totOC`, which picks up `pts`/`oPts` too — never read, harmless.
- ESPN doesn't always set `scoreValue` on free-throw plays. The PBP accumulator uses `isFT ? 1 : sv`, not plain `sv` — don't revert that.
