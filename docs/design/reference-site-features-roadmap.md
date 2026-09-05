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
3. **Awards History hub** — shipped 2026-09-05. New `/awards` page (nav link "Awards") over
   `server/constants/wnbaAccolades.js`'s existing year-by-year MVP/Finals MVP/DPOY/ROY/Sixth
   Player/All-WNBA First Team dataset, previously consumed only by Compare page verdict chips.
   Not provider-dependent (static historical fact, not a stats-provider concern), so
   `lib/awardsHistory.js` is a plain module the route calls directly, not a SportsDataProvider
   method. Preparatory refactor: `resolveEspnIdByName` (name -> this site's ESPN id) moved out of
   `providers/balldontlie/idMap.js` into `lib/playerNameIndex.js` first, since it turned out to
   have no actual BDL dependency and this feature needed the identical bridge from a source that
   has nothing to do with BallDontLie -- reaching into a provider-specific directory for a
   provider-neutral utility would have been a new architectural inconsistency. Verified live via
   curl (correct year-descending rows, real resolved ids, 2002's real ROY gap rendering as "—" not
   a missing row) and via claude-in-chrome against the running dev client (table renders, a
   resolved name correctly navigates to that player's page).
4. **Injury Report hub** — shipped 2026-09-05. New `/injuries` page (nav link "Injury Report")
   reusing `injuries.js`'s existing bulk `/player_injuries` pull (~40 rows) via a new
   `fetchLeagueInjuriesBdl` (unfiltered, vs. the per-player/per-team filtered versions already
   used elsewhere), with `teamAbbr` read off each row's nested `player.team` (confirmed live --
   not previously read anywhere). Same name->ESPN-id bridge as Features 2/3. Reuses the existing
   `InjuryPill` component for the status column, so styling matches the player/roster widgets
   exactly. Caught and fixed a real CSS bug live: the new free-text comment column's override
   class lost a specificity fight against `.standings-table td`'s existing `white-space: nowrap`
   rule, silently rendering every comment as one unreadably wide, non-wrapping row -- fixed by
   scoping the selector to match (`.standings-table td.injury-report-comment`). Also confirmed
   live (not a design decision, an observed BDL data quality issue): BDL's own player bio fields
   are unreliable on this endpoint (`weight: "Maryland"` on a real row -- clearly a college value
   in the wrong field), reinforcing why this site sources bio data from ESPN rather than BDL.
5. **Odds/Betting hub** — shipped 2026-09-05. New `/odds` page (nav link "Odds") over a new
   `leagueOdds.js`: pulls the full league-wide upcoming slate (`/games`, 7-day window, no
   `team_ids[]` filter -- genuinely new, `odds.js`'s existing fetch only ever took an
   already-known game-id list from one team's own schedule) and hands those ids to `odds.js`'s
   existing `fetchOddsForGamesBdl` unchanged. No player-id bridge needed here (odds are
   game-scoped, not player-scoped). Caught two real issues live: (1) at ship time the league is
   mid-schedule-gap (nearest game 2026-09-17, ~12 days out -- confirmed via a wider 30-day probe,
   not a bug, likely a FIBA World Cup break per injury comments elsewhere) — the hub's empty state
   ("No upcoming games in the next week") is what's actually correct right now, not a broken
   feature; (2) the upcoming-slate fetch had no cache at all, unlike every other BDL fetch in this
   provider — a fresh `/games` + `/odds` round trip on every single visitor, ~15-20s cold,
   confirmed live via claude-in-chrome (page stuck on "Loading odds..." far longer than any other
   page shipped this roadmap). Fixed with the same short `CURRENT_SEASON_TTL_MS` in-memory cache
   the rest of this provider's live/current-season data already uses — confirmed the fix live
   (cold request ~4s, cached repeat ~44ms).
6. **Game Box Score page** — shipped 2026-09-05. New `/game/:id` route (`GameBoxScorePage.jsx`) —
   the structural gap this whole roadmap flagged first: no per-game page existed at all, so
   Schedule/Game Log rows were dead ends. BDL-only (this site's schedule/game-log events ARE BDL
   game ids once BDL-sourced, see `schedule.js`'s header comment) — new `boxScore.js` assembles
   `/games/{id}` (final score), `/player_stats?game_ids[]=` (both teams' full box lines),
   `/team_stats?game_ids[]=` (team totals; no `pts` field on that endpoint, computed the same
   `2*fgm+fg3m+ftm` formula `plays.js`'s `toTeamStatsRow` already uses), and a **fresh, separate**
   `/plays` fetch for quarter-by-quarter scoring (deliberately NOT reusing the existing PBP
   attribution cache in `gamePbpCache.js` — that cache's rows are trimmed to drop
   `period`/`clock`/`home_score`/`away_score` specifically to avoid the Mongo storage-bloat
   incident documented in `plays.js`'s `trimPlay` comment; reusing it would silently omit exactly
   the fields this feature needs). Quarter score per period = that period's last play's cumulative
   running score minus the prior period's. Same name-based ESPN-id bridge as every other BDL
   leaderboard feature this roadmap has shipped, for per-player row links.
   `ScheduleTable.jsx` rows now link through for completed, BDL-covered-season games (regular
   season only — playoffs stay ESPN-sourced with no BDL game id to link to at all). **Scope
   decision:** Game Log rows were NOT wired the same way — their row-click already does something
   real (expanding Feature 10's inline per-game advanced-stats panel); overloading that same click
   for navigation would have silently removed a shipped feature rather than adding one. The
   Schedule fix alone resolves the dead-end this feature was named for.
   Verified fully live: curl confirmed the assembled response byte-for-byte (final score, all four
   quarters summing correctly, every player row, team totals), then claude-in-chrome confirmed the
   rendered page matches exactly, a player row correctly navigates to that player's page, and a
   real Schedule row click lands on the exact right game's box score.
7. **Standalone play-by-play viewer** — shipped 2026-09-05, as a "Play-by-Play" tab on the Box
   Score page (Feature 6), not a separate route -- the same fresh `/plays` fetch `boxScore.js`
   already made for quarter scores is reused directly (zero additional cost), mapped to a flat,
   chronologically-sorted feed with `team` resolved to `'home'`/`'away'` (not a raw BDL id) so the
   client needs no team-identity knowledge at all. Grouped by period client-side, scoring plays
   highlighted, running score shown per play. Verified live: curl confirmed the play feed against
   the same real game as Feature 6 (412 plays, correctly ordered, real descriptions), then
   claude-in-chrome confirmed the rendered tab matches exactly.
8. **Notable games / single-game records** — shipped 2026-09-05. New `/notable-games` page (nav
   link "Notable Games"), top-10 single-game performances (PTS/REB/AST/STL/BLK) for a selected
   season, each row linking through to that exact game's box score (Feature 6) since the gameId
   is already this site's own BDL-native id. BDL-only (season >= 2008) — no ESPN equivalent, since
   ESPN's percentile-system fetch is per-athlete season averages, not per-game rows, so there's no
   comparable bulk data to scan pre-2008.
   **Real refactor, not just a new feature:** the per-game bulk `/player_stats` pull this needed
   was previously fetched inline inside `getLeagueReboundFoulStatsBdl` with no shared cache of the
   raw rows (only its aggregated output was cached) — extracted into a new
   `fetchBdlPlayerStatsRows(season)`, cached once per season, so this feature and the existing
   rebound/foul percentile enrichment now share one fetch instead of two.
   **Live investigation, not a bug:** the first verification attempt against the live dev server
   timed out repeatedly (2+ minutes with zero response). Direct diagnostic (paginating
   `/player_stats` page-by-page with per-page timing) showed pages typically take ~150-300ms each,
   but one page took **57 seconds** — a genuine BDL-side latency spike, not an infinite loop or a
   bug in this code. A season with many games elapsed can have 60-100+ pages, so even one or two
   such spikes push total cold-load time well past a minute; confirmed the full pipeline does
   complete correctly (137s on that run) and that the shared per-process cache makes every
   subsequent request for that season instant (~50-60ms). This is the same class of cold-load risk
   the percentile system has always carried for this exact per-game-bulk-pull pattern (see
   `leagueStats.js`'s own "~12s cold" comment, likely written when seasons had fewer games played)
   — worth adding to a production warming routine eventually, but out of scope for this feature
   (the existing `scripts/seed-distributions.js` pre-warm approach is Mongo-cache-based and
   wouldn't help this in-process-only cache anyway; a real fix would need its own persistent cache
   or an actual startup prefetch, not a one-off CLI script).
   Verified fully live once the cold fetch completed: curl confirmed real, correct top performances
   for two different seasons, then claude-in-chrome confirmed the rendered page and a row's
   click-through to its exact box score.
9. **All-time / career league leaders** — shipped 2026-09-05. New `/all-time-leaders` page (nav
   link "All-Time Leaders"), career totals (PTS/REB/AST/STL/BLK) 2002-through-latest-completed-
   season. Turned out much cheaper than expected: rather than a per-player full-history fetch (one
   call per player, thousands of players -- too slow) or a per-game bulk scan like Feature 8's
   (thousands of rows per season), this loops `getLeagueStatLines(year, 'Totals')` -- the same
   lightweight, already-existing per-*season* bulk endpoint League Leaders already uses -- across
   every year 2002-latestCompletedSeason() and sums. New `lib/careerLeaders.js` holds the
   accumulation; a player whose career spans both the ESPN era and the BDL era merges under one
   identity by resolving every BDL-era name to this site's ESPN id once, across all years combined
   (not once per year). Deliberately caps at `latestCompletedSeason()`, not the in-progress season
   -- same reproducibility reasoning that constant's own doc gives for percentile
   distributions/fingerprints (a career total that jitters with every live game is worse than one
   frozen to completed seasons). 1997-2001 isn't included -- that era lives only in the separate
   hand-curated legacy-bulk dataset, with no live per-season stat-line API to loop over.
   Caught and fixed a real display bug live: Totals mode is already an approximation (per-game
   average × games played, not a true sum -- same method both providers' `mapLeagueStatLine`
   functions already use), so summing it across 15+ seasons compounds into visible float noise
   (e.g. `7894.590000000001`) -- fixed by rounding for display, since showing fake sub-point
   precision on a career total would be worse than rounding an already-approximate number.
   Verified live: the real result topped by Diana Taurasi at 9,850 career points across 16
   seasons matches her actual real-world standing as the WNBA's all-time leading scorer --
   a strong independent correctness check the math is right, not just internally consistent.
   Confirmed via claude-in-chrome that the page renders correctly and a leader's row correctly
   navigates to their real player page.
10. **Franchise all-time leaders** — **descoped 2026-09-05, not shipped.** Built (same
    accumulation as #9, filtered by team), then withdrawn before commit after live verification
    surfaced a real BDL data-integrity bug this feature would have shipped on top of: `/player_
    season_stats` -- the per-season endpoint `getLeagueStatLines` (and therefore Feature 2's
    League Leaders and Feature 9's All-Time Leaders) is built on -- returns a player's **current**
    team for every historical season queried, not their team at the time. Confirmed live: Jewell
    Loyd's real 2018 season (`/player_season_stats?season=2018`) reports team `"Las Vegas Aces"`
    (her 2025+ team) instead of `"Seattle Storm"` (her actual 2018 team, confirmed correct via the
    per-game `/player_stats` endpoint for the same season -- that endpoint IS historically
    accurate, since it's tied to a specific past game record, not a mutable current-roster
    pointer). A franchise filter built on the buggy field would have silently attributed a large
    share of a traded player's whole career to whichever team they happen to be on now --
    confirmed concretely: querying the built-but-unshipped code for the Las Vegas Aces showed
    Jewell Loyd with "11 seasons" on LV, when she only actually joined the team in 2025.
    **This is a real bug in already-shipped code, not just a blocker for this one feature** --
    League Leaders' team column can show a wrong team for any traded player when viewing a past
    season (the stat VALUES themselves are unaffected, only the team label). All-Time Leaders
    (#9) is less affected in practice: its team display already shows "most recent team" by
    design, which happens to coincide with what the buggy field returns anyway, so it isn't
    visibly wrong even though it's accidentally-not-wrong rather than correctly-designed.
    A real fix needs to derive team-per-season from per-game data instead (the pattern
    `seasonStats.js`'s `aggregateToSeasonRow` already uses for the single-player path, which is
    NOT affected by this bug for exactly that reason) -- either a per-league-season bulk `/plays`-
    style scan (expensive, Notable Games' cost profile) or some cheaper derivation not yet found.
    Out of scope to fix within this roadmap; flagged in `HANDOFF.md`'s Traps for a dedicated pass.
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
