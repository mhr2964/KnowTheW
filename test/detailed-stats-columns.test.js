// Characterization test for STAT_COLUMNS (server/lib/statColumns.js) and its two consumers:
// buildDetailedStats() (statsParser.js), which now emits {columns,rows} instead of {headers,rows}
// on its HTTP-facing splits, and buildAdvancedSplit/buildAdvancedCareer (advancedStats.js), which
// now index off the ESPN_DETAILED_HEADERS constant directly rather than reading `.headers` off the
// passed-in table — so the HTTP response shape can change (headers -> columns) without silently
// breaking internal row-indexing. No ESPN or Mongo calls.

process.env.NODE_ENV = 'test';

const { test } = require('node:test');
const assert = require('node:assert');

const { columnFor, columnsFor, toColumnTable, LABELS } = require('../server/lib/statColumns');
const { ESPN_DETAILED_HEADERS } = require('../server/lib/statsParser');
const { buildAdvancedSplit, buildAdvancedCareer, ADV_HEADERS_SRV } = require('../server/lib/advancedStats');

test('columnFor covers all three kinds', () => {
  assert.deepStrictEqual(columnFor('PTS'), { key: 'PTS', label: 'PTS', kind: 'num' });
  assert.deepStrictEqual(columnFor('FG_PCT'), { key: 'FG_PCT', label: 'FG%', kind: 'pct' });
  assert.deepStrictEqual(columnFor('USG_PCT'), { key: 'USG_PCT', label: 'USG%', kind: 'pct100' });
});

test('columnFor falls back to the raw key when no label is known', () => {
  assert.deepStrictEqual(columnFor('MYSTERY_STAT'), { key: 'MYSTERY_STAT', label: 'MYSTERY_STAT', kind: 'num' });
});

test('columnsFor maps a header array in order', () => {
  const out = columnsFor(['SEASON_ID', 'FG_PCT']);
  assert.deepStrictEqual(out.map(c => c.key), ['SEASON_ID', 'FG_PCT']);
  assert.strictEqual(out[1].kind, 'pct');
});

test('toColumnTable replaces headers with columns and leaves rows untouched', () => {
  const table = { headers: ['SEASON_ID', 'PTS'], rows: [['2024', 20]] };
  const out = toColumnTable(table);
  assert.deepStrictEqual(out.columns, columnsFor(['SEASON_ID', 'PTS']));
  assert.deepStrictEqual(out.rows, table.rows);
  assert.strictEqual(out.headers, undefined);
});

test('toColumnTable passes null/undefined through unchanged', () => {
  assert.strictEqual(toColumnTable(null), null);
  assert.strictEqual(toColumnTable(undefined), undefined);
});

test('every ESPN_DETAILED_HEADERS and ADV_HEADERS_SRV key has a real label (no silent key-as-label fallback)', () => {
  for (const h of [...ESPN_DETAILED_HEADERS, ...ADV_HEADERS_SRV]) {
    assert.ok(LABELS[h], `missing LABELS entry for ${h}`);
  }
});

function pgRow(overrides = {}) {
  const I = Object.fromEntries(ESPN_DETAILED_HEADERS.map((h, i) => [h, i]));
  const row = new Array(ESPN_DETAILED_HEADERS.length).fill(0);
  row[I.SEASON_ID] = overrides.SEASON_ID ?? '2024';
  row[I.TEAM_ABBREVIATION] = overrides.TEAM_ABBREVIATION ?? 'SEA';
  row[I.GP] = overrides.GP ?? 30;
  row[I.MIN] = overrides.MIN ?? 25;
  row[I.FGA] = overrides.FGA ?? 10;
  row[I.FGM] = overrides.FGM ?? 5;
  return row;
}

test('buildAdvancedSplit indexes correctly on a table with no headers field at all', () => {
  const src = { rows: [pgRow()] };
  const out = buildAdvancedSplit(src, {}, {}, null);
  assert.strictEqual(out.rows.length, 1);
  assert.strictEqual(out.rows[0][0], '2024');
  assert.strictEqual(out.rows[0][1], 'SEA');
  assert.strictEqual(out.rows[0][2], 30);
  assert.deepStrictEqual(out.headers, ADV_HEADERS_SRV);
});

test('buildAdvancedSplit indexes correctly on a table shaped like the post-refactor HTTP response ({columns, rows})', () => {
  const src = { columns: columnsFor(ESPN_DETAILED_HEADERS), rows: [pgRow({ SEASON_ID: '2023', GP: 22 })] };
  const out = buildAdvancedSplit(src, {}, {}, null);
  assert.strictEqual(out.rows[0][0], '2023');
  assert.strictEqual(out.rows[0][2], 22);
});

test('buildAdvancedCareer indexes correctly regardless of the passed-in table shape', () => {
  const pgSrc = { rows: [pgRow({ SEASON_ID: 'Career', GP: 100 })] };
  const out = buildAdvancedCareer(pgSrc, null);
  assert.strictEqual(out.rows[0][0], 'Career');
  assert.strictEqual(out.rows[0][2], 100);
  assert.deepStrictEqual(out.headers, ADV_HEADERS_SRV);
});
