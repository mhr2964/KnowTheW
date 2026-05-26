// ESPN implementation of the SportsDataProvider contract.
//
// M1 stage: this is a thin adapter over the existing server/lib/espnClient.js — it renames the
// functions to the interface method names and exposes the module's shared mutable caches
// (playerById / rosterData / teamSeasonStatsCache) via accessors so consumers can stop importing
// espnClient's internals directly. The actual ESPN fetch/parse code still lives in espnClient.js
// for now; later milestones move it into this directory (http.js, teams.js, ...) and absorb the
// rogue fetches that currently bypass espnClient.
//
// The startup prefetch side-effect still fires from espnClient.js on require — keeping it there
// (rather than moving it here) means import-time behavior is unchanged during the migration.

const espn = require('../../lib/espnClient');
const playerStats = require('./playerStats');
const gamelog = require('./gamelog');
const gameSummary = require('./gameSummary');
const leagueStats = require('./leagueStats');
const { SportsDataProvider } = require('../SportsDataProvider');
const { withValidation } = require('../validation');

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

  // --- League-wide stats (percentile system) ---
  getLeagueStatLines(season, mode) { return leagueStats.getLeagueStatLines(season, mode); }
  getLeagueReboundFoulStats(season) { return leagueStats.getLeagueReboundFoulStats(season); }
  getPlayerSeasonAverages(playerId) { return leagueStats.getPlayerSeasonAverages(playerId); }
  getLeaguePlayerIndex(seasons) { return leagueStats.getLeaguePlayerIndex(seasons); }

  // --- Active players (source-neutral list/lookup of the current player pool) ---
  // ESPN serves these from its startup-prefetch caches; that's an implementation detail.
  getActivePlayers() { return Object.values(espn.rosterData).flat(); }
  findActivePlayer(id) { return espn.playerById[id]; }

  // --- Pass-through helpers that aren't source fetches ---
  formatSeedLabel(n) { return espn.formatSeedLabel(n); }
}

// Wrapped so every normalized return is validated at the boundary (silent-drift alarm for the
// undocumented source). Test code injects un-wrapped mock providers via _setProviderForTest, so this
// only validates real ESPN output.
module.exports = withValidation(new EspnProvider());
