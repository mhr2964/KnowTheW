// Tests for server/providers/balldontlie/defenseStats.js -- defense box score, BDL-only
// (no ESPN equivalent). Pure-function tests only, no network: mapDefenseStatsRow is split out
// from the fetch specifically to be testable this way, mirroring usageShare.js/scoringDistribution.js.

process.env.NODE_ENV = 'test';

const { test } = require('node:test');
const assert = require('node:assert');

const { mapDefenseStatsRow } = require('../server/providers/balldontlie/defenseStats');

// Real `stats` shape confirmed live (A'ja Wilson, id 535, season 2025 regular, measure_type=defense,
// per_mode=TOTALS spike, 2026-08-22 -- fetchPlayerSeasonDefenseBdl fetches totals, not per_game, so
// def_ws comes back as a real season total (6.01) instead of per_mode='per_game''s silently-wrong
// per-game figure (0.15 = 6.01 ÷ 40 games) an earlier version of this file actually shipped with —
// see this file's header comment. Trimmed to the fields this module reads plus a couple neighbors
// -- the real response also carries dozens of _rank variants and pct_blk/pct_stl (duplicates of
// usageShare.js's team-share fields) this module ignores.
const REAL_STATS = {
  gp: 40, blk: 92, stl: 64, dreb: 316, dreb_pct: 0.249, def_rating: 98.8, def_ws: 6.01,
  opp_pts_paint: 1120, opp_pts_fb: 316, opp_pts_off_tov: 379, opp_pts_2_nd_chance: 316,
  pct_blk: 0.561, pct_stl: 0.248,
};

test('mapDefenseStatsRow: maps the real BDL field names to the app shape, deriving per-game counting stats from the totals response', () => {
  assert.deepStrictEqual(mapDefenseStatsRow(REAL_STATS), {
    gp: 40, blk: 2.3, stl: 1.6, dreb: 7.9, bdlDrebPct: 0.249, defRating: 98.8, bdlDefWs: 6.01,
    oppPtsPaint: 28, oppPtsFastbreak: 7.9, oppPtsOffTov: 9.475, oppPts2ndChance: 7.9,
  });
});

test('mapDefenseStatsRow: bdlDefWs is the raw season total, NOT divided by gp -- Win Shares is always a season total, never per-game', () => {
  const result = mapDefenseStatsRow({ gp: 40, def_ws: 6.01 });
  assert.strictEqual(result.bdlDefWs, 6.01);
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
