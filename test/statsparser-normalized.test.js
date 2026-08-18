// Tests for the normalized-input rewrite of server/lib/statsParser.js -- input is now provider-
// neutral PlayerSeasonRow[] (server/providers/types.js), not raw ESPN JSON. Verified separately
// (this session, via git-stash old/new diff against A'ja Wilson's real career) that the output
// numerically matches the pre-refactor implementation within floating-point rounding tolerance;
// these tests lock in the row-building math and edge cases going forward.

process.env.NODE_ENV = 'test';

const { test } = require('node:test');
const assert = require('node:assert');

const {
  pct, avgRow, totalsRow, per36Row,
  extractTeamIdByYear, buildSeasonTables, sumCareerRow, buildDetailedStats,
} = require('../server/lib/statsParser');

function row(overrides = {}) {
  return {
    year: '2024', teamId: '5', gp: 30, gs: 28, totalMinutes: 900,
    totals: { fgm: 150, fga: 300, fg3m: 30, fg3a: 90, ftm: 100, fta: 120, oreb: 30, dreb: 150, reb: 180, ast: 90, stl: 30, blk: 15, tov: 60, pf: 75, pts: 430 },
    ...overrides,
  };
}

// --- pct ---

test('pct: returns a 0-1 fraction, not 0-100 (existing ESPN_DETAILED_HEADERS convention)', () => {
  assert.strictEqual(pct(150, 300), 0.5);
});

test('pct: zero attempts -> 0, not NaN', () => {
  assert.strictEqual(pct(0, 0), 0);
});

// --- avgRow / totalsRow / per36Row ---

test('avgRow: per-game values derived from totals/gp; FG_PCT is a 0-1 fraction', () => {
  const r = avgRow('2024', 'SEA', row());
  assert.strictEqual(r[2], 30); // GP
  assert.strictEqual(r[3], 28); // GS
  assert.strictEqual(r[4], 30); // MIN (900/30)
  assert.strictEqual(r[5], 5);  // FGM (150/30)
  assert.strictEqual(r[6], 10); // FGA (300/30)
  assert.strictEqual(r[7], 0.5); // FG_PCT
});

test('avgRow: gp 0 -> every per-game figure is 0, not NaN/Infinity', () => {
  const r = avgRow('2024', 'SEA', row({ gp: 0, totalMinutes: 0 }));
  assert.strictEqual(r[4], 0);
  assert.strictEqual(r[5], 0);
});

test('totalsRow: raw counts pass through unchanged, MIN is the total (not per-game)', () => {
  const r = totalsRow('2024', 'SEA', row());
  assert.strictEqual(r[4], 900); // MIN
  assert.strictEqual(r[5], 150); // FGM
  assert.strictEqual(r[22], 430); // PTS (last column)
});

test('per36Row: scales totals to a 36-minute basis', () => {
  const r = per36Row('2024', 'SEA', row());
  assert.strictEqual(r[5], (150 / 900) * 36); // FGM per-36
});

test('per36Row: zero total minutes -> 0, not NaN/Infinity', () => {
  const r = per36Row('2024', 'SEA', row({ totalMinutes: 0 }));
  assert.strictEqual(r[5], 0);
});

// --- extractTeamIdByYear ---

test('extractTeamIdByYear: maps year -> teamId directly from the row list', () => {
  const map = extractTeamIdByYear([row({ year: '2023', teamId: '9' }), row({ year: '2024', teamId: '5' })]);
  assert.deepStrictEqual(map, { '2023': '9', '2024': '5' });
});

test('extractTeamIdByYear: null/empty input -> {}', () => {
  assert.deepStrictEqual(extractTeamIdByYear(null), {});
  assert.deepStrictEqual(extractTeamIdByYear([]), {});
});

// --- sumCareerRow ---

test('sumCareerRow: sums totals/gp/minutes across every row', () => {
  const career = sumCareerRow([row({ gp: 30, totalMinutes: 900 }), row({ gp: 20, totalMinutes: 600 })]);
  assert.strictEqual(career.gp, 50);
  assert.strictEqual(career.totalMinutes, 1500);
  assert.strictEqual(career.totals.pts, 860); // 430 * 2
});

test('sumCareerRow: gs is null in the career row if ANY contributing row has gs null (BDL-era mixed in)', () => {
  const career = sumCareerRow([row({ gs: 28 }), row({ gs: null })]);
  assert.strictEqual(career.gs, null);
});

test('sumCareerRow: gs sums normally when every row has a real gs', () => {
  const career = sumCareerRow([row({ gs: 28 }), row({ gs: 20 })]);
  assert.strictEqual(career.gs, 48);
});

// --- buildSeasonTables / buildDetailedStats ---

test('buildSeasonTables: null on empty/null input', () => {
  assert.strictEqual(buildSeasonTables(null, {}), null);
  assert.strictEqual(buildSeasonTables([], {}), null);
});

test('buildSeasonTables: teamAbbr resolved via teamsById, empty string if unknown', () => {
  const tables = buildSeasonTables([row({ teamId: '5' })], { 5: { abbreviation: 'SEA' } });
  assert.strictEqual(tables.pg.table.rows[0][1], 'SEA');
});

test('buildSeasonTables: unknown teamId -> empty-string abbreviation, not a crash', () => {
  const tables = buildSeasonTables([row({ teamId: '999' })], {});
  assert.strictEqual(tables.pg.table.rows[0][1], '');
});

test('buildDetailedStats: a player with only playoff data has null regular splits, populated playoff splits', () => {
  const result = buildDetailedStats(null, [row()], { 5: { abbreviation: 'SEA' } });
  assert.strictEqual(result.perGame.regular, null);
  assert.strictEqual(result.perGame.regularCareer, null);
  assert.ok(result.perGame.playoffs);
  assert.ok(result.perGame.playoffCareer);
});

test('buildDetailedStats: career row is internally consistent with the season rows it was built from', () => {
  const rows = [row({ year: '2023', gp: 20, totalMinutes: 600, totals: { ...row().totals, pts: 300 } }), row({ year: '2024', gp: 30, totalMinutes: 900, totals: { ...row().totals, pts: 430 } })];
  const result = buildDetailedStats(rows, null, { 5: { abbreviation: 'SEA' } });
  // Career totals PTS (index 22, the last column) should equal the sum of both season rows' PTS.
  const totCareerPts = result.totals.regularCareer.rows[0][22];
  assert.strictEqual(totCareerPts, 730);
});
