// BallDontLie hybrid provider. NOT a pure BDL reimplementation of SportsDataProvider -- a facade
// that delegates most methods straight through to the ESPN provider (imported directly, not via
// getProvider(), to avoid recursion) and only takes over specific methods, season-conditionally,
// where BDL's data is both available and worth the swap. See docs/design/provider-architecture.md
// for the full reasoning.
//
// Delegates to ESPN forever (out of scope for this swap): teams/rosters, player-basics,
// getGameLogEvents (no external consumers -- getRegularSeasonEventIds below already bypasses it
// for BDL seasons), getPlayoffSchedule (round labels have no BDL equivalent -- see schedule.js),
// getLeaguePlayerIndex (identity-bearing, needs the reverse BDL->ESPN id map Part 3 builds --
// deliberately not touched here), active-player lookups, and getStandingsRaw specifically (its
// only consumer, historyAggregator.js, depends on ESPN's exact conference/seed shape -- no accuracy
// motivation to touch it, only risk).
//
// Season-conditional (BDL for season >= BDL_MIN_SEASON, else ESPN delegate): team season stats,
// player game log, regular-season team schedule (Phase 1a/2, below), the play-by-play family
// (Phase 2 of the original PBP build, below -- naming predates the later ESPN-migration phase plan
// and wasn't renumbered to avoid churn), and getLeagueStatLines/getLeagueReboundFoulStats (Part 2,
// below).
//
// Whole-career merge, not season-conditional (Phase 1b): getPlayerSeasonStats. One call spans a
// player's entire career, so it can't just pick one provider per call -- see seasonStats.js.
// getPlayerSeasonAverages (Part 2, below) is the same shape of problem, solved by reusing
// getPlayerSeasonStats's already-correct per-season split -- see leagueStats.js.
//
// BDL has no WNBA data before ~2008 (confirmed by spike); this site's own league-average table
// goes back to 1998 -- hence the cutoff rather than a full replacement.
//
// Shot chart: NOT a migration -- ESPN has no shot-location data at all, so this is genuinely new
// capability (getPlayerShotChart), gated on its own season floor (SHOT_CHART_MIN_SEASON, 2022) since
// zone tracking is a much newer BDL feed than the rest of this provider's coverage. See shotChart.js.

const espn = require('../espn');
const bdlTeamStats = require('./teamStats');
const bdlPlays = require('./plays');
const bdlGameLog = require('./gameLog');
const bdlGameAdvancedStats = require('./gameAdvancedStats');
const bdlSchedule = require('./schedule');
const bdlSeasonStats = require('./seasonStats');
const bdlShotChart = require('./shotChart');
const bdlLeagueShotZones = require('./leagueShotZones');
const bdlLeagueShotZoneLeaders = require('./leagueShotZoneLeaders');
const bdlLeagueStats = require('./leagueStats');
const bdlStandings = require('./standings');
const bdlAdvancedRatings = require('./advancedRatings');
const bdlClutchSplits = require('./clutchSplits');
const bdlScoringDistribution = require('./scoringDistribution');
const bdlUsageShare = require('./usageShare');
const bdlDefenseStats = require('./defenseStats');
const bdlTeamFourFactors = require('./teamFourFactors');
const bdlTeamShotChart = require('./teamShotChart');
const bdlInjuries = require('./injuries');
const bdlOdds = require('./odds');
const bdlLeagueOdds = require('./leagueOdds');
const bdlBoxScore = require('./boxScore');
const bdlNotableGames = require('./notableGames');
const idMap = require('./idMap');
const { BDL_MIN_SEASON, SHOT_CHART_MIN_SEASON, ADVANCED_RATINGS_MIN_SEASON } = require('./client');
const { SportsDataProvider } = require('../SportsDataProvider');
const { withValidation } = require('../validation');
const { aggregatePBPSummary } = require('../pbpAggregate');
const { buildLeaderboards } = require('../../lib/leagueLeaders');
const { resolveEspnIdByName } = require('../../lib/playerNameIndex');

const usesBdl = (year) => Number(year) >= BDL_MIN_SEASON;

class BallDontLieProvider extends SportsDataProvider {
  get name() { return 'balldontlie'; }

  // --- ESPN-forever passthroughs ---
  getTeams() { return espn.getTeams(); }
  getRoster(...a) { return espn.getRoster(...a); }
  getHistoricalRoster(...a) { return espn.getHistoricalRoster(...a); }
  getSeasonRoster(...a) { return espn.getSeasonRoster(...a); }
  getPlayoffSchedule(...a) { return espn.getPlayoffSchedule(...a); }
  getStandingsRaw(...a) { return espn.getStandingsRaw(...a); }
  getPlayerBasics(...a) { return espn.getPlayerBasics(...a); }
  getRetiredPlayer(...a) { return espn.getRetiredPlayer(...a); }
  getGameLogEvents(...a) { return espn.getGameLogEvents(...a); }
  getLeaguePlayerIndex(...a) { return espn.getLeaguePlayerIndex(...a); }
  getActivePlayers() { return espn.getActivePlayers(); }
  findActivePlayer(...a) { return espn.findActivePlayer(...a); }

  // --- Phase 1: team season stats, season-conditional ---
  getTeamStats(teamId, year) {
    return usesBdl(year) ? bdlTeamStats.fetchTeamStatsBdl(teamId, year) : espn.getTeamStats(teamId, year);
  }
  getTeamStatsRaw(teamId, year) {
    return usesBdl(year) ? bdlTeamStats.fetchTeamStatsRawBdl(teamId, year) : espn.getTeamStatsRaw(teamId, year);
  }
  getTeamPointsAllowed(teamId, year) {
    return usesBdl(year) ? bdlTeamStats.fetchTeamPtsAllowedBdl(teamId, year) : espn.getTeamPointsAllowed(teamId, year);
  }
  getTeamPointsAllowedRaw(teamId, year) {
    return usesBdl(year) ? bdlTeamStats.fetchTeamPtsAllowedRawBdl(teamId, year) : espn.getTeamPointsAllowedRaw(teamId, year);
  }

  // --- Phase 1b: player season stats, whole-career merge (not a per-call season switch -- see
  // seasonStats.js's header comment for why this method can't dispatch the same way the others do) ---
  getPlayerSeasonStats(playerId) {
    return bdlSeasonStats.getPlayerSeasonStatsBdl(playerId);
  }

  // --- Part 2 (5-part provider plan): percentile system, season-conditional. Migrated together,
  // not independently -- see leagueStats.js's header comment for why a partial migration would
  // silently corrupt percentile rankings (comparing a BDL-sourced value against an ESPN-sourced
  // distribution or vice versa). getLeagueStatLines/getLeagueReboundFoulStats dispatch per season
  // like the other Phase 1/2 methods; getPlayerSeasonAverages is whole-career like
  // getPlayerSeasonStats above, but internally correct per-season since it's built from that same
  // method's already-correctly-split rows. ---
  getLeagueStatLines(season, mode) {
    return usesBdl(season) ? bdlLeagueStats.getLeagueStatLinesBdl(season, mode) : espn.getLeagueStatLines(season, mode);
  }
  getLeagueReboundFoulStats(season) {
    return usesBdl(season) ? bdlLeagueStats.getLeagueReboundFoulStatsBdl(season) : espn.getLeagueReboundFoulStats(season);
  }
  getPlayerSeasonAverages(playerId) {
    return bdlLeagueStats.getPlayerSeasonAveragesBdl(playerId);
  }

  // Notable Games: BDL-only, no ESPN equivalent -- ESPN's percentile-system fetch is per-athlete
  // season averages (espn/leagueStats.js), not per-game rows, so there's no comparable bulk data
  // to scan pre-2008. See notableGames.js.
  getNotableGames(season) {
    return usesBdl(season) ? bdlNotableGames.getNotableGamesBdl(season) : { season: Number(season), categories: [] };
  }

  // League Leaders: ranks the same qualified entries getLeagueStatLines already produces (see
  // leagueLeaders.js) rather than a new bulk fetch. BDL rows carry no ESPN id at the endpoint --
  // bridged by name via lib/playerNameIndex.js's resolveEspnIdByName, same once-per-unique-name batching
  // getLeagueShotZoneLeaders uses (a stat leader can lead multiple categories). ESPN rows already
  // carry this site's canonical id (espnId), no bridge needed.
  async getLeagueStatLeaders(season, mode) {
    const entries = await this.getLeagueStatLines(season, mode);
    if (!entries.length) return { season: Number(season), mode, categories: [] };

    let withIds;
    if (usesBdl(season)) {
      const uniqueNames = new Set(entries.map(e => e.name).filter(Boolean));
      const idByName = new Map(await Promise.all(
        [...uniqueNames].map(async name => [name, await resolveEspnIdByName(name)])
      ));
      withIds = entries.map(e => ({ ...e, playerId: idByName.get(e.name) ?? null }));
    } else {
      withIds = entries.map(e => ({ ...e, playerId: e.espnId ?? null }));
    }

    return { season: Number(season), mode, categories: buildLeaderboards(withIds) };
  }

  // --- Phase 1a: player game log, season-conditional ---
  async getPlayerGameLog(playerId, season) {
    if (!usesBdl(season)) return espn.getPlayerGameLog(playerId, season);
    const bdlPlayerId = await idMap.resolveBdlPlayerId(playerId);
    if (bdlPlayerId == null) return null;
    return bdlGameLog.fetchPlayerGameLogBdl(bdlPlayerId, season);
  }

  // Per-game advanced box score: no season param -- gameId is already a BDL id (only ever present
  // on a BDL-sourced gamelog row in the first place, see gameLog.js's buildGameMetaMap), so there's
  // no usesBdl(season) gate to apply here the way getPlayerGameLog needs one.
  async getPlayerGameAdvancedStats(playerId, gameId) {
    const bdlPlayerId = await idMap.resolveBdlPlayerId(playerId);
    if (bdlPlayerId == null) return null;
    return bdlGameAdvancedStats.fetchPlayerGameAdvancedStatsBdl(bdlPlayerId, gameId);
  }

  // --- Shot chart: new data, not a migration -- no ESPN equivalent exists at all (see
  // shotChart.js's header comment). Own season floor (2022), not usesBdl/BDL_MIN_SEASON (2008) --
  // zone tracking is a much newer feed than the rest of this provider's BDL coverage. ---
  async getPlayerShotChart(playerId, season, postseason) {
    if (Number(season) < SHOT_CHART_MIN_SEASON) return null;
    const bdlPlayerId = await idMap.resolveBdlPlayerId(playerId);
    if (bdlPlayerId == null) return null;
    return bdlShotChart.fetchPlayerShotChartBdl(bdlPlayerId, season, postseason);
  }

  // League-wide per-zone FG% averages, for Shot Chart's color-scale anchor (each zone's hot/cold
  // should be relative to how that zone actually shoots league-wide, not a flat 50% -- see
  // leagueShotZones.js's header comment). Same season floor as getPlayerShotChart -- no averages
  // exist before zone tracking started.
  async getLeagueShotZones(season, postseason) {
    if (Number(season) < SHOT_CHART_MIN_SEASON) return null;
    return bdlLeagueShotZones.fetchLeagueShotZonesBdl(season, postseason);
  }

  // League shot-zone leaderboards: the bulk pull returns BDL ids/plain names with no ESPN identity
  // attached at the endpoint -- resolve each unique name to this site's ESPN id here (once per
  // unique name across all 7 zones, not once per leaderboard row -- the same player can lead
  // multiple zones) so the route layer never needs to know this is a BDL-specific identity bridge.
  // A name that fails to resolve (rare -- see lib/playerNameIndex.js's resolveEspnIdByName) still shows on the
  // board with playerId: null rather than being dropped, same graceful-degradation posture as an
  // unresolvable player elsewhere in this provider.
  async getLeagueShotZoneLeaders(season, postseason) {
    if (Number(season) < SHOT_CHART_MIN_SEASON) return null;
    const raw = await bdlLeagueShotZoneLeaders.fetchLeagueShotZoneLeadersBdl(season, postseason);
    if (!raw) return null;

    const uniqueNames = new Set(raw.zones.flatMap(z => z.leaders.map(r => r.name)));
    const idByName = new Map(await Promise.all(
      [...uniqueNames].map(async name => [name, await resolveEspnIdByName(name)])
    ));

    const zones = raw.zones.map(z => ({
      ...z,
      leaders: z.leaders.map(r => ({ ...r, playerId: idByName.get(r.name) ?? null })),
    }));
    return { season: raw.season, zones };
  }

  // --- Injury report: new data, no ESPN equivalent -- see injuries.js's header comment. ---
  async getPlayerInjuryStatus(playerId) {
    const bdlPlayerId = await idMap.resolveBdlPlayerId(playerId);
    if (bdlPlayerId == null) return null;
    return bdlInjuries.fetchPlayerInjuryBdl(bdlPlayerId);
  }

  // Same BDL-id/plain-name identity bridge as getLeagueShotZoneLeaders above -- resolve each row's
  // internal playerId by name, once per row (a team roster is small, unlike the league-wide
  // leaderboard case that resolves once per unique name across all zones).
  async getTeamInjuries(teamId) {
    const bdlTeamId = await idMap.resolveBdlTeamId(teamId);
    if (bdlTeamId == null) return [];
    const rows = await bdlInjuries.fetchTeamInjuriesBdl(bdlTeamId);
    return Promise.all(rows.map(async ({ playerName, ...rest }) => ({
      ...rest,
      playerName,
      playerId: await resolveEspnIdByName(playerName) ?? null,
    })));
  }

  // League-wide injury hub: same identity bridge, batched once per unique name across the whole
  // ~40-row list (a player only ever appears once here, but batching still avoids resolving the
  // same common name twice if it recurs) -- same pattern getLeagueStatLeaders uses.
  async getLeagueInjuries() {
    const rows = await bdlInjuries.fetchLeagueInjuriesBdl();
    if (!rows.length) return [];
    const uniqueNames = new Set(rows.map(r => r.playerName));
    const idByName = new Map(await Promise.all(
      [...uniqueNames].map(async name => [name, await resolveEspnIdByName(name)])
    ));
    return rows.map(({ playerName, ...rest }) => ({
      ...rest,
      playerName,
      playerId: idByName.get(playerName) ?? null,
    }));
  }

  // --- Betting odds: new data, no ESPN equivalent -- see odds.js's header comment. bdlGameIds are
  // already-BDL-native (this site's own schedule events ARE BDL games once BDL-sourced -- see
  // schedule.js's mapGameToScheduleEvent, `id: String(game.id)`), so there's no ESPN-id resolution
  // step here at all, unlike every other BDL provider method that takes this site's id. ---
  async getGameOdds(bdlGameIds) {
    const map = await bdlOdds.fetchOddsForGamesBdl(bdlGameIds);
    return Object.fromEntries(map);
  }

  // Single-game box score: BDL-only, no season-gate needed at this layer (the id ITSELF is only
  // ever a BDL id once a schedule/game-log row is BDL-sourced -- see schedule.js's header comment
  // and boxScore.js's own). A pre-BDL or playoff gameId simply won't resolve (getGameBoxScoreBdl
  // returns null on a 404 from /games/{id}), same graceful-degradation posture as other BDL-only
  // features.
  getGameBoxScore(bdlGameId) {
    return bdlBoxScore.getGameBoxScoreBdl(bdlGameId);
  }

  // League-wide odds hub: the upcoming slate ITSELF is new here (TeamSchedulePage.jsx's existing
  // odds attach only ever pulls one team's own schedule) -- see leagueOdds.js. No ESPN-id
  // resolution needed, same reasoning as getGameOdds above.
  getLeagueOdds() {
    return bdlLeagueOdds.getLeagueOddsBdl();
  }

  // --- Standings: new data, not a migration -- distinct from getStandingsRaw above, which stays
  // ESPN-only. `season` here is REQUIRED at the fetchStandingsBdl layer (BDL has no current-season
  // default -- see standings.js's header comment), so it's computed here, once, in the one place
  // that's allowed to guess "now."
  getStandings(season) {
    return bdlStandings.fetchStandingsBdl(season ?? new Date().getFullYear());
  }

  // --- Phase 2 (ESPN-migration plan): regular-season schedule, season+seasontype-conditional ---
  // Playoffs (seasontype 3) always stay ESPN, regardless of season -- BDL has no round-label
  // equivalent (see schedule.js's header comment). getPlayoffSchedule above is unaffected -- it's
  // always seasontype 3 by definition, so it was never a BDL candidate here.
  getTeamSchedule(teamId, season, seasontype = 2) {
    if (seasontype === 3 || !usesBdl(season)) return espn.getTeamSchedule(teamId, season, seasontype);
    return bdlSchedule.fetchTeamScheduleBdl(teamId, season);
  }

  // --- Phase 2 (original PBP build): play-by-play family, season-conditional ---
  //
  // getGamePbpStats(eventId, playerId, season) dispatches on the opaque eventId's own prefix to
  // know whether to hit ESPN or BDL. getRegularSeasonEventIds tags BDL-sourced ids as "bdl:<id>";
  // bare ids stay ESPN's own format. Every consumer already treats event ids as opaque (confirmed:
  // playerAnalysis.js's pbp-table route loops and passes ids through without inspecting them), so
  // this string-prefix scheme is a drop-in, zero-consumer-change dispatch mechanism. `season` is
  // only used for gamePbpCache.js's isPastSeason gate -- never sent upstream.
  async getRegularSeasonEventIds(playerId, season, seasontype = 2) {
    if (!usesBdl(season)) return espn.getRegularSeasonEventIds(playerId, season, seasontype);
    const bdlPlayerId = await idMap.resolveBdlPlayerId(playerId);
    if (bdlPlayerId == null) return null;
    return bdlPlays.getRegularSeasonEventIdsBdl(bdlPlayerId, season, seasontype);
  }

  async getGamePbpStats(eventId, playerId, season) {
    if (typeof eventId === 'string' && eventId.startsWith('bdl:')) {
      const bdlGameId = eventId.slice(4);
      const bdlPlayerId = await idMap.resolveBdlPlayerId(playerId);
      if (bdlPlayerId == null) return { fetched: false, onCourt: null, boxscore: null };
      return bdlPlays.getGamePbpStatsBdl(bdlGameId, bdlPlayerId, season);
    }
    return espn.getGamePbpStats(eventId, playerId, season);
  }

  // Aggregation is shared with ESPN (../pbpAggregate.js) -- calls this.getGamePbpStats (not a bare
  // module reference) so the bdl: prefix dispatch above stays transparent from in here too, even
  // though every id in the BDL branch will already carry the prefix. Per-GAME caching (past seasons
  // only) lives inside getGamePbpStatsBdl/getGamePbpStats themselves now -- see gamePbpCache.js and
  // plays.js's fetchRawGameDataBdl -- so a season warmed by either tab benefits both, and players
  // who share a game only pay the real fetch cost once between them, not once each.
  async getSeasonPBPSummary(playerId, season, seasontype = 2) {
    if (!usesBdl(season)) return espn.getSeasonPBPSummary(playerId, season, seasontype);
    const eventIds = await this.getRegularSeasonEventIds(playerId, season, seasontype);
    if (!eventIds?.length) return null;
    return aggregatePBPSummary(eventIds, id => this.getGamePbpStats(id, playerId, season));
  }

  // Off/Def/Net Rating + PIE: new capability, not a migration -- ESPN has no season-level advanced-
  // stats endpoint at all (see espn/index.js). Season-gated like every other BDL method (usesBdl),
  // since BDL has no WNBA data before 2008.
  async getPlayerSeasonRatings(playerId, season, seasontype = 2) {
    if (Number(season) < ADVANCED_RATINGS_MIN_SEASON) return null;
    const bdlPlayerId = await idMap.resolveBdlPlayerId(playerId);
    if (bdlPlayerId == null) return null;
    return bdlAdvancedRatings.fetchPlayerSeasonRatingsBdl(bdlPlayerId, season, seasontype);
  }

  // Clutch splits: new capability, not a migration -- ESPN has no clutch-filtered box score at all.
  // Uses the general BDL floor (usesBdl/BDL_MIN_SEASON), not ADVANCED_RATINGS_MIN_SEASON -- these are
  // base counting stats (PTS/REB/AST/etc), the same data class as the rest of this provider's
  // season-conditional coverage, not the newer tracking-data feed Off/Def/Net Rating + PIE need.
  async getPlayerSeasonClutch(playerId, season, seasontype = 2) {
    if (!usesBdl(season)) return null;
    const bdlPlayerId = await idMap.resolveBdlPlayerId(playerId);
    if (bdlPlayerId == null) return null;
    return bdlClutchSplits.fetchPlayerSeasonClutchBdl(bdlPlayerId, season, seasontype);
  }

  // Scoring distribution: shares player_season_advanced_stats with ratings/clutch above, but
  // measure_type=scoring sits on the SAME newer tracking-data floor as measure_type=advanced
  // (ADVANCED_RATINGS_MIN_SEASON=2022), not the wider BDL_MIN_SEASON=2008 -- confirmed by live spike,
  // 2026-08-22 (2015/2018/2021 all returned no row for this measure_type; 2022 was the first season
  // with data). The assisted/unassisted and fastbreak/paint/off-turnover splits need shot-tracking
  // context BDL doesn't have for older seasons, same underlying reason Off/Def/Net Rating is gated.
  async getPlayerSeasonScoringDistribution(playerId, season, seasontype = 2) {
    if (Number(season) < ADVANCED_RATINGS_MIN_SEASON) return null;
    const bdlPlayerId = await idMap.resolveBdlPlayerId(playerId);
    if (bdlPlayerId == null) return null;
    return bdlScoringDistribution.fetchPlayerSeasonScoringBdl(bdlPlayerId, season, seasontype);
  }

  // Usage share: same measure_type family as scoring above, same 2022 tracking-data floor
  // (confirmed by live spike, 2026-08-22 -- no row for 2015/2018/2021, first data at 2022).
  async getPlayerSeasonUsageShare(playerId, season, seasontype = 2) {
    if (Number(season) < ADVANCED_RATINGS_MIN_SEASON) return null;
    const bdlPlayerId = await idMap.resolveBdlPlayerId(playerId);
    if (bdlPlayerId == null) return null;
    return bdlUsageShare.fetchPlayerSeasonUsageBdl(bdlPlayerId, season, seasontype);
  }

  // Defense: same measure_type family as scoring/usage above, same 2022 tracking-data floor
  // (confirmed by live spike, 2026-08-22 -- no row for 2015/2018/2021, first data at 2022).
  async getPlayerSeasonDefense(playerId, season, seasontype = 2) {
    if (Number(season) < ADVANCED_RATINGS_MIN_SEASON) return null;
    const bdlPlayerId = await idMap.resolveBdlPlayerId(playerId);
    if (bdlPlayerId == null) return null;
    return bdlDefenseStats.fetchPlayerSeasonDefenseBdl(bdlPlayerId, season, seasontype);
  }

  // Team Four Factors: team-level measure_type=four_factors, same 2022 tracking-data floor as the
  // player-level measure_type family (confirmed by live spike, 2026-08-22 -- no row for
  // 2010/2015/2018/2021, first data at 2022).
  async getTeamFourFactors(teamId, season, seasontype = 2) {
    if (Number(season) < ADVANCED_RATINGS_MIN_SEASON) return null;
    const bdlTeamId = await idMap.resolveBdlTeamId(teamId);
    if (bdlTeamId == null) return null;
    return bdlTeamFourFactors.fetchTeamFourFactorsBdl(bdlTeamId, season, seasontype);
  }

  // Team shot chart: same SHOT_CHART_MIN_SEASON floor (2022) as the player-level version -- own
  // season floor, not usesBdl/BDL_MIN_SEASON (2008), since zone tracking is a much newer feed.
  async getTeamShotChart(teamId, season) {
    if (Number(season) < SHOT_CHART_MIN_SEASON) return null;
    const bdlTeamId = await idMap.resolveBdlTeamId(teamId);
    if (bdlTeamId == null) return null;
    return bdlTeamShotChart.fetchTeamShotChartBdl(bdlTeamId, season);
  }
}

module.exports = withValidation(new BallDontLieProvider());
