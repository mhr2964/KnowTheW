export const HIDDEN = new Set(['PLAYER_ID', 'LEAGUE_ID', 'TEAM_ID']);
// Hidden at the narrowest mobile tier on Per Game/Totals only (BrefTable gates by viewMode) --
// TRB/G/MP/shooting-pct already cover the same ground more usefully at a glance than these do,
// so these are the lowest-value columns to lose first when the row can't fit.
export const LOW_PRIORITY_COLS = new Set(['GS', 'OREB', 'DREB', 'PF']);
export const PCT_COLS = new Set(['FG_PCT', 'FG3_PCT', 'FT_PCT', 'TS_PCT', 'EFG_PCT', 'TPAr', 'FTr', 'WS_PER48']);
export const PCT100_COLS = new Set(['TOV_PCT', 'USG_PCT', 'AST_PCT', 'ORB_PCT', 'DRB_PCT', 'TRB_PCT', 'STL_PCT', 'BLK_PCT']);
export const LABELS = {
  SEASON_ID: 'Season', TEAM_ABBREVIATION: 'Team', PLAYER_AGE: 'Age',
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

export function deriveColumns(data) {
  if (!data?.length) return [];
  return Object.keys(data[0])
    .filter(k => !HIDDEN.has(k))
    .map(k => ({ key: k, label: LABELS[k] ?? k, type: PCT_COLS.has(k) ? 'pct' : 'text' }));
}
