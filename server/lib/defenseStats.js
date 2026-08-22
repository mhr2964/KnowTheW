// Shapes BDL's defense row (providers/balldontlie/defenseStats.js) into a BrefTable-ready
// {columns, rows} table -- one row, this season/side, same shape as usageStats.js (a single
// pre-aggregated row straight from BDL's own endpoint, all independent flat columns, not
// grouped/overlapping percentages like scoringDistribution.js needs).
const { columnsFor } = require('./statColumns');

const DEFENSE_HEADERS = [
  'GP', 'BLK', 'STL', 'DREB', 'BDL_DREB_PCT', 'DEF_RATING', 'BDL_DEF_WS',
  'OPP_PTS_PAINT', 'OPP_PTS_FASTBREAK', 'OPP_PTS_OFF_TOV', 'OPP_PTS_2ND_CHANCE',
];

// No BDL tracking data for that player-season (before 2022, or simply no row) is a real, common
// case -- returns null so the route can 404-equivalent it, same as buildUsageTable.
function buildDefenseTable(d) {
  if (!d || !d.gp) return null;
  const row = [
    d.gp, d.blk, d.stl, d.dreb, d.bdlDrebPct, d.defRating, d.bdlDefWs,
    d.oppPtsPaint, d.oppPtsFastbreak, d.oppPtsOffTov, d.oppPts2ndChance,
  ];
  return { columns: columnsFor(DEFENSE_HEADERS), rows: [row] };
}

module.exports = { buildDefenseTable, DEFENSE_HEADERS };
