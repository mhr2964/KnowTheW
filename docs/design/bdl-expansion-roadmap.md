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
| 5 | Usage dashboard | Not started |
| 6 | Defense dashboard (incl. Defensive Win Shares) | Not started |
| 7 | Team Four Factors (Team Stats page) | Not started |
| 8 | Team shot chart | Not started |
| 9 | League shot-zone leaderboards | Not started |
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

## 5. Usage dashboard

`measure_type=usage` (confirmed live) — % of team's rebounds/assists/steals/blocks/turnovers/FGA/
FGM/FTA/FTM/personal fouls (drawn and committed) while this player is on the floor. Richer than the
single `USG_PCT` column the site shows today.

**Build:** likely folds into the existing Advanced tab as additional columns, or its own tab if it
ends up crowding Advanced. Decide during build based on how many columns Advanced already has once
#2 lands.

**Verify:** lint/build/test, live check against a real player.

## 6. Defense dashboard (incl. Defensive Win Shares)

`measure_type=defense` (confirmed live) — blocks, steals, DREB%, Defensive Rating, and a literal
`def_ws` (Defensive Win Shares) field BDL computes server-side, plus opponent-points-allowed by
category (fastbreak/paint/2nd-chance/off-turnovers). The site currently has no defensive-specific
view at all beyond raw STL/BLK counts and the homegrown Win Shares total (offense+defense combined,
not split).

**Build:** new tab, or extends Advanced. Def Win Shares specifically is worth cross-checking against
whatever the homegrown `computeWinShares` produces today, if that function separates offensive/
defensive shares internally — could be a genuine accuracy upgrade opportunity, not just a new column
(verify before assuming — don't silently replace the homegrown number without confirming BDL's is
actually more correct for this league).

**Verify:** lint/build/test, live check, and the Win-Shares cross-check above if it turns out
relevant.

## 7. Team Four Factors (Team Stats page)

`team_season_advanced_stats?measure_type=four_factors` (confirmed live, team-level only — the same
param returned empty at player level) — eFG%, TOV%, OREB%, FT rate, for the team **and** its
opponents. Dean Oliver's "Four Factors" framework — a well-established, well-regarded team-analytics
view with nothing equivalent on `TeamStatsPage.jsx` today.

**Build:** new section on `TeamStatsPage.jsx` (check what that page currently shows before deciding
whether this is a new tab-within-team-stats or an added section on the existing page).

**Verify:** lint/build/test, live check on a real team.

## 8. Team shot chart

`team_shot_locations` (documented in the OpenAPI spec, not yet spiked live) — same zone-aggregated
FG% shape as the existing player Shot Chart (`player_shot_locations`, shipped 2026-08-18), at the
team level. Two framings worth deciding between during build: "where this team shoots from" (team's
own shot zones) and "where this team allows shots" (opponent zone FG% while facing this team) — the
opponent framing is the more novel one, since no other feature on the site surfaces defensive
shot-location tendency. Confirm which (or both) before building, and spike the actual endpoint
response shape first (not yet done — everything else in this doc's spike section has been verified
live except this one).

**Build:** likely lives on `TeamStatsPage.jsx` or a new tab, reusing `ShotChart.jsx`'s existing
hand-rolled SVG court component (parameterize it to accept team-level zone data instead of only
player-level).

**Verify:** lint/build/test, live check, same zone-sum-vs-total sanity check the player version used
at ship time (`docs/design/provider-architecture.md`'s Shot Chart section).

## 9. League shot-zone leaderboards

`leagueShotZones.js` already aggregates all-player zone data server-side today — but only to anchor
the player Shot Chart's color scale, never surfaced as its own leaderboard. "Best corner-3 shooters
in the league," "most efficient rim scorers," etc. — mostly a new UI layer on data already being
computed, not a new data source.

**Build:** new page or a section on an existing stats-index page. Needs a real route exposing
per-player zone data league-wide (today's `getLeagueShotZones` returns *league averages*, not
per-player rows — check whether the underlying `/player_shot_locations` bulk pull this function
already does can be reshaped into per-player leaderboard rows, or whether a new aggregation path is
needed).

**Verify:** lint/build/test, live check that leaderboard ordering is sane (spot-check the known top
shooters in a real zone).

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
