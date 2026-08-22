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
| 1 | Site IA rework: Teams page, Standings page, real homepage, nav | Not started |
| 2 | Off/Def/Net Rating + PIE on the existing Advanced tab | Not started |
| 3 | Clutch splits | Not started |
| 4 | Scoring-distribution dashboard | Not started |
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

**Verify:** lint/build/test, live Playwright at mobile + desktop for the new nav, Teams page (parity
with today's home grid), Standings page (real data, correct conference grouping/sort), and the new
homepage layout.

## 2. Off/Def/Net Rating + PIE on the existing Advanced tab

Sitting unused on the endpoint the Advanced tab already calls. `player_season_advanced_stats`'s
default (`measure_type=advanced`, `scope=general`) response includes `off_rating`, `def_rating`,
`net_rating`, `pie`, and their `_e` ("estimated") variants and `_rank` counterparts — none of which
`advancedStats.js`'s homegrown formulas compute (that path does TS%/eFG%/USG%/AST%/ORB%/DRB%/TRB%/
STL%/BLK%/PER/Win Shares). Zero new endpoint — just reading more fields off a response already
being fetched, or adding this as columns from a second field-set. Confirm during build whether
these fields are already present in whatever BDL response the codebase currently stores/discards,
or need a new fetch call with the right `measure_type`.

**Build:** extend `AdvancedTab.jsx` (and whatever server-side shaping feeds it) with the new
columns. Likely the smallest feature on this list — good second slot to build momentum before the
heavier dashboard features below.

**Verify:** lint/build/test, live Playwright on a real player's Advanced tab confirming the new
columns render with plausible values (cross-check one player's Net Rating against Off - Def
manually as a sanity check).

## 3. Clutch splits

`player_season_advanced_stats?scope=clutch` (confirmed live, 2026-08-21) returns a full box-score
line (pts/reb/ast/fg%/etc, all the base counting stats) filtered to clutch situations, plus fantasy
points fields. No measure_type combination needed beyond the scope param — same season-level shape
already rendered elsewhere.

**Build:** likely a new toggle/tab alongside the existing season view (similar pattern to the
Playoffs toggle just shipped this session) rather than a wholly new page — "Clutch" reads as a
lens on existing stats, not a separate stat category. Confirm exact UI placement before building
(new tab under the stat-type nav vs. a toggle on the existing Advanced tab).

**Verify:** lint/build/test, live check that clutch numbers are plausibly different from (and
smaller-sample than) the season-long numbers for a real player.

## 4. Scoring-distribution dashboard

`measure_type=scoring` (confirmed live) — % of points from fastbreak, free throws, in the paint,
mid-range, 2PT, 3PT, off turnovers, plus assisted-vs-unassisted splits for both 2PM and 3PM. A "how
does this player score" view with nothing equivalent on the site today.

**Build:** new tab or new section within the Advanced tab. Needs its own visual treatment (this is
percentage-of-total data, not raw counts — probably a stacked-bar or simple percentage-table
presentation, not the standard BrefTable numeric-column format).

**Verify:** lint/build/test, live check that the percentages for a real player sum to something
sane (all `pct_pts_*` categories should roughly cover 100% of total points).

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
