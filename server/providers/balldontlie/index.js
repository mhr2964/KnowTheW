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
const bdlSchedule = require('./schedule');
const bdlSeasonStats = require('./seasonStats');
const bdlShotChart = require('./shotChart');
const bdlLeagueStats = require('./leagueStats');
const idMap = require('./idMap');
const { BDL_MIN_SEASON, SHOT_CHART_MIN_SEASON } = require('./client');
const { SportsDataProvider } = require('../SportsDataProvider');
const { withValidation } = require('../validation');
const { aggregatePBPSummary } = require('../pbpAggregate');

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

  // --- Phase 1a: player game log, season-conditional ---
  async getPlayerGameLog(playerId, season) {
    if (!usesBdl(season)) return espn.getPlayerGameLog(playerId, season);
    const bdlPlayerId = await idMap.resolveBdlPlayerId(playerId);
    if (bdlPlayerId == null) return null;
    return bdlGameLog.fetchPlayerGameLogBdl(bdlPlayerId, season);
  }

  // --- Shot chart: new data, not a migration -- no ESPN equivalent exists at all (see
  // shotChart.js's header comment). Own season floor (2022), not usesBdl/BDL_MIN_SEASON (2008) --
  // zone tracking is a much newer feed than the rest of this provider's BDL coverage. ---
  async getPlayerShotChart(playerId, season) {
    if (Number(season) < SHOT_CHART_MIN_SEASON) return null;
    const bdlPlayerId = await idMap.resolveBdlPlayerId(playerId);
    if (bdlPlayerId == null) return null;
    return bdlShotChart.fetchPlayerShotChartBdl(bdlPlayerId, season);
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
  // getGamePbpStats(eventId, playerId) receives no season -- only an opaque eventId -- but must
  // know whether to hit ESPN or BDL. getRegularSeasonEventIds tags BDL-sourced ids as "bdl:<id>";
  // bare ids stay ESPN's own format. Every consumer already treats event ids as opaque (confirmed:
  // playerAnalysis.js's pbp-table route loops and passes ids through without inspecting them), so
  // this string-prefix scheme is a drop-in, zero-consumer-change dispatch mechanism.
  async getRegularSeasonEventIds(playerId, season, seasontype = 2) {
    if (!usesBdl(season)) return espn.getRegularSeasonEventIds(playerId, season, seasontype);
    const bdlPlayerId = await idMap.resolveBdlPlayerId(playerId);
    if (bdlPlayerId == null) return null;
    return bdlPlays.getRegularSeasonEventIdsBdl(bdlPlayerId, season, seasontype);
  }

  async getGamePbpStats(eventId, playerId) {
    if (typeof eventId === 'string' && eventId.startsWith('bdl:')) {
      const bdlGameId = eventId.slice(4);
      const bdlPlayerId = await idMap.resolveBdlPlayerId(playerId);
      if (bdlPlayerId == null) return { fetched: false, onCourt: null, boxscore: null };
      return bdlPlays.getGamePbpStatsBdl(bdlGameId, bdlPlayerId);
    }
    return espn.getGamePbpStats(eventId, playerId);
  }

  // Aggregation is shared with ESPN (../pbpAggregate.js) -- calls this.getGamePbpStats (not a bare
  // module reference) so the bdl: prefix dispatch above stays transparent from in here too, even
  // though every id in the BDL branch will already carry the prefix.
  async getSeasonPBPSummary(playerId, season, seasontype = 2) {
    if (!usesBdl(season)) return espn.getSeasonPBPSummary(playerId, season, seasontype);
    const eventIds = await this.getRegularSeasonEventIds(playerId, season, seasontype);
    if (!eventIds?.length) return null;
    return aggregatePBPSummary(eventIds, id => this.getGamePbpStats(id, playerId));
  }
}

module.exports = withValidation(new BallDontLieProvider());
