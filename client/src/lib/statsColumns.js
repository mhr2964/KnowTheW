export const HIDDEN = new Set(['PLAYER_ID', 'LEAGUE_ID', 'TEAM_ID']);
export const PCT_COLS = new Set(['FG_PCT', 'FG3_PCT', 'FT_PCT', 'TS_PCT', 'EFG_PCT', 'TPAr', 'FTr']);
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
};

export function deriveColumns(data) {
  if (!data?.length) return [];
  return Object.keys(data[0])
    .filter(k => !HIDDEN.has(k))
    .map(k => ({ key: k, label: LABELS[k] ?? k, type: PCT_COLS.has(k) ? 'pct' : 'text' }));
}
