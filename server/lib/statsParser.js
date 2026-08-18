// Builds Per-Game/Totals/Per-36 detailed-stats tables from a provider-neutral list of normalized
// PlayerSeasonRow objects (see server/providers/types.js). Each provider's own module is now
// responsible for parsing its raw source format into that shape -- espn/playerStats.js relocated
// ESPN's raw categories[]/dash-composite-name parsing there; this file no longer touches raw ESPN
// JSON at all. Percentages (FG_PCT/FG3_PCT/FT_PCT) are derived from made/attempted totals uniformly
// for every provider rather than trusting a source's own precomputed value, matching how per-36 was
// already derived here before this file was normalized.
//
// FG_PCT/FG3_PCT/FT_PCT are stored as 0-1 fractions (not 0-100) in the ESPN_DETAILED_HEADERS rows
// below -- this is the existing, pre-normalization convention (ESPN's raw pct fields arrived as
// 0-100 and were divided by 100), kept unchanged so client rendering and gradedReportInputs.js's
// rowToObj don't need to change. Note this differs from TeamStats.fgPct (0-100 scale) elsewhere in
// this codebase -- two different, already-established conventions for two different tables.

const { toColumnTable } = require('./statColumns');

const ESPN_DETAILED_HEADERS = [
  'SEASON_ID', 'TEAM_ABBREVIATION', 'GP', 'GS', 'MIN',
  'FGM', 'FGA', 'FG_PCT', 'FG3M', 'FG3A', 'FG3_PCT',
  'FTM', 'FTA', 'FT_PCT', 'OREB', 'DREB', 'REB',
  'AST', 'STL', 'BLK', 'TOV', 'PF', 'PTS',
];

const TOTALS_FIELDS = ['fgm', 'fga', 'fg3m', 'fg3a', 'ftm', 'fta', 'oreb', 'dreb', 'reb', 'ast', 'stl', 'blk', 'tov', 'pf', 'pts'];

// 0-1 fraction, matching the pre-existing ESPN_DETAILED_HEADERS convention (see file header).
function pct(made, att) {
  return att > 0 ? made / att : 0;
}

function avgRow(seasonId, teamAbbr, row) {
  const { gp, gs, totalMinutes, totals: t } = row;
  const perGame = v => (gp > 0 ? v / gp : 0);
  return [
    seasonId, teamAbbr,
    gp, gs, gp > 0 ? totalMinutes / gp : 0,
    perGame(t.fgm), perGame(t.fga), pct(t.fgm, t.fga),
    perGame(t.fg3m), perGame(t.fg3a), pct(t.fg3m, t.fg3a),
    perGame(t.ftm), perGame(t.fta), pct(t.ftm, t.fta),
    perGame(t.oreb), perGame(t.dreb), perGame(t.reb),
    perGame(t.ast), perGame(t.stl), perGame(t.blk), perGame(t.tov), perGame(t.pf), perGame(t.pts),
  ];
}

function totalsRow(seasonId, teamAbbr, row) {
  const { gp, gs, totalMinutes, totals: t } = row;
  return [
    seasonId, teamAbbr,
    gp, gs, totalMinutes,
    t.fgm, t.fga, pct(t.fgm, t.fga),
    t.fg3m, t.fg3a, pct(t.fg3m, t.fg3a),
    t.ftm, t.fta, pct(t.ftm, t.fta),
    t.oreb, t.dreb, t.reb,
    t.ast, t.stl, t.blk, t.tov, t.pf, t.pts,
  ];
}

function per36Row(seasonId, teamAbbr, row) {
  const { gp, gs, totalMinutes, totals: t } = row;
  const p36 = v => (totalMinutes > 0 ? (v / totalMinutes) * 36 : 0);
  return [
    seasonId, teamAbbr,
    gp, gs, totalMinutes,
    p36(t.fgm), p36(t.fga), pct(t.fgm, t.fga),
    p36(t.fg3m), p36(t.fg3a), pct(t.fg3m, t.fg3a),
    p36(t.ftm), p36(t.fta), pct(t.ftm, t.fta),
    p36(t.oreb), p36(t.dreb), p36(t.reb),
    p36(t.ast), p36(t.stl), p36(t.blk), p36(t.tov), p36(t.pf), p36(t.pts),
  ];
}

// Provider-neutral: { [year]: teamId } for every row in the season list. Trivial now that
// PlayerSeasonRow carries teamId directly -- previously had to dig it out of ESPN's raw 'averages'
// category.
function extractTeamIdByYear(seasons) {
  const map = {};
  for (const row of seasons ?? []) map[row.year] = row.teamId;
  return map;
}

// Sums every row's totals/gp/gs/minutes into one synthetic career PlayerSeasonRow, so the exact
// same avgRow/totalsRow/per36Row builders produce the career line too -- no separate
// ESPN-precomputed "career totals" field to trust/parse anymore, which also means the career row
// is always internally consistent with whatever per-year rows actually got returned (relevant once
// some years come from ESPN and others from BDL, in the hybrid provider).
function sumCareerRow(seasons) {
  const totals = Object.fromEntries(TOTALS_FIELDS.map(k => [k, 0]));
  let gp = 0, gs = 0, allHaveGs = true, totalMinutes = 0;
  for (const row of seasons) {
    for (const k of TOTALS_FIELDS) totals[k] += row.totals[k] ?? 0;
    gp += row.gp ?? 0;
    if (row.gs != null) gs += row.gs;
    else allHaveGs = false; // any season missing GS (e.g. BDL-era, no such field) -> don't report a
    // silently-undercounted career total; null is honest, a partial sum posing as complete isn't.
    totalMinutes += row.totalMinutes ?? 0;
  }
  return { gp, gs: allHaveGs ? gs : null, totalMinutes, totals };
}

// Builds the {pg, tot, p36} table set for one split (regular or playoffs) from its normalized
// season rows. Returns null if there's no data at all for this split -- same degradation as before.
function buildSeasonTables(seasons, teamsById) {
  if (!seasons || seasons.length === 0) return null;

  const pgRows = [], totRows = [], p36Rows = [];
  seasons.forEach(row => {
    const teamAbbr = teamsById[row.teamId]?.abbreviation || '';
    pgRows.push(avgRow(row.year, teamAbbr, row));
    totRows.push(totalsRow(row.year, teamAbbr, row));
    p36Rows.push(per36Row(row.year, teamAbbr, row));
  });

  const careerRow = sumCareerRow(seasons);
  const makeTable = rows => rows.length ? { headers: ESPN_DETAILED_HEADERS, rows } : null;
  const makeCareer = row => ({ headers: ESPN_DETAILED_HEADERS, rows: [row] });

  return {
    pg:  { table: makeTable(pgRows),  career: makeCareer(avgRow('Career', '', careerRow)) },
    tot: { table: makeTable(totRows), career: makeCareer(totalsRow('Career', '', careerRow)) },
    p36: { table: makeTable(p36Rows), career: makeCareer(per36Row('Career', '', careerRow)) },
  };
}

function buildDetailedStats(regSeasons, postSeasons, teamsById) {
  const reg = buildSeasonTables(regSeasons, teamsById);
  const post = buildSeasonTables(postSeasons, teamsById);
  const makeSplit = getter => ({
    regular:       reg  ? toColumnTable(getter(reg).table)  : null,
    regularCareer: reg  ? toColumnTable(getter(reg).career) : null,
    playoffs:      post ? toColumnTable(getter(post).table)  : null,
    playoffCareer: post ? toColumnTable(getter(post).career) : null,
  });
  return {
    source: 'espn',
    perGame: makeSplit(r => r.pg),
    totals:  makeSplit(r => r.tot),
    per36:   makeSplit(r => r.p36),
    per100:  null,
  };
}

module.exports = {
  ESPN_DETAILED_HEADERS,
  pct, avgRow, totalsRow, per36Row,
  extractTeamIdByYear, buildSeasonTables, sumCareerRow, buildDetailedStats,
};
