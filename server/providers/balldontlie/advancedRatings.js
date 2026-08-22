// Off/Def/Net Rating + PIE for one player-season, straight off BDL's own `player_season_advanced_stats`
// endpoint (measure_type=advanced) -- distinct from advancedStats.js's PBP box-score reconstruction,
// which computes TS%/USG%/PER/Win-Shares from raw play-by-play because BDL has no season-level
// endpoint for THOSE stats. This one already IS season-level on the source side, so it's a single
// direct fetch, no per-game aggregation.
//
// Field names confirmed by live spike, 2026-08-21: off_rating, def_rating, net_rating, pie (plus
// _e "estimated" variants and _rank counterparts, neither used here -- the plain values are what
// BRef-style sites show).
const { bdlFetch } = require('./client');

// Split from the fetch so it's testable without mocking network, mirroring shotChart.js's
// buildShotChartFromRow precedent.
function mapAdvancedStatsRow(stats) {
  if (!stats) return null;
  return {
    offRating: stats.off_rating ?? null,
    defRating: stats.def_rating ?? null,
    netRating: stats.net_rating ?? null,
    pie: stats.pie ?? null,
  };
}

async function fetchPlayerSeasonRatingsBdl(bdlPlayerId, season, seasontype = 2) {
  const data = await bdlFetch('/player_season_advanced_stats', {
    'player_ids[]': [bdlPlayerId],
    season,
    season_type: seasontype === 3 ? 'playoffs' : 'regular',
    measure_type: 'advanced',
  });
  return mapAdvancedStatsRow(data?.data?.[0]?.stats);
}

module.exports = { fetchPlayerSeasonRatingsBdl, mapAdvancedStatsRow };
