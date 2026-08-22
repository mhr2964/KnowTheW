// ESPN implementation of the SportsDataProvider contract — the Facade over the ESPN provider's
// pieces. It maps the contract method names onto ./client (the HTTP/cache layer, formerly
// server/lib/espnClient) and the ./*.js submodules (playerStats, gamelog, gameSummary, leagueStats).
// Active players are exposed source-neutrally via getActivePlayers()/findActivePlayer() so no
// in-memory cache object crosses the contract.
//
// The startup prefetch side-effect fires from ./client on require, so import-time behavior is
// unchanged by the M9 relocation.

const espn = require('./client');
const playerStats = require('./playerStats');
const gamelog = require('./gamelog');
const gameSummary = require('./gameSummary');
const leagueStats = require('./leagueStats');
const { SportsDataProvider } = require('../SportsDataProvider');
const { withValidation } = require('../validation');
const { aggregatePBPSummary } = require('../pbpAggregate');

class EspnProvider extends SportsDataProvider {
  get name() { return 'espn'; }

  // --- Teams & rosters ---
  getTeams() { return espn.getTeams(); }
  getRoster(teamId, teamName) { return espn.getRoster(teamId, teamName); }
  getHistoricalRoster(teamId, season) { return espn.fetchHistoricalRoster(teamId, season); }
  getSeasonRoster(teamId, season, teamName) { return espn.fetchSeasonRoster(teamId, season, teamName); }

  // --- Team stats & schedule ---
  getTeamStats(teamId, year) { return espn.fetchTeamStats(teamId, year); }
  getTeamStatsRaw(teamId, year) { return espn.fetchTeamStatsRaw(teamId, year); }
  getTeamPointsAllowed(teamId, year) { return espn.fetchTeamPtsAllowed(teamId, year); }
  getTeamPointsAllowedRaw(teamId, year) { return espn.fetchTeamPtsAllowedRaw(teamId, year); }
  getTeamSchedule(teamId, season, seasontype) { return espn.fetchTeamSchedule(teamId, season, seasontype); }
  getPlayoffSchedule(teamId, season) { return espn.fetchPlayoffSchedule(teamId, season); }
  getStandingsRaw(year) { return espn.fetchStandingsRaw(year); }

  // Degraded (not throwing) fallback for a non-BDL environment -- gamesBehind/homeRecord/
  // awayRecord/conferenceRecord have no ESPN source, so those come back null rather than the
  // richer BDL shape. `season` is accepted for contract-signature parity but ignored: ESPN's
  // fetchStandings() (unlike fetchStandingsRaw) only supports "current season" today.
  async getStandings() {
    const [standingsByTeamId, teams] = await Promise.all([espn.fetchStandings(), espn.getTeams()]);
    if (!standingsByTeamId) return null;
    return teams
      .filter(t => standingsByTeamId[String(t.id)])
      .map(t => {
        const std = standingsByTeamId[String(t.id)];
        return {
          teamId: String(t.id),
          slug: t.slug ?? null,
          name: t.name ?? null,
          abbreviation: t.abbreviation ?? null,
          logo: t.logo ?? null,
          color: t.color ?? null,
          conference: std.conference ?? null,
          wins: std.wins,
          losses: std.losses,
          winPct: null,
          gamesBehind: null,
          homeRecord: null,
          awayRecord: null,
          conferenceRecord: null,
          playoffSeed: std.seed,
        };
      });
  }

  // --- Player ---
  getPlayerBasics(playerId) { return playerStats.getPlayerBasics(playerId); }
  getRetiredPlayer(playerId) { return playerStats.getRetiredPlayer(playerId); }
  getPlayerSeasonStats(playerId) { return playerStats.getPlayerSeasonStats(playerId); }
  getPlayerGameLog(playerId, season) { return gamelog.getPlayerGameLog(playerId, season); }
  getGameLogEvents(playerId, season, seasontype) { return gamelog.getGameLogEvents(playerId, season, seasontype); }
  // ESPN has no shot-location data source at all -- a permanent gap, not a missing implementation.
  // Must return null rather than inherit the base class's throwing default: STATS_PROVIDER defaults
  // to 'espn' (providers/index.js), so local dev and any non-BDL env would otherwise 502 here.
  getPlayerShotChart() { return null; }
  getLeagueShotZones() { return null; }
  getLeagueShotZoneLeaders() { return null; }
  getPlayerSeasonRatings() { return null; }
  getPlayerSeasonClutch() { return null; }
  getPlayerSeasonScoringDistribution() { return null; }
  getPlayerSeasonUsageShare() { return null; }
  getPlayerSeasonDefense() { return null; }
  getTeamFourFactors() { return null; }
  getTeamShotChart() { return null; }
  getGamePbpStats(eventId, playerId, season) { return gameSummary.getGamePbpStats(eventId, playerId, season); }
  async getRegularSeasonEventIds(playerId, season, seasontype = 2) {
    const events = await gamelog.getGameLogEvents(playerId, season, seasontype);
    if (!events) return null;
    const stFilter     = seasontype === 2 ? 'Regular Season' : 'Postseason';
    const allTeams     = await espn.getTeams();
    const franchiseIds = new Set(allTeams.map(t => String(t.id)));
    return events
      .filter(e => e.seasonTypeName?.includes(stFilter))
      .filter(e => !e.eventNote?.toLowerCase().includes('all-star'))
      .filter(e => !e.opponentId || franchiseIds.has(e.opponentId))
      .map(e => e.eventId);
  }

  // ESPN has no season-level on-court-stats or WS-team-averages endpoint, so both are
  // reconstructed here game-by-game from getGamePbpStats(). Moved out of advancedStats.js so the
  // analysis layer only ever sees the resolved per-game averages, never ESPN's PBP mechanics.
  // Aggregation itself is shared with the BallDontLie provider (pure reduction, no ESPN-specific
  // logic once you have per-game {fetched,onCourt,boxscore} results) -- see ../pbpAggregate.js.
  // Per-game raw fetch is cached (past seasons only) inside getGamePbpStats itself -- see
  // gameSummary.js and ../gamePbpCache.js -- so a season warmed by either tab benefits both, and
  // players sharing a game only pay the real fetch cost once between them.
  async getSeasonPBPSummary(playerId, season, seasontype = 2) {
    const eventIds = await this.getRegularSeasonEventIds(playerId, season, seasontype);
    if (!eventIds?.length) return null;
    return aggregatePBPSummary(eventIds, id => this.getGamePbpStats(id, playerId, season));
  }

  // --- League-wide stats (percentile system) ---
  getLeagueStatLines(season, mode) { return leagueStats.getLeagueStatLines(season, mode); }
  getLeagueReboundFoulStats(season) { return leagueStats.getLeagueReboundFoulStats(season); }
  getPlayerSeasonAverages(playerId) { return leagueStats.getPlayerSeasonAverages(playerId); }
  getLeaguePlayerIndex(seasons) { return leagueStats.getLeaguePlayerIndex(seasons); }

  // --- Active players (source-neutral list/lookup of the current player pool) ---
  // ESPN serves these from its startup-prefetch caches; that's an implementation detail.
  getActivePlayers() { return Object.values(espn.rosterData).flat(); }
  findActivePlayer(id) { return espn.playerById[id]; }
}

// Wrapped so every normalized return is validated at the boundary (silent-drift alarm for the
// undocumented source). Test code injects un-wrapped mock providers via _setProviderForTest, so this
// only validates real ESPN output.
module.exports = withValidation(new EspnProvider());
