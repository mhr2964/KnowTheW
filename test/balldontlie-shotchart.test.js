// Tests for server/providers/balldontlie/shotChart.js -- zone-aggregated shot chart, BDL-only
// (no ESPN equivalent). Pure-function tests only, no network: buildShotChartFromRow is split out
// from the fetch specifically to be testable this way, mirroring gameLog.js's buildStatsBag.

process.env.NODE_ENV = 'test';

const { test } = require('node:test');
const assert = require('node:assert');

const { buildShotChartFromRow, ZONES } = require('../server/providers/balldontlie/shotChart');

// Real row shape confirmed live (A'ja Wilson, id 535, season 2025 by_zone spike, 2026-08-18).
const REAL_ROW = {
  season: 2025,
  stats: {
    shot_zones: {
      corner_3: { fga: 4, fgm: 2, fg_pct: 0.5 },
      backcourt: { fga: 0, fgm: 0, fg_pct: 0 },
      mid_range: { fga: 146, fgm: 66, fg_pct: 0.452 },
      left_corner_3: { fga: 1, fgm: 0, fg_pct: 0 },
      right_corner_3: { fga: 3, fgm: 2, fg_pct: 0.667 },
      restricted_area: { fga: 130, fgm: 91, fg_pct: 0.7 },
      above_the_break_3: { fga: 55, fgm: 23, fg_pct: 0.418 },
      in_the_paint_non_ra: { fga: 323, fgm: 150, fg_pct: 0.464 },
    },
  },
};

test('buildShotChartFromRow: maps all 7 real zones with exact fga/fgm/fgPct', () => {
  const result = buildShotChartFromRow(REAL_ROW);
  assert.strictEqual(result.season, 2025);
  assert.strictEqual(result.zones.length, ZONES.length);

  const byKey = Object.fromEntries(result.zones.map(z => [z.key, z]));
  assert.deepStrictEqual(byKey.restricted_area, { key: 'restricted_area', label: 'Restricted Area', fga: 130, fgm: 91, fgPct: 0.7 });
  assert.deepStrictEqual(byKey.mid_range, { key: 'mid_range', label: 'Mid-Range', fga: 146, fgm: 66, fgPct: 0.452 });
  assert.strictEqual(byKey.left_corner_3.fga, 1);
  assert.strictEqual(byKey.right_corner_3.fga, 3);
});

test('buildShotChartFromRow: drops the redundant combined corner_3 field', () => {
  const result = buildShotChartFromRow(REAL_ROW);
  assert.ok(!result.zones.some(z => z.key === 'corner_3'));
});

test('buildShotChartFromRow: zero-fga zone gets fgPct 0, not NaN', () => {
  const result = buildShotChartFromRow(REAL_ROW);
  const backcourt = result.zones.find(z => z.key === 'backcourt');
  assert.deepStrictEqual(backcourt, { key: 'backcourt', label: 'Backcourt', fga: 0, fgm: 0, fgPct: 0 });
});

test('buildShotChartFromRow: missing zone in the response defaults to zeros, not a crash', () => {
  const partialRow = { season: 2022, stats: { shot_zones: { restricted_area: { fga: 10, fgm: 5, fg_pct: 0.5 } } } };
  const result = buildShotChartFromRow(partialRow);
  assert.strictEqual(result.zones.length, ZONES.length);
  const midRange = result.zones.find(z => z.key === 'mid_range');
  assert.deepStrictEqual(midRange, { key: 'mid_range', label: 'Mid-Range', fga: 0, fgm: 0, fgPct: 0 });
});

test('buildShotChartFromRow: season is coerced to a number', () => {
  const result = buildShotChartFromRow({ ...REAL_ROW, season: '2025' });
  assert.strictEqual(result.season, 2025);
});
