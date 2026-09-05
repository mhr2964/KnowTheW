// Notable Games: single-game statistical highs for a season (highest-scoring game, most rebounds
// in a game, etc.), scanned from the same per-game bulk /player_stats pull leagueStats.js already
// fetches and caches for percentile enrichment (fetchBdlPlayerStatsRows) -- no new endpoint, a new
// scan-and-rank pass over data already in hand for that season.
const { isRealFranchise } = require('./idMap');
const { buildRegularSeasonGameIdSet, fetchBdlPlayerStatsRows, isDnpRow } = require('./leagueStats');
const { resolveEspnIdByName } = require('../../lib/playerNameIndex');

const CATEGORIES = [
  { key: 'pts', label: 'Points' },
  { key: 'reb', label: 'Rebounds' },
  { key: 'ast', label: 'Assists' },
  { key: 'stl', label: 'Steals' },
  { key: 'blk', label: 'Blocks' },
];
const TOP_N = 10;

// Pure: qualified per-game rows (already filtered to real-franchise regular-season games, DNPs
// dropped) -> top-N single-game performances per category. Split out so the ranking logic is
// unit-testable without a network call.
function buildNotableGames(rows, { categories = CATEGORIES, topN = TOP_N } = {}) {
  return categories.map(({ key, label }) => {
    const ranked = rows
      .filter(r => typeof r[key] === 'number')
      .sort((a, b) => b[key] - a[key])
      .slice(0, topN)
      .map(r => ({
        playerId: r.playerId ?? null,
        name: r.name,
        teamAbbr: r.teamAbbr,
        gameId: r.gameId,
        date: r.date,
        value: r[key],
      }));
    return { key, label, games: ranked };
  });
}

async function fetchNotableGamesRawBdl(season) {
  const [gameIdSet, statRows] = await Promise.all([
    buildRegularSeasonGameIdSet(season),
    fetchBdlPlayerStatsRows(season),
  ]);
  if (!gameIdSet || !statRows) return [];

  return statRows
    .filter(r => gameIdSet.has(r.game?.id) && !isDnpRow(r) && isRealFranchise(r.team))
    .map(r => ({
      name: `${r.player.first_name} ${r.player.last_name}`,
      teamAbbr: r.team?.abbreviation ?? null,
      gameId: r.game?.id ?? null,
      date: r.game?.date ?? null,
      pts: r.pts ?? 0, reb: r.reb ?? 0, ast: r.ast ?? 0, stl: r.stl ?? 0, blk: r.blk ?? 0,
    }));
}

async function getNotableGamesBdl(season) {
  const rows = await fetchNotableGamesRawBdl(season);
  if (!rows.length) return { season: Number(season), categories: [] };

  const names = new Set(rows.map(r => r.name));
  const idByName = new Map(await Promise.all(
    [...names].map(async name => [name, await resolveEspnIdByName(name)])
  ));
  const withIds = rows.map(r => ({ ...r, playerId: idByName.get(r.name) ?? null }));

  return { season: Number(season), categories: buildNotableGames(withIds) };
}

module.exports = { getNotableGamesBdl, buildNotableGames, fetchNotableGamesRawBdl, CATEGORIES, TOP_N };
