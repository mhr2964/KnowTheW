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
  // Adj. Shooting: rate stat as % of that season's league average (100 = league average).
  R_TS_PCT: 'rTS%', R_EFG_PCT: 'reFG%', R_TPAr: 'r3PAr', R_FTr: 'rFTr',
  // BDL's own season-level advanced-stats endpoint (not box-score-derived, unlike everything
  // above) -- Off/Def/Net Rating are points-per-100-possessions, already on a "number" scale
  // (~90-115), not a 0-1 fraction like the PCT/PCT100 stats. PIE is BDL's own 0-1-scaled fraction
  // (confirmed by live spike, 2026-08-21), same rendering family as TS%/eFG%.
  OFF_RATING: 'ORtg', DEF_RATING: 'DRtg', NET_RATING: 'Net Rtg', PIE: 'PIE',
  // Clutch tab only -- BDL's own wnba_fantasy_pts field, per-game like the rest of that row.
  FAN_PTS: 'Fant. Pts',
  // Usage tab only -- BDL's own on-floor team-share numbers (measure_type=usage). TM_ prefix
  // deliberately distinct from this file's existing AST_PCT/ORB_PCT/etc keys above, which are a
  // different (BRef-derived, box-score) formula for a similarly-named stat -- see usageShare.js.
  TM_REB_PCT: 'REB Sh%', TM_AST_PCT: 'AST Sh%', TM_STL_PCT: 'STL Sh%', TM_BLK_PCT: 'BLK Sh%',
  TM_TOV_PCT: 'TOV Sh%', TM_FGA_PCT: 'FGA Sh%', TM_FGM_PCT: 'FGM Sh%',
  TM_FTA_PCT: 'FTA Sh%', TM_FTM_PCT: 'FTM Sh%', TM_PF_PCT: 'PF Sh%', TM_PFD_PCT: 'PFD Sh%',
  TM_USG_PCT: 'Usage%',
  // Defense tab only -- BDL's own measure_type=defense fields. BLK/STL/DREB reuse this file's
  // existing box-score keys directly (same literal per-game count, no formula divergence).
  // BDL_DREB_PCT stays distinct from this file's existing DRB_PCT -- BDL's dreb_pct uses a
  // different formula from the homegrown BRef one and produced a materially different value in a
  // live spike (see defenseStats.js). BDL_DEF_WS's key stays as-is (renaming would touch export/
  // career-row plumbing for no real benefit) but its label drops the "BDL" qualifier: as of
  // 2026-08-22 it's this site's AUTHORITATIVE Win Shares number (user decision, resolving the
  // discrepancy this comment used to flag as unresolved), not a side-by-side alternative to the
  // Advanced tab's DWS -- that column is now sourced from the same BDL number when available (see
  // advancedStats.js's computeSeasonPBPUncached). DEF_RATING is reused as-is since the two
  // sources' numbers matched almost exactly in that same spike.
  BDL_DREB_PCT: 'DREB%', BDL_DEF_WS: 'Def WS',
  OPP_PTS_PAINT: 'Opp Pts (Paint)', OPP_PTS_FASTBREAK: 'Opp Pts (FB)',
  OPP_PTS_OFF_TOV: 'Opp Pts (TOV)', OPP_PTS_2ND_CHANCE: 'Opp Pts (2nd Chance)',
};

const PCT_KEYS = new Set(['FG_PCT', 'FG3_PCT', 'FT_PCT', 'TS_PCT', 'EFG_PCT', 'TPAr', 'FTr', 'WS_PER48', 'PIE']);
const PCT100_KEYS = new Set([
  'TOV_PCT', 'USG_PCT', 'AST_PCT', 'ORB_PCT', 'DRB_PCT', 'TRB_PCT', 'STL_PCT', 'BLK_PCT',
  'TM_REB_PCT', 'TM_AST_PCT', 'TM_STL_PCT', 'TM_BLK_PCT', 'TM_TOV_PCT', 'TM_FGA_PCT', 'TM_FGM_PCT',
  'TM_FTA_PCT', 'TM_FTM_PCT', 'TM_PF_PCT', 'TM_PFD_PCT', 'TM_USG_PCT',
  'BDL_DREB_PCT',
]);

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
