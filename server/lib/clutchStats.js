// Shapes BDL's clutch box-score row (providers/balldontlie/clutchSplits.js) into a BrefTable-ready
// {columns, rows} table -- one row, this season/side's clutch appearances only. Column keys reuse
// the existing per-game/totals LABELS convention (statColumns.js) since BDL's clutch stats are the
// same categories (PTS/REB/AST/etc), just filtered to clutch time, plus BDL's own fantasy-points field.
const { columnsFor } = require('./statColumns');

const CLUTCH_HEADERS = [
  'GP', 'MIN', 'FGM', 'FGA', 'FG_PCT', 'FG3M', 'FG3A', 'FG3_PCT',
  'FTM', 'FTA', 'FT_PCT', 'OREB', 'DREB', 'REB', 'AST', 'STL', 'BLK', 'TOV', 'PF', 'PTS', 'FAN_PTS',
];

// No clutch appearances that season/side is a real, common case (most players never see clutch
// minutes) -- returns null so the route can 404-equivalent it the same way an empty gamelog does,
// rather than rendering a table of zeros.
function buildClutchTable(c) {
  if (!c || !c.gp) return null;
  const row = [
    c.gp, c.min, c.fgm, c.fga, c.fgPct, c.fg3m, c.fg3a, c.fg3Pct,
    c.ftm, c.fta, c.ftPct, c.oreb, c.dreb, c.reb, c.ast, c.stl, c.blk, c.tov, c.pf, c.pts, c.fantasyPts,
  ];
  return { columns: columnsFor(CLUTCH_HEADERS), rows: [row] };
}

module.exports = { buildClutchTable, CLUTCH_HEADERS };
