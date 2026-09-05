# Reference-site features roadmap

Started 2026-09-05, from a two-pass audit of what's fetched-but-unrendered and what standard
basketball-reference-style features KnowTheW lacks entirely, done after the BDL expansion roadmap
(`bdl-expansion-roadmap.md`) exhausted the BDL WNBA endpoint surface. That audit found the endpoint
list itself has nothing left to add (player props aside, still deferred) — the remaining gaps are
either fields already in already-fetched responses that never reach the UI, or whole pages/features
that don't exist yet but are buildable from data already flowing through the app. Moneyline odds
display was raised in the same audit and explicitly skipped by the user (2026-09-05) — not queued
here.

Executing one feature at a time, same cadence as the BDL roadmap: commit + lint/build/test + live
verify + push/deploy per feature, this doc updated after each ships.

## Queue

1. **Plus/Minus stat** — shipped 2026-09-05. `plus_minus` on `WNBAPlayerStat` was fetched on every
   per-game stat row and never parsed or shown anywhere; added a new `'+/-'` Game Log column
   (BDL's `buildStatsBag` and ESPN's shared `LABELS`/`columnFor` contract both updated so the two
   providers can't drift). Added a new BrefTable `kind: 'signed'` (renders a leading "+" for
   positive values, e.g. "+19"/"-7") since plain `'num'` doesn't distinguish sign. Also had to widen
   `schemas.js`'s `GameLogColumn.kind` enum (`z.enum(['pct','num'])` → adds `'signed'`) — its
   shape-drift validator caught the new kind as an unexpected value on the very first live request,
   confirming that guard actually works. Verified live against A'ja Wilson's 2025 game log
   (real values: -22 on a loss, +19/+33 on wins).
2. **League Leaders page** — shipped 2026-09-05. New `/league-leaders` page (nav link "League
   Leaders", alongside the existing "Shot Zone Leaders") ranking the same qualified entries
   `getLeagueStatLines(season, mode)` already produces for the percentile system -- no new bulk
   fetch. Both providers' `mapLeagueStatLine`/`mapBdlLeagueStatLine` now carry identity
   (name/teamAbbr/bdlPlayerId for BDL, name/espnId for ESPN) alongside the stat values, since the
   existing function was percentile-math-only and stripped it; the extra fields are inert for that
   consumer (it only ever plucks named `PERCENTILE_STATS` keys). New shared `lib/leagueLeaders.js`
   does the ranking; BDL rows get bridged to this site's ESPN id by name via `idMap.js`'s
   `resolveEspnIdByName` (same pattern `getLeagueShotZoneLeaders` already established), batched
   once per unique name. Categories: PTS/REB/AST/STL/BLK/FG%/3P%/FT%, top 10, PerGame or Totals.
   Works back to 2002 (ESPN's byathlete floor); pre-2008 (true ESPN path, before `BDL_MIN_SEASON`)
   has no team abbreviation since ESPN's byathlete feed carries no team field -- renders "—",
   same convention as any other missing team elsewhere on the site. Verified live via curl (BDL
   2015/2025 seasons and the true pre-2008 ESPN-only path, 2005) and then via claude-in-chrome
   against the running dev client -- Per Game/Totals toggle, a percentage category (FG%), and
   row-click-to-player-page all confirmed working with real data.
3. **Awards History hub** — `server/constants/wnbaAccolades.js` already has a full year-by-year
   MVP/DPOY/ROY/Finals MVP/Sixth Player/All-WNBA dataset, currently consumed only by Compare page
   verdict chips. New standalone page surfacing it by year/category.
4. **Injury Report hub** — `server/providers/balldontlie/injuries.js` already pulls the full
   league-wide `/player_injuries` list (~40 rows) for per-player/roster widgets. New page reusing
   that same bulk pull directly.
5. **Odds/Betting hub** — `server/providers/balldontlie/odds.js` already calls `/odds` against an
   explicit `game_ids[]` list (currently one team's schedule). New page hands it the full upcoming
   slate instead.
6. **Game Box Score page** — the structural gap: no `/game/:id` route exists at all, so Schedule
   and Game Log rows are dead ends. Assembles `games/{id}` (final score) + `player_stats` (both
   box lines) + `team_stats`, all already fetched elsewhere for other features. Bundles in the
   quarter-by-quarter score line (aggregate `/plays`' running `home_score`/`away_score` by
   `period` — not a stored field, derived). Needs real links wired in from `ScheduleTable.jsx` and
   the Game Log tab, which currently have none.
7. **Standalone play-by-play viewer** — full scrolling play log (`text`, `type`, `team`, `period`,
   `clock`, `scoring_play`, running score) as a companion tab/link on the Box Score page. `/plays`
   is already fetched per-game for on-court/starting-five computation; this renders the raw feed
   instead of only deriving from it.
8. **Notable games / single-game records** — highest-scoring game, most assists in a game, etc.
   Scans the existing per-season bulk `/player_stats` pull already fetched and cached for the
   percentile system — no new endpoint, a new scan-and-rank pass over data already in hand.
9. **All-time / career league leaders** — no existing helper sums a stat across a player's whole
   career league-wide (existing career-total helpers in `advancedStats.js`/`per100Stats.js` sum one
   player's own seasons only). Needs a new aggregation job pulling full season history per player.
10. **Franchise all-time leaders** — same aggregation as #9, scoped to one `team_id`.
11. **Team-vs-team head-to-head record** — feasibility gated on a live check first: BDL's
    `/wnba/v1/games` `team_ids[]` param semantics (AND both teams in the same game, vs. OR either
    team) aren't documented in the schema. Test live before designing; build only if AND-filtering
    (or an equivalent two-call approach) works. Skip if it doesn't pencil out cleanly.
12. **`measure_type=misc`/`opponent` advanced-stat bundles** — never called by either provider.
    `WNBAAdvancedStats`'s schema is `additionalProperties: true`, so the actual fields aren't
    enumerable without a live sample response. Pull one live response first; build only if it
    surfaces something worth a UI (e.g. points off turnovers, second-chance points, fast-break
    points) — skip if it's redundant with Four Factors/existing Advanced tab fields.

## Not queued — confirmed not buildable

- **Draft-class/draft-year browsing** — no such field on `WNBAPlayer` at all.
- **Standings streak/last-10 columns** — no such field on `WNBAStanding`; would need full
  game-history derivation per team, not a missed field. Revisit only if #9's career-aggregation
  job ends up building a full per-team chronological game history anyway (it wouldn't reuse
  directly, but the derivation shape would be similar).
- **Playoff bracket page** — not researched in either audit pass. Worth a feasibility pass of its
  own later; not assumed dead, just unscoped.
