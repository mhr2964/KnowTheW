// Tests for server/providers/balldontlie/scoringDistribution.js -- percentage-of-points breakdown,
// BDL-only (no ESPN equivalent). Pure-function tests only, no network: mapScoringStatsRow is split
// out from the fetch specifically to be testable this way, mirroring clutchSplits.js.

process.env.NODE_ENV = 'test';

const { test } = require('node:test');
const assert = require('node:assert');

const { mapScoringStatsRow } = require('../server/providers/balldontlie/scoringDistribution');

// Real `stats` shape confirmed live (A'ja Wilson, id 535, season 2025 regular, measure_type=scoring,
// per_mode=per_game spike, 2026-08-22). Trimmed to the fields this module reads plus a couple
// neighbors -- the real response also carries dozens of _rank variants this module ignores.
const REAL_STATS = {
  gp: 40, pct_pts_fb: 0.074, pct_pts_ft: 0.265, pct_ast_fgm: 0.72, pct_ast_2_pm: 0.697,
  pct_ast_3_pm: 1, pct_pts_2_pt: 0.655, pct_pts_3_pt: 0.08, pct_uast_fgm: 0.28,
  pct_pts_paint: 0.514, pct_uast_2_pm: 0.303, pct_uast_3_pm: 0, pct_pts_2_pt_mr: 0.141,
  pct_pts_off_tov: 0.2,
};

test('mapScoringStatsRow: maps the real BDL field names into grouped percentage buckets', () => {
  assert.deepStrictEqual(mapScoringStatsRow(REAL_STATS), {
    gp: 40,
    pointsBreakdown: { twoPt: 0.655, threePt: 0.08, ft: 0.265 },
    whereItHappens: { paint: 0.514, midRange: 0.141, fastbreak: 0.074, offTurnovers: 0.2 },
    assistedVsUnassisted: {
      overall: { assisted: 0.72, unassisted: 0.28 },
      twoPm: { assisted: 0.697, unassisted: 0.303 },
      threePm: { assisted: 1, unassisted: 0 },
    },
  });
});

test('mapScoringStatsRow: the points-breakdown group sums to 1 (every point is a 2, a 3, or a FT)', () => {
  const result = mapScoringStatsRow(REAL_STATS);
  const { twoPt, threePt, ft } = result.pointsBreakdown;
  assert.ok(Math.abs(twoPt + threePt + ft - 1) < 1e-9);
});

test('mapScoringStatsRow: null/undefined stats returns null, not a crash', () => {
  assert.strictEqual(mapScoringStatsRow(null), null);
  assert.strictEqual(mapScoringStatsRow(undefined), null);
});

test('mapScoringStatsRow: gp === 0 (or missing) returns null -- no scoring appearances that side', () => {
  assert.strictEqual(mapScoringStatsRow({ gp: 0, pct_pts_2_pt: 0.5 }), null);
  assert.strictEqual(mapScoringStatsRow({ pct_pts_2_pt: 0.5 }), null);
});

test('mapScoringStatsRow: a missing individual field defaults to null, not undefined', () => {
  const result = mapScoringStatsRow({ gp: 10 });
  assert.strictEqual(result.pointsBreakdown.twoPt, null);
  assert.strictEqual(result.assistedVsUnassisted.overall.assisted, null);
});
