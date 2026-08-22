# BDL expansion roadmap

Multi-feature build plan from a 2026-08-21 brainstorm: an audit of BallDontLie's full WNBA GOAT-tier
API surface (`bdl-openapi-wnba.yml` in this same folder) turned up a lot of data the site pulls
into existing endpoints but never surfaces, plus a few genuinely new capabilities (standings,
injuries, odds) that don't exist on the site in any form. This doc is the live checklist for
building through all of it, one feature at a time, each with its own commit + verify + ping-compact
cycle. **Status column is the source of truth for where this effort is** — check it before assuming
context from a compact summary.

## Working agreement for this effort

- One feature at a time, in the order below (order can change if a later feature turns out to
  block on an earlier one, or vice versa — update this doc if so).
- Each feature gets: implementation, lint/build/test, live Playwright verification (mobile +
  desktop where UI-facing), a commit (multi-model git protocol — `[claude-sonnet-5]` tag,
  EXPECTED/VERIFIED-BY), and a push+deploy — matching the exact cadence used for the mobile-UX
  passes shipped earlier the same day (verify deploy via `heroku releases`, confirm 200 on the live
  URL). No pause for confirmation between features unless something breaks or a real product
  decision comes up that only the user can make.
- After each feature ships: update this doc's Status column, write the session checkpoint file
  (`%TEMP%\claude-checkpoint-<SESSION_ID>.md`) with which feature just finished + which is next,
  confirm `signal-watcher.ps1` is alive (pid + recent log activity) before triggering it, then run
  `>>ping`. On resume, re-read this doc's Status column and `HANDOFF.md` before continuing — don't
  trust post-compact self-recollection over these two files.
- Only interrupt the user when the whole roadmap is done, or when genuinely blocked (a design
  decision, an unexpected data gap, a broken deploy that needs a call only they can make).

## Status

| # | Feature | Status |
| --- | --- | --- |
| 1 | Site IA rework: Teams page, Standings page, real homepage, nav | Shipped `7a13739`, deploy verified live |
| 2 | Off/Def/Net Rating + PIE on the existing Advanced tab | Shipped |
| 3 | Clutch splits | Shipped |
| 4 | Scoring-distribution dashboard | Shipped |
| 5 | Usage dashboard | Shipped |
| 6 | Defense dashboard (incl. Defensive Win Shares) | Shipped |
| 7 | Team Four Factors (Team Stats page) | Shipped |
| 8 | Team shot chart | Shipped |
| 9 | League shot-zone leaderboards | Shipped |
| 10 | Per-game advanced stats (Game Log) | Not started |
| 11 | Injury report | Not started |
| 12 | Odds/spread on schedule | Not started |

Player props stays explicitly deferred (user call, 2026-08-17 brainstorm) — not on this list.

## 1. Site IA rework: Teams page, Standings page, real homepage, nav

Today's homepage is just `RecentDecks` + the full active/defunct team grid — there's no nav beyond
the logo and no standings anywhere. `getStandingsRaw()` exists but is ESPN-only, has exactly one
consumer (`historyAggregator.js`, for playoff-seed history — not a live table), and is deliberately
not on BDL (per `balldontlie/index.js`'s own comment: "no accuracy motivation to touch it, only
risk"). This feature is unrelated to that path — it's a **new**, BDL-sourced live standings table.

**BDL spike results (2026-08-21, confirmed live against `GET /standings?season=2025`):**
Returns per team: `wins`, `losses`, `win_percentage`, `games_behind`, `home_record`, `away_record`,
`conference_record`, `playoff_seed`, `conference`, plus the team object. Richer than the existing
ESPN-derived data (`fetchStandings()` in `espn/client.js` only has wins/losses/conference/seed, no
GB or home/away/conference splits). No streak/last-10 field was seen in the spike — re-check the
full response shape before finalizing the table's column set.

**Build:**
- `client/src/pages/TeamsPage.jsx` — the existing team grid (`TeamCard`, `LogoPlaceholder`, active +
  defunct sections) moves here from `HomePage.jsx`, essentially unchanged. New route `/teams`.
- `client/src/pages/StandingsPage.jsx` — new page, new route `/standings`. Needs a new server route
  (`server/routes/` — decide whether it belongs on `teams.js` or its own file) backed by a new BDL
  provider method (`getStandings(season)` or similar — check `SportsDataProvider.js`'s contract
  conventions before naming). Season-conditional the same way other BDL methods are (current season
  live; decide whether historical seasons matter here or if "current standings" is the only mode
  worth building — standings are inherently current-season-focused, unlike stat pages).
- Header nav: add real nav links (Home / Teams / Standings / Compare) — today's header has none
  beyond the logo. `Compare` already has a route (`/compare/:idA/:idB`) but no nav entry, only a
  button on player pages.
- `HomePage.jsx` rewrite: keep `RecentDecks`, drop the team grid (moved to Teams), add a "league
  snapshot" — a standings teaser (top of each conference) and/or a league-leaders teaser (the
  percentile/leaderboard system already exists server-side). Exact widget mix is still open — this
  is himself worth a quick confirm with the user before finalizing, since it's the actual front door
  of the site.

**Shipped as `7a13739`.** League-snapshot widget mix landed as top-4-seeds-per-conference + a
"Browse all teams" CTA (percentile/leaderboard teaser deferred, not needed yet). Standings also
picked up a By Conference / Combined view toggle (user request mid-build, not in the original
scope above) — Combined re-ranks all teams by win% (seed is conference-scoped, so a straight seed
sort would show two different teams both labeled "1").

**Verify:** lint/build/test, live Playwright at mobile + desktop for the new nav, Teams page (parity
with today's home grid), Standings page (real data, correct conference grouping/sort, both view
modes), and the new homepage layout.

## 2. Off/Def/Net Rating + PIE on the existing Advanced tab

**Shipped.** Correction to this section's original premise: these fields are NOT sitting unused on
an endpoint the Advanced tab already calls — the Advanced tab's numbers are 100% homegrown from
play-by-play box-score reconstruction (`advancedStats.js`'s `computeSeasonPBP`/`aggregatePBPSummary`);
the codebase never called BDL's `player_season_advanced_stats` endpoint anywhere. This needed a
genuinely new fetch, not just reading more fields off an existing response.

Build: new `server/providers/balldontlie/advancedRatings.js` (`fetchPlayerSeasonRatingsBdl`, split
into a testable pure `mapAdvancedStatsRow`), a new `SportsDataProvider.getPlayerSeasonRatings`
method (BDL-only, ESPN returns null — same posture as `getPlayerShotChart`), fetched alongside the
existing team-stats calls in `computeSeasonPBPUncached` and appended as 4 new `ADV_HEADERS_SRV`
columns (`OFF_RATING`/`DEF_RATING`/`NET_RATING`/`PIE`). Career row uses a minutes-weighted average
(no lower-level possession counts available to recompute an exact career rate, unlike TS%/eFG%).

Confirmed live (A'ja Wilson, id 535/3149391, 2026-08-21): field names (`off_rating`, `def_rating`,
`net_rating`, `pie`) and scale (PIE is a 0-1 fraction like TS%; ratings are already ~90-115 numbers)
match the original assumption exactly. Also confirmed a real data floor — these fields are empty
before 2022 (same later tracking-data feed as `SHOT_CHART_MIN_SEASON`, not `BDL_MIN_SEASON`) — added
`ADVANCED_RATINGS_MIN_SEASON = 2022` in `client.js` to skip the wasted call for older seasons.

**Two real cache bugs found and fixed during this build, worth remembering for the NEXT column-shape
change to either of these tables:** (1) `computeAdvancedPbpAll`'s `advancedStats` Mongo cache is
version-gated (`v` field) — forgot to bump it first, so a local test hit served the stale 20-column
shape from cache instead of the newly-computed 24-column one. Bumped 27→28. (2) `computeSeasonPBP`'s
OWN per-season `playerSeasonPbp` cache has no version field at all (unlike `advancedStats`) — bumping
the outer `v` alone wasn't enough, because per-season rows came back from THIS cache still in the old
20-element shape. Fixed by suffixing the cache key itself (`-v2`) per `teamSeasonCache.js`'s own
documented "bump the key" invalidation convention. Bumping (1) before fixing (2) meant the very first
"fixed" test run baked the still-stale row into a v28 doc for a real player, in the shared production
Mongo — had to bump again (28→29) to get a clean recompute. **Lesson: when a season-level box-score
row shape changes, check BOTH the outer whole-career cache AND computeSeasonPBP's own per-season
cache — they're two independent caches, not one.**

Also fixed in passing (found while investigating why the v253/v254 deploy's release phase took ~15
minutes instead of the usual well-under-a-minute): `bdlFetch` had no per-request timeout at all — a
single stalled connection could hang a background script (no route-level timeout backstop, unlike a
live web request) forever with zero error output. Added `AbortSignal.timeout(20000)`.

**Verify:** lint/build/test (332 tests, 328 pass — 4 pre-existing unrelated failures in
`auth-jwt-secret-missing.test.js`, a local-env JWT_SECRET leak from `.env`, not caused by this
change), live Playwright on A'ja Wilson's Advanced tab at mobile width confirming the new columns
render with plausible values for both a past season and the live current season, and the Net Rating
sanity check (110.6 off - 98.8 def = 11.8 ≈ 11.7 actual, rounding only).

## 3. Clutch splits — Shipped, `655b17f`

Re-spiked live, 2026-08-22, before building (never trusted the 2026-08-21 brainstorm's summary of
the shape): `player_season_advanced_stats?scope=clutch` with no `measure_type` returns ALL FIVE
measure_type buckets (base/advanced/misc/scoring/usage) for that scope, not just base — needed to
pass `measure_type=base` explicitly to get just the box-score line the roadmap wanted. Also
confirmed the default `per_mode` is `totals` (summed across every clutch appearance that season —
e.g. "40 PTS" for a whole season of ~3min/game clutch minutes), not `per_game`; passed
`per_mode=per_game` explicitly so it reads like every other rate-stat tab on the site.

**Where it landed:** a new "Clutch" tab in the stat-type nav, own component (`ClutchTab.jsx`) —
NOT folded into the existing Splits tab (Home/Away/Monthly/By-Opponent), even though the UI shape
looks similar. Splits' `buildSplits` (`server/lib/gameSplits.js`) aggregates ESPN gamelog data into
groups-of-games; clutch is a single already-aggregated row per season/side straight from BDL, a
fundamentally different data source and shape (one row, not N grouped rows) — mirrored SplitsTab's
season-scoped fetch pattern instead (own season dropdown, Regular Season/Playoffs toggle), but kept
it a separate tab/component rather than stretching `buildSplits` to cover a case it doesn't fit.
Both season sides come back in one `/api/players/:id/clutch?season=Y` response so the Regular/
Playoffs toggle is a local swap, not a refetch.

**Bug found and fixed along the way:** `PlayerRoutePage.jsx` has its own `VALID_TABS` allowlist
for syncing the stat-type tab to the URL (`/player/:id/:tab`) — separate from, and not derived
from, `DetailedStats.jsx`'s `ALL_TABLE_TYPES`/`SOURCE_ACTIVE`. Adding a new tab there is easy to
forget to also add here: clicking "Clutch" DID switch the tab and fire its fetch, but the very next
render saw the URL's `:tab` param become `'clutch'`, which isn't in `VALID_TABS`, so the route-sync
guard immediately redirected back to the bare player URL — reverting to Per Game. Only visible live
(a Playwright network-tab check showed the `/clutch` fetch fire then abort); the server-side test
suite had no way to catch a client-side routing allowlist gap. Fixed by adding `'clutch'` to
`VALID_TABS`. **Lesson: a new stat-type tab needs THREE places updated, not two** —
`DetailedStats.jsx`'s `ALL_TABLE_TYPES`/`SOURCE_ACTIVE`/render branch, AND `PlayerRoutePage.jsx`'s
`VALID_TABS` — easy to miss the third since it's in a different file with no shared constant.

**Verify:** unit tests for `mapClutchStatsRow` (field mapping/null handling), full suite 334/338
(4 pre-existing unrelated JWT_SECRET failures, unchanged), lint/build clean. Live curl against
`/api/players/3149391/clutch?season=2025` matched the direct BDL spike exactly (regular: GP 15/MIN
3.1/PTS 2.7; playoffs: GP 6/MIN 4.9/PTS 2.3 — plausibly smaller/different than the season-long
per-game averages, as expected for a low-minutes clutch-only split). Live Playwright at 390x844
confirmed the same values render in the actual table for both season sides, with the toggle
switching without a refetch.

## 4. Scoring-distribution dashboard — Shipped, `aba847b`

`measure_type=scoring` — % of points from fastbreak, free throws, in the paint, mid-range, 2PT,
3PT, off turnovers, plus assisted-vs-unassisted splits for both 2PM and 3PM (and overall FGM). A
"how does this player score" view with nothing equivalent on the site before this.

**Re-spike correction:** the roadmap's own field list was right, but the *floor* wasn't checked
before this feature: a live spike across seasons (2015/2018/2021/2022) showed measure_type=scoring
returns no row at all before 2022 — it sits on the SAME newer tracking-data floor as
`ADVANCED_RATINGS_MIN_SEASON` (Off/Def/Net Rating + PIE), not the wider `BDL_MIN_SEASON` (2008)
floor Clutch splits use. Gated `getPlayerSeasonScoringDistribution` to `season >=
ADVANCED_RATINGS_MIN_SEASON` accordingly. The percentage math itself checked out exactly as
expected: `pct_pts_2_pt + pct_pts_3_pt + pct_pts_ft` sums to 1.0 (every point is a 2, a 3, or a
free throw); the paint/mid-range/fastbreak/off-turnovers fields are *overlapping* subsets of those
same points (a fastbreak make is still a 2 or a 3), not a fourth mutually-exclusive bucket — kept
in their own "Where It Happens" group rather than forced into one stacked total that would double-
count.

**Build:** own tab (`ScoringDistributionTab.jsx`), not folded into Advanced — same reasoning as
Clutch: percentage-of-total data doesn't fit BrefTable's numeric-column convention, so it gets a
hand-rolled bar presentation instead (three groups: a stacked bar for the 2PT/3PT/FT split, plain
horizontal bars for the overlapping "where it happens" categories, and paired stacked bars for
assisted-vs-unassisted). No new chart library — same "no chart lib in the project" posture as
ShotChart.jsx's hand-rolled SVG. Both season sides fetched together (one route, two provider
calls), Regular/Playoffs toggle is a local swap like Clutch and the generic tabs.

**Three-wiring-points lesson applied, not rediscovered:** `DetailedStats.jsx`'s
`ALL_TABLE_TYPES`/`SOURCE_ACTIVE`/render branch AND `PlayerRoutePage.jsx`'s `VALID_TABS` were all
updated in the same commit this time (see HANDOFF.md Traps, added after Feature 3's Clutch tab hit
exactly this bug) — verified live that navigating straight to `/player/3149391/scoring` holds the
URL with no redirect-back.

**Verify:** `node --test` (344 total, 340 pass, same 4 pre-existing unrelated JWT_SECRET failures;
new scoring-distribution test file 5/5 including a dedicated "sums to 1" assertion), lint/build
clean, live curl matching the original spike exactly (regular 65.5/8/26.5%, playoffs 69.6/5.6/
24.8%), live Playwright at 390x844 confirming the in-progress 2026 season (no playoffs toggle) and
the 2025 season (Playoffs toggle present, values matching curl exactly, and — checked via
`browser_network_requests` — exactly 2 fetches total across both season selections, confirming no
extra request fires on the Regular/Playoffs toggle itself).

## 5. Usage dashboard — Shipped, `7b91627`

`measure_type=usage` — % of team's rebounds/assists/steals/blocks/turnovers/FGA/FGM/FTA/FTM/
personal fouls (drawn and committed) while this player is on the floor, plus BDL's own overall
usage rate.

**Floor check (per Feature 4's own lesson — don't guess twice):** spiked 2015/2018/2021/2022
directly rather than assuming either floor. `measure_type=usage` shares the SAME 2022 tracking-data
floor as `measure_type=scoring`/`advanced` (`ADVANCED_RATINGS_MIN_SEASON`) — no row at all before
2022, first data at 2022.

**Build decision (the thing this section originally deferred):** own tab, not folded into
Advanced. Advanced already carries 24 columns (`ADV_HEADERS_SRV` in `server/lib/advancedStats.js`);
adding a full ~12-column usage-share family on top would make an already-dense BrefTable worse,
especially on mobile where it already needs horizontal scroll. Structurally this data IS a flat
BrefTable row like Clutch (one pre-aggregated row per season/side, all independent percentage
columns) — unlike Scoring Distribution's grouped/overlapping percentages, it reuses BrefTable +
`statColumns.js` directly rather than a custom bar presentation. New column keys are `TM_`-prefixed
(`TM_REB_PCT`, `TM_AST_PCT`, etc., plus `TM_USG_PCT`) rather than reusing this app's existing
`AST_PCT`/`REB_PCT`/`USG_PCT` keys already on the Advanced tab — those are a different (BRef-style,
box-score-derived) formula for a similarly-named stat, and could show different numbers for the
same player-season; reusing the same key/label would misread as the same stat repeated instead of
BDL's own on-floor team-share numbers.

**Three-wiring-points lesson applied again:** `DetailedStats.jsx` (`ALL_TABLE_TYPES`/
`SOURCE_ACTIVE`/render branch) AND `PlayerRoutePage.jsx`'s `VALID_TABS` updated in the same commit
— verified live that navigating straight to `/player/3149391/usage` holds the URL with no
redirect-back.

**Verify:** `node --test` (348 total, 344 pass, same 4 pre-existing unrelated JWT_SECRET failures;
new usage-share test file 4/4), lint/build clean, live curl matching the spike exactly (regular G
40, REB Sh% 37.2, AST Sh% 18.0, STL Sh% 24.8, BLK Sh% 56.1, TOV Sh% 23.4, FGA Sh% 30.5, FGM Sh%
33.7, FTA Sh% 48.3, FTM Sh% 49.6, PF Sh% 15.6, PFD Sh% 46.5, Usage% 30.7; playoffs G 12 row
matching too), live Playwright at 390x844 confirming the in-progress 2026 season (no playoffs
toggle, real BDL-tracked row since 2026 >= 2022) and the 2025 season (Playoffs toggle present,
values matching curl exactly, exactly 2 fetches total across both season selections via
`browser_network_requests` — confirming no extra request on the Regular/Playoffs toggle).

## 6. Defense dashboard (incl. Defensive Win Shares) — Shipped, `4e95747`

`measure_type=defense` (confirmed live, same endpoint as Clutch/Scoring/Usage) — blocks, steals,
def rebounds, and BDL's own DREB%/Defensive Rating/Defensive Win Shares, plus opponent-points-allowed
by category (paint/fastbreak/off-turnovers/2nd-chance). Shares the SAME 2022 tracking-data floor as
measure_type=scoring/usage/advanced (re-spiked 2015/2018/2021/2022 per this run's own standing
lesson — no row before 2022).

**Win-Shares cross-check (the flagged decision point) — RESOLVED, does not block this ship:**
Compared BDL's `def_ws` against this app's homegrown DWS (`statFormulas.js`'s `computeWinShares`,
full BRef/Oliver methodology, already splits OWS/DWS/WS internally) for A'ja Wilson, 2025 regular
season. Defensive Rating agrees almost exactly (BDL `def_rating` 98.8 vs homegrown `DEF_RATING` 98.8
from `/advanced-pbp-all`) — the two sources use compatible pace-adjusted rating math. But Defensive
Win Shares diverge materially: BDL `def_ws` (season total) 6.01 vs homegrown DWS 1.71, roughly 3.5x
apart — not a rounding difference, a genuinely different formula producing a genuinely different
number. Per this feature's own explicit caution, did NOT silently replace the homegrown DWS on the
Advanced tab. Instead shipped BDL's number as its own distinctly-labeled column, `BDL_DEF_WS` ("BDL
Def WS"), on the new Defense tab, alongside the existing Advanced tab's unchanged DWS — same
naming-collision-avoidance pattern as Usage's `TM_` prefix (`server/lib/statColumns.js`). **Flagging
for the user:** which Defensive Win Shares number is "more correct" for this league is a real product
call this run did not resolve on its own — both are visible now, unreconciled, until you weigh in.

**Build:** own tab (`DefenseTab.jsx`), not folded into Advanced — same reasoning as Usage (Advanced
is already dense; this is a fifth flat-column BDL-sourced stat family). Data shape is flat/independent
columns (not grouped like Scoring Distribution), so it reuses BrefTable directly, near-identical to
`UsageTab.jsx`/`ClutchTab.jsx`. `BLK`/`STL`/`DREB`/`DEF_RATING` reuse this app's existing column keys
(same literal stat, no formula divergence); `BDL_DREB_PCT` and `BDL_DEF_WS` are new, deliberately
distinct keys since BDL's own DREB% formula also diverged from the existing box-score-derived
`DRB_PCT` in the same spike (0.249 vs homegrown 0.193). The raw response's `pct_blk`/`pct_stl` fields
duplicate Usage's `TM_BLK_PCT`/`TM_STL_PCT` exactly (confirmed identical in the spike) — not
re-surfaced here, already covered by the Usage tab.

**Verify:** lint/build/test clean (0 new failures; same 4 pre-existing unrelated
`auth-jwt-secret-missing` failures as every prior feature). Live-verified on A'ja Wilson (id
3149391): dev-server curl for both 2025 regular and playoffs matched the spike exactly; Playwright
check on `/player/3149391/defense` held the URL with no redirect-back (three-wiring-points lesson
applied again — `DetailedStats.jsx` + `PlayerRoutePage.jsx`'s `VALID_TABS`), season-select + toggling
to Playoffs fired exactly one fetch per season (two total), zero extra fetch from the toggle click,
consistent with Clutch/Scoring/Usage's established pattern.

## 7. Team Four Factors (Team Stats page) — Shipped, `8d4e297`

`team_season_advanced_stats?measure_type=four_factors` (confirmed live, team-level only — the same
param returned empty at player level) — eFG%, TOV%, OREB%, FT rate, for the team **and** its
opponents. Dean Oliver's "Four Factors" framework — a well-established, well-regarded team-analytics
view with nothing equivalent on `TeamStatsPage.jsx` today. Re-spiked 2010/2015/2018/2021/2022 live
(Las Vegas Aces, BDL team id 8) per this run's own standing lesson: shares the SAME 2022
tracking-data floor as the player-level measure_type family (scoring/usage/defense/advanced), not
BDL_MIN_SEASON's wider 2008 floor. Confirmed the ratio fields (`efg_pct`/`oreb_pct`/etc) are
per_mode-invariant, same as the player-side percentage fields.

**Build:** `TeamStatsPage.jsx` read first — it's a single non-tabbed page (grouped stat cards, not
BrefTable), with no playoffs toggle anywhere, so Four Factors became two new `StatGroup` sections
("Four Factors" / "Four Factors (Opponent)") appended below the existing groups, fetched
independently via their own `/teams/:id/four-factors` route (regular season only, matching the
page's existing scope) rather than folded into the page's main `/teams/:id/stats` response --
keeps the BDL-only feature's graceful-degradation posture (pre-2022 seasons or ESPN-provider mode
just omit the section) fully decoupled from the main stats fetch's error/loading states. `ftRatePct`/
`oppFtRatePct` are named with a `Pct` suffix even though FT Rate isn't literally a made-shot
percentage, specifically so they route through this page's own `formatStatValue`'s existing
percent-style rendering (`efgPct`/`fgPct`/etc all already render as "NN.N%" here) -- a deliberate,
page-local display choice, distinct from the BRef-style `.XXX` rendering the player Advanced tab uses
for the same underlying stat family (`FTr`, `EFG_PCT`) elsewhere in the app.

**Verify:** lint/build/test clean (0 new failures; same 4 pre-existing unrelated
`auth-jwt-secret-missing` failures as every prior feature). Live-verified on Las Vegas Aces
(espn team id 17 / bdl team id 8): dev-server curl for season 2025 matched the spike exactly.
Playwright check on `/team/las-vegas-aces/stats` showed both new sections rendering correctly
alongside the existing groups for the current season; switching to season 2018 (pre-2022 floor)
correctly omitted the Four Factors sections entirely with no error surfaced and the rest of the page
unaffected -- confirms the graceful-degradation posture works end-to-end, not just at the API layer.

## 8. Team shot chart — Shipped, `521de41`

`team_shot_locations` confirmed live, 2026-08-22 (Las Vegas Aces, BDL team id 8): identical
`shot_zones` shape to the player-level `player_shot_locations` (same 7 real zones, same redundant
`corner_3` = left+right sum, same 2022 tracking floor -- confirmed empty at 2018/2021, first data at
2022). Built **both** framings rather than picking one, since the spike showed they're the same
endpoint with a single extra param: `measure_type` omitted (or `base`) returns the team's own shot
zones (`fga`/`fgm`/`fg_pct`); `measure_type=opponent` returns opponent zone FG% while facing this team
(`opp_fga`/`opp_fgm`/`opp_fg_pct`) -- the defensive-tendency framing, confirmed genuinely different
numbers from the team's own shooting in the live spike. A toggle switches between them client-side;
both come back from one `/api/teams/:id/shotchart` fetch (two parallel BDL calls server-side), so the
toggle is a local swap, not a refetch.

Extracted `ShotChart.jsx`'s hand-rolled SVG court component into `client/src/components/
CourtDiagram.jsx` (zones/coloring only -- `ZonePath`, `zoneColor`, the sigmoid color-anchor logic, and
the court-geometry paths) so `TeamShotChart.jsx` reuses the exact same rendering instead of
duplicating ~90 lines of SVG. `ShotChart.jsx` now imports from there; behavior unchanged.

Regular season only (`/teams/:id/four-factors`'s precedent) -- `TeamStatsPage.jsx` has no playoffs
toggle today. New section appended after Four Factors, own independent fetch, same
fetch-fails-gracefully posture as every other BDL-only section on that page.

**Verify:** lint/build/test all clean (357 tests, 353 pass, same 4 pre-existing unrelated
JWT_SECRET failures as every prior feature this run). Zone-sum-vs-total sanity check passed: live
spike summed to 2975 FGA / 1305 FGM across all 7 zones vs. the team's actual 67.6 FGA-pg / 29.7
FGM-pg over 44 games (2974.4 / 1306.8 expected -- matches within per-game-average rounding). Live
Playwright verify on `/team/las-vegas-aces/stats`: chart renders with real data; opponent toggle
swaps to genuinely different zone numbers with zero extra network fetch (confirmed via
`browser_network_requests` -- one `/shotchart` call total); 2018 (pre-floor season) correctly omits
the section with no error.

## 9. League shot-zone leaderboards — Shipped `0339d5e`

Confirmed reusable exactly as flagged: `leagueShotZones.js`'s `fetchAllShotZoneRows` bulk-pulls every
player's `/player_shot_locations` row for a season (cursor-paginated), but `aggregateLeagueZones`
immediately collapsed those rows into one league-wide average per zone and threw the per-player rows
away. Exported `fetchAllShotZoneRows` and reused it as-is in a new `leagueShotZoneLeaders.js` — no
new BDL endpoint or fetch path needed, exactly the "reshape, don't re-fetch" framing this section
originally called out.

**Identity gap found mid-build, not flagged in the original plan:** a `/player_shot_locations` row
carries a BDL player id + plain name (`{id, first_name, last_name, team}`), not this site's ESPN
player id, which every player-linking UI on the site routes by. The existing `idMap.js` only resolves
the other direction (ESPN name → BDL id, one player at a time, for per-player fetches). Added a
reverse `resolveEspnIdByName` to `idMap.js`: builds one in-process name→id index from
`getActivePlayers()` (in-memory) + the `playerIndex` Mongo collection (same source
`percentileClient.js`'s `loadPosMap` already reads for ~every historical player), memoized for the
process lifetime. Exact full-name match only; an ambiguous or zero match resolves to `null` rather
than guessing — a leaderboard row with an unresolvable name still shows (name, team, stats) with no
player-page link, rather than being dropped.

**Qualification floor:** `/player_shot_locations` carries no games-played/minutes field to gate on
(unlike `/player_season_stats`), so a fixed `MIN_ZONE_FGA = 20` (attempts in that specific zone, that
season) keeps a 1-of-1 flukey shooter off the board — a round, conservative number, not derived from
any league-wide qualification stat, and easy to tune later.

**Build:** new top-level page (`/leaders`, nav link added) rather than folding into an existing page —
no existing stats-index page was a natural fit. One `/api/league/shot-zone-leaders?season&postseason`
route returns all 7 zones' top-15 in a single response (`{season, zones: [{key, label, leaders:
[...]}]}`), same "fetch once, client-side zone tabs" pattern as Team Shot Chart's own/opponent toggle
— confirmed via `browser_network_requests` that switching zones triggers zero additional fetch, only
season/postseason changes refetch.

**Verify:** lint/build/357→362 tests (353→358 pass, same 4 pre-existing unrelated JWT_SECRET
failures), 5 new unit tests for `buildZoneLeaderboards` (ranking, tie-break, min-FGA floor, topN cap,
missing-player-id guard). Live-verified via Playwright at both the in-progress 2026 season and the
2022 floor season: zone tabs swap data with no extra fetch, season change refetches, every leader
name in both seasons resolved to a real ESPN id (spot-checked against known players — Elena Delle
Donne/Breanna Stewart/Nneka Ogwumike top the 2022 restricted-area board, all correctly linked),
clicking a row navigates to that player's real page (Jewell Loyd → `/player/2987869`, confirmed
correct).

## 10. Per-game advanced stats (Game Log)

`player_game_advanced_stats` (confirmed live) returns `misc`/`usage`/`scoring`/`advanced`/
`four_factors` **all in one response** for a single game, plus a `period` field (0 = full game;
confirmed the schema supports per-quarter, not yet spiked what period=1-4 actually returns). Game
Log currently shows only the basic per-game box-score line.

**Build:** likely an expandable row or a secondary view per game in `GameLogTab.jsx`/`BrefTable.jsx`
rather than cramming every one of these fields into the existing wide table — decide the exact UI
during build (this table is already dense; adding ~40 more columns per game is probably wrong).

**Verify:** lint/build/test, live check on a real game.

## 11. Injury report

`player_injuries` (documented in the OpenAPI spec, not yet spiked live). From the original
2026-08-17 backlog framing: natural fit as a team/player-page widget, ties into the existing
pre-game notification bell (`server/lib/notificationsJob.js`) — e.g. "your repped player is now
questionable" alongside the existing pre-game alert. Spike the actual endpoint shape first (status
values, injury description text, timestamps) before building.

**Build:** new provider method, likely a widget on player pages and team roster pages, plus a hook
into the notification job for repped-player status changes.

**Verify:** lint/build/test, live check against a real currently-injured player if one exists this
season, notification-path check (may need to simulate a status change since real injury timing is
unpredictable).

## 12. Odds/spread on schedule

`odds` / `odds/opening` (documented in the OpenAPI spec, not yet spiked live). From the original
2026-08-17 backlog framing: lighter-weight than a full props tracker — surface the betting line next
to each upcoming game on `TeamSchedulePage.jsx`. Spike the actual endpoint shape first (spread vs.
moneyline vs. total, which sportsbook(s), opening-vs-current semantics) before building.

**Build:** new provider method, new column/section on `TeamSchedulePage.jsx`'s upcoming-games view.

**Verify:** lint/build/test, live check against a real upcoming game's odds.

---

When every feature above ships, delete this doc's per-feature detail (keep a one-paragraph "shipped
2026-0X-XX, see git log" summary, matching this folder's convention for closed-out docs) and update
`design.md`'s index status column to "Shipped."
