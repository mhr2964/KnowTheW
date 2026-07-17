// Server-side column metadata for detailed-stats tables (perGame/totals/per36/advanced) — mirrors
// the gamelog precedent (providers/espn/gamelog.js's LABELS/columnFor) so the client no longer needs
// its own copy of these labels/formatting rules for THESE tables. Three kinds, not gamelog's two,
// because detailed-stats has a real distinction gamelog doesn't: 'pct' is a 0-1 fraction that
// renders as .XXX (FG_PCT, TS_PCT, WS_PER48); 'pct100' is also stored 0-1 but is a whole-number
// percent stat that renders as XX.X, no leading-zero trim (USG_PCT, TOV_PCT, ORB_PCT, etc.).

const LABELS = {
  SEASON_ID: 'Season', TEAM_ABBREVIATION: 'Team',
  GP: 'G', GS: 'GS', MIN: 'MP',
  FGM: 'FG', FGA: 'FGA', FG_PCT: 'FG%',
  FG3M: '3P', FG3A: '3PA', FG3_PCT: '3P%',
  FTM: 'FT', FTA: 'FTA', FT_PCT: 'FT%',
  OREB: 'ORB', DREB: 'DRB', REB: 'TRB',
  AST: 'AST', STL: 'STL', BLK: 'BLK', TOV: 'TOV', PF: 'PF', PTS: 'PTS',
  TS_PCT: 'TS%', EFG_PCT: 'eFG%', TPAr: '3PAr', FTr: 'FTr',
  TOV_PCT: 'TOV%', USG_PCT: 'USG%', AST_PCT: 'AST%',
  ORB_PCT: 'ORB%', DRB_PCT: 'DRB%', TRB_PCT: 'TRB%',
  STL_PCT: 'STL%', BLK_PCT: 'BLK%', PER: 'PER',
  OWS: 'OWS', DWS: 'DWS', WS: 'WS', WS_PER48: 'WS/48',
};

const PCT_KEYS = new Set(['FG_PCT', 'FG3_PCT', 'FT_PCT', 'TS_PCT', 'EFG_PCT', 'TPAr', 'FTr', 'WS_PER48']);
const PCT100_KEYS = new Set(['TOV_PCT', 'USG_PCT', 'AST_PCT', 'ORB_PCT', 'DRB_PCT', 'TRB_PCT', 'STL_PCT', 'BLK_PCT']);

function columnFor(key) {
  return { key, label: LABELS[key] ?? key, kind: PCT_KEYS.has(key) ? 'pct' : PCT100_KEYS.has(key) ? 'pct100' : 'num' };
}

function columnsFor(keys) {
  return keys.map(columnFor);
}

// { headers, rows, ...rest } -> { columns, rows, ...rest }. Passes null/undefined through
// unchanged (tables are often null when a split has no data).
function toColumnTable(table) {
  if (!table) return table;
  const { headers, ...rest } = table;
  return { ...rest, columns: columnsFor(headers) };
}

module.exports = { LABELS, PCT_KEYS, PCT100_KEYS, columnFor, columnsFor, toColumnTable };
