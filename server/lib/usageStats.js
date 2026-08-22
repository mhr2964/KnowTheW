// Shapes BDL's usage-share row (providers/balldontlie/usageShare.js) into a BrefTable-ready
// {columns, rows} table -- one row, this season/side, same shape as clutchStats.js (a single
// pre-aggregated row straight from BDL's own endpoint, not a client-side aggregation).
const { columnsFor } = require('./statColumns');

const USAGE_HEADERS = [
  'GP', 'TM_REB_PCT', 'TM_AST_PCT', 'TM_STL_PCT', 'TM_BLK_PCT', 'TM_TOV_PCT',
  'TM_FGA_PCT', 'TM_FGM_PCT', 'TM_FTA_PCT', 'TM_FTM_PCT', 'TM_PF_PCT', 'TM_PFD_PCT', 'TM_USG_PCT',
];

// No BDL tracking data for that player-season (before 2022, or simply no row) is a real, common
// case -- returns null so the route can 404-equivalent it, same as buildClutchTable.
function buildUsageTable(u) {
  if (!u || !u.gp) return null;
  const row = [
    u.gp, u.tmRebPct, u.tmAstPct, u.tmStlPct, u.tmBlkPct, u.tmTovPct,
    u.tmFgaPct, u.tmFgmPct, u.tmFtaPct, u.tmFtmPct, u.tmPfPct, u.tmPfdPct, u.tmUsgPct,
  ];
  return { columns: columnsFor(USAGE_HEADERS), rows: [row] };
}

module.exports = { buildUsageTable, USAGE_HEADERS };
