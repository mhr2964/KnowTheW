// playerSeasonData.js — fetches a player's regular+postseason normalized PlayerSeasonRow[]
// (server/providers/types.js) plus the team index needed to resolve team names/abbreviations
// against them. Shared by routes/players.js (detailed-stats) and routes/playerAnalysis.js
// (pbp-table, advanced-pbp-all) — extracted here rather than duplicated in both once the router
// split separated those two files.
const { getProvider } = require('../providers');

async function fetchPlayerSeasonData(playerId) {
  const [teams, { regSeasons, postSeasons }] = await Promise.all([
    getProvider().getTeams(),
    getProvider().getPlayerSeasonStats(playerId),
  ]);
  return { teams, regSeasons, postSeasons, teamsById: Object.fromEntries(teams.map(t => [t.id, t])) };
}

module.exports = { fetchPlayerSeasonData };
