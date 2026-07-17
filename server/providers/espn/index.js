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
const { PBP_OC_KEYS } = require('../types');

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

  // --- Player ---
  getPlayerBasics(playerId) { return playerStats.getPlayerBasics(playerId); }
  getRetiredPlayer(playerId) { return playerStats.getRetiredPlayer(playerId); }
  getPlayerSeasonStats(playerId) { return playerStats.getPlayerSeasonStats(playerId); }
  getPlayerGameLog(playerId, season) { return gamelog.getPlayerGameLog(playerId, season); }
  getGameLogEvents(playerId, season, seasontype) { return gamelog.getGameLogEvents(playerId, season, seasontype); }
  getGamePbpStats(eventId, playerId) { return gameSummary.getGamePbpStats(eventId, playerId); }
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
  async getSeasonPBPSummary(playerId, season, seasontype = 2) {
    const eventIds = await this.getRegularSeasonEventIds(playerId, season, seasontype);
    if (!eventIds?.length) return null;

    const pbpResults = await Promise.all(eventIds.map(id => this.getGamePbpStats(id, playerId)));
    // Track how many ESPN fetches succeeded. complete = true when every eventId returned a
    // non-null summary, meaning no ESPN 4xx/5xx/network failures occurred mid-fetch.
    const fetchedCount = pbpResults.filter(r => r.fetched).length;
    const totOC = Object.fromEntries(PBP_OC_KEYS.map(k => [k, 0]));
    const totTm = { fga: 0, fgm: 0, fg3m: 0, fta: 0, ftm: 0, pts: 0, orb: 0, drb: 0, tov: 0, ast: 0 };
    let pbpGames = 0, wsGames = 0;

    for (const r of pbpResults) {
      if (!r.fetched) continue;
      const oc = r.onCourt;
      if (!oc) continue;
      pbpGames++;
      for (const k of PBP_OC_KEYS) totOC[k] += oc[k];

      const gs = r.boxscore;
      if (gs) {
        wsGames++;
        for (const k of Object.keys(totTm)) totTm[k] += gs.tm[k] ?? 0;
      }
    }
    if (!pbpGames) return null;

    const g = pbpGames;
    const tmOC = {
      fgaPg:   totOC.fga  / g, fgmPg:   totOC.fgm  / g,
      fg3aPg:  totOC.fg3a / g, ftaPg:   totOC.fta  / g, ftmPg:  totOC.ftm / g,
      orbPg:   totOC.orb  / g, drbPg:   totOC.drb  / g,
      tovPg:   totOC.tov  / g, astPg:   totOC.ast  / g,
      oFgaPg:  totOC.oFga  / g, oFgmPg: totOC.oFgm  / g,
      oFg3aPg: totOC.oFg3a / g, oFtaPg: totOC.oFta  / g,
      oOrbPg:  totOC.oOrb  / g, oDrbPg: totOC.oDrb  / g,
      oTovPg:  totOC.oTov  / g,
    };

    const tmForWS = wsGames > 0 ? {
      fgaPg:  totTm.fga  / wsGames,
      fgmPg:  totTm.fgm  / wsGames,
      fg3mPg: totTm.fg3m / wsGames,
      ftaPg:  totTm.fta  / wsGames,
      ftmPg:  totTm.ftm  / wsGames,
      ptsPg:  totTm.pts  / wsGames,
      orbPg:  totTm.orb  / wsGames,
      drbPg:  totTm.drb  / wsGames,
      tovPg:  totTm.tov  / wsGames,
      astPg:  totTm.ast  / wsGames,
    } : null;

    // complete = true only when every event returned a non-null ESPN response. Partial fetches
    // (ESPN failing on some game IDs) must not be cached by the caller — they would bake in
    // understated stats permanently.
    const complete = fetchedCount === eventIds.length;
    return { tmOC, tmForWS, pbpGames, complete };
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
