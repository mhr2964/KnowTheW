// BallDontLie hybrid provider. NOT a pure BDL reimplementation of SportsDataProvider -- a facade
// that delegates most methods straight through to the ESPN provider (imported directly, not via
// getProvider(), to avoid recursion) and only takes over specific methods, season-conditionally,
// where BDL's data is both available and worth the swap. See docs/design/provider-architecture.md
// for the full reasoning.
//
// Delegates to ESPN forever (out of scope for this swap): teams/rosters/schedule, player-basics,
// getPlayerSeasonStats (raw-ESPN-JSON shape, see docs/design/provider-architecture.md's Phase 1b
// note)/getGameLogEvents (no external consumers -- getRegularSeasonEventIds below already bypasses
// it for BDL seasons), the percentile/league-index methods, active-player lookups, and
// getStandingsRaw specifically (its only consumer, historyAggregator.js, depends on ESPN's exact
// conference/seed shape -- no accuracy motivation to touch it, only risk).
//
// Season-conditional (BDL for season >= BDL_MIN_SEASON, else ESPN delegate): team season stats and
// player game log (Phase 1a, below) and the play-by-play family (Phase 2 of the original PBP build,
// below -- naming predates the later ESPN-migration phase plan and wasn't renumbered to avoid
// churn).
//
// BDL has no WNBA data before ~2008 (confirmed by spike); this site's own league-average table
// goes back to 1998 -- hence the cutoff rather than a full replacement.

const espn = require('../espn');
const bdlTeamStats = require('./teamStats');
const bdlPlays = require('./plays');
const bdlGameLog = require('./gameLog');
const idMap = require('./idMap');
const { BDL_MIN_SEASON } = require('./client');
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
  getTeamSchedule(...a) { return espn.getTeamSchedule(...a); }
  getPlayoffSchedule(...a) { return espn.getPlayoffSchedule(...a); }
  getStandingsRaw(...a) { return espn.getStandingsRaw(...a); }
  getPlayerBasics(...a) { return espn.getPlayerBasics(...a); }
  getRetiredPlayer(...a) { return espn.getRetiredPlayer(...a); }
  getPlayerSeasonStats(...a) { return espn.getPlayerSeasonStats(...a); }
  getGameLogEvents(...a) { return espn.getGameLogEvents(...a); }
  getLeagueStatLines(...a) { return espn.getLeagueStatLines(...a); }
  getLeagueReboundFoulStats(...a) { return espn.getLeagueReboundFoulStats(...a); }
  getPlayerSeasonAverages(...a) { return espn.getPlayerSeasonAverages(...a); }
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

  // --- Phase 1a: player game log, season-conditional ---
  async getPlayerGameLog(playerId, season) {
    if (!usesBdl(season)) return espn.getPlayerGameLog(playerId, season);
    const bdlPlayerId = await idMap.resolveBdlPlayerId(playerId);
    if (bdlPlayerId == null) return null;
    return bdlGameLog.fetchPlayerGameLogBdl(bdlPlayerId, season);
  }

  // --- Phase 2: play-by-play family, season-conditional ---
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
