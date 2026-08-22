// Tests for server/providers/balldontlie/advancedRatings.js -- Off/Def/Net Rating + PIE, BDL-only
// (no ESPN equivalent). Pure-function tests only, no network: mapAdvancedStatsRow is split out from
// the fetch specifically to be testable this way, mirroring shotChart.js's buildShotChartFromRow.

process.env.NODE_ENV = 'test';

const { test } = require('node:test');
const assert = require('node:assert');

const { mapAdvancedStatsRow } = require('../server/providers/balldontlie/advancedRatings');

// Real `stats` shape confirmed live (A'ja Wilson, id 535, season 2025 regular, measure_type=advanced
// spike, 2026-08-21). Trimmed to the fields this module reads plus a few neighbors, to keep the
// fixture legible -- the real response also carries dozens of _e/_rank variants this module ignores.
const REAL_STATS = {
  gp: 40, min: 31.2, pie: 0.22, usg_pct: 0.307, ts_pct: 0.596,
  def_rating: 98.8, net_rating: 11.7, off_rating: 110.6,
  pie_rank: 1, def_rating_rank: 64, net_rating_rank: 15, off_rating_rank: 5,
};

test('mapAdvancedStatsRow: maps the real BDL field names to the app camelCase shape', () => {
  assert.deepStrictEqual(mapAdvancedStatsRow(REAL_STATS), {
    offRating: 110.6, defRating: 98.8, netRating: 11.7, pie: 0.22,
  });
});

test('mapAdvancedStatsRow: null stats (no data.data[0] from BDL) returns null, not a crash', () => {
  assert.strictEqual(mapAdvancedStatsRow(null), null);
  assert.strictEqual(mapAdvancedStatsRow(undefined), null);
});

test('mapAdvancedStatsRow: a missing individual field defaults to null, not undefined', () => {
  const result = mapAdvancedStatsRow({ off_rating: 110.6 });
  assert.deepStrictEqual(result, { offRating: 110.6, defRating: null, netRating: null, pie: null });
});
