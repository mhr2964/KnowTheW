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
const { SportsDataProvider } = require('../SportsDataProvider');

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
  getGameSummary(eventId) { return espn.fetchGameSummary(eventId); }
  getPlayerBasics(playerId) { return playerStats.getPlayerBasics(playerId); }
  getRetiredPlayer(playerId) { return playerStats.getRetiredPlayer(playerId); }
  getPlayerSeasonStats(playerId) { return playerStats.getPlayerSeasonStats(playerId); }

  // --- Shared-state accessors (replace direct espnClient internal imports) ---
  /** @param {string|number} id */
  getPlayerById(id) { return espn.playerById[id]; }
  getRosterData() { return espn.rosterData; }
  getPlayerIndex() { return espn.playerById; }
  getTeamSeasonStatsCache() { return espn.teamSeasonStatsCache; }

  // --- Pass-through helpers that aren't source fetches ---
  formatSeedLabel(n) { return espn.formatSeedLabel(n); }
}

module.exports = new EspnProvider();
