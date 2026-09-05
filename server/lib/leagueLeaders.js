// League Leaders: pure ranking over the same qualified-player entries percentileClient.js's
// distribution builder already produces (getLeagueStatLines(season, mode)) -- reused rather than a
// second bulk fetch, same "don't refetch what's already in hand" discipline as per100Stats.js
// reusing teamStatsByKey. Both providers' mapLeagueStatLine now carry identity (bdlPlayerId/name/
// teamAbbr for BDL, espnId/name for ESPN) alongside the stat values specifically so this module
// doesn't need its own fetch path.

const CATEGORIES = [
  { key: 'PTS', label: 'Points' },
  { key: 'REB', label: 'Rebounds' },
  { key: 'AST', label: 'Assists' },
  { key: 'STL', label: 'Steals' },
  { key: 'BLK', label: 'Blocks' },
  { key: 'FG_PCT', label: 'FG%' },
  { key: 'FG3_PCT', label: '3P%' },
  { key: 'FT_PCT', label: 'FT%' },
];
const TOP_N = 10;

// entries: qualified getLeagueStatLines() rows, each already carrying { playerId, name, teamAbbr,
// ...PERCENTILE_STATS }. playerId is this site's canonical (ESPN) id, resolved by the caller before
// this runs -- this module ranks, it doesn't resolve identity.
function buildLeaderboards(entries, { categories = CATEGORIES, topN = TOP_N } = {}) {
  return categories.map(({ key, label }) => {
    const ranked = entries
      .filter(e => typeof e[key] === 'number')
      .sort((a, b) => b[key] - a[key])
      .slice(0, topN)
      .map(e => ({ playerId: e.playerId ?? null, name: e.name, teamAbbr: e.teamAbbr ?? null, value: e[key] }));
    return { key, label, leaders: ranked };
  });
}

module.exports = { buildLeaderboards, CATEGORIES, TOP_N };
