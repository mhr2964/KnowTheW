// Tests for server/providers/balldontlie/defenseStats.js -- defense box score, BDL-only
// (no ESPN equivalent). Pure-function tests only, no network: mapDefenseStatsRow is split out
// from the fetch specifically to be testable this way, mirroring usageShare.js/scoringDistribution.js.

process.env.NODE_ENV = 'test';

const { test } = require('node:test');
const assert = require('node:assert');

const { mapDefenseStatsRow } = require('../server/providers/balldontlie/defenseStats');

// Real `stats` shape confirmed live (A'ja Wilson, id 535, season 2025 regular, measure_type=defense,
// per_mode=per_game spike, 2026-08-22). Trimmed to the fields this module reads plus a couple
// neighbors -- the real response also carries dozens of _rank variants and pct_blk/pct_stl
// (duplicates of usageShare.js's team-share fields) this module ignores.
const REAL_STATS = {
  gp: 40, blk: 2.3, stl: 1.6, dreb: 7.9, dreb_pct: 0.249, def_rating: 98.8, def_ws: 0.15,
  opp_pts_paint: 28, opp_pts_fb: 7.9, opp_pts_off_tov: 9.5, opp_pts_2_nd_chance: 7.9,
  pct_blk: 0.561, pct_stl: 0.248,
};

test('mapDefenseStatsRow: maps the real BDL field names to the app shape', () => {
  assert.deepStrictEqual(mapDefenseStatsRow(REAL_STATS), {
    gp: 40, blk: 2.3, stl: 1.6, dreb: 7.9, bdlDrebPct: 0.249, defRating: 98.8, bdlDefWs: 0.15,
    oppPtsPaint: 28, oppPtsFastbreak: 7.9, oppPtsOffTov: 9.5, oppPts2ndChance: 7.9,
  });
});

test('mapDefenseStatsRow: null/undefined stats returns null, not a crash', () => {
  assert.strictEqual(mapDefenseStatsRow(null), null);
  assert.strictEqual(mapDefenseStatsRow(undefined), null);
});

test('mapDefenseStatsRow: gp === 0 (or missing) returns null -- no BDL tracking data that side', () => {
  assert.strictEqual(mapDefenseStatsRow({ gp: 0, blk: 1 }), null);
  assert.strictEqual(mapDefenseStatsRow({ blk: 1 }), null);
});

test('mapDefenseStatsRow: a missing individual field defaults to null, not undefined', () => {
  const result = mapDefenseStatsRow({ gp: 10 });
  assert.strictEqual(result.blk, null);
  assert.strictEqual(result.bdlDefWs, null);
  assert.strictEqual(result.oppPtsPaint, null);
});
