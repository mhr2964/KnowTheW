// Tests for server/providers/balldontlie/usageShare.js -- on-floor team-share box score, BDL-only
// (no ESPN equivalent). Pure-function tests only, no network: mapUsageStatsRow is split out from
// the fetch specifically to be testable this way, mirroring clutchSplits.js/scoringDistribution.js.

process.env.NODE_ENV = 'test';

const { test } = require('node:test');
const assert = require('node:assert');

const { mapUsageStatsRow } = require('../server/providers/balldontlie/usageShare');

// Real `stats` shape confirmed live (A'ja Wilson, id 535, season 2025 regular, measure_type=usage,
// per_mode=per_game spike, 2026-08-22). Trimmed to the fields this module reads plus a couple
// neighbors -- the real response also carries dozens of _rank variants this module ignores.
const REAL_STATS = {
  gp: 40, pct_pf: 0.156, pct_ast: 0.18, pct_blk: 0.561, pct_fga: 0.305, pct_fgm: 0.337,
  pct_fta: 0.483, pct_ftm: 0.496, pct_pfd: 0.465, pct_pts: 0.34, pct_reb: 0.372, pct_stl: 0.248,
  pct_tov: 0.234, usg_pct: 0.307,
};

test('mapUsageStatsRow: maps the real BDL field names to the TM_-prefixed app shape', () => {
  assert.deepStrictEqual(mapUsageStatsRow(REAL_STATS), {
    gp: 40,
    tmRebPct: 0.372, tmAstPct: 0.18, tmStlPct: 0.248, tmBlkPct: 0.561, tmTovPct: 0.234,
    tmFgaPct: 0.305, tmFgmPct: 0.337, tmFtaPct: 0.483, tmFtmPct: 0.496,
    tmPfPct: 0.156, tmPfdPct: 0.465, tmUsgPct: 0.307,
  });
});

test('mapUsageStatsRow: null/undefined stats returns null, not a crash', () => {
  assert.strictEqual(mapUsageStatsRow(null), null);
  assert.strictEqual(mapUsageStatsRow(undefined), null);
});

test('mapUsageStatsRow: gp === 0 (or missing) returns null -- no BDL tracking data that side', () => {
  assert.strictEqual(mapUsageStatsRow({ gp: 0, pct_reb: 0.3 }), null);
  assert.strictEqual(mapUsageStatsRow({ pct_reb: 0.3 }), null);
});

test('mapUsageStatsRow: a missing individual field defaults to null, not undefined', () => {
  const result = mapUsageStatsRow({ gp: 10 });
  assert.strictEqual(result.tmRebPct, null);
  assert.strictEqual(result.tmUsgPct, null);
});
