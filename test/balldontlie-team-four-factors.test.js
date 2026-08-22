// Tests for server/providers/balldontlie/teamFourFactors.js -- Dean Oliver's Four Factors
// (eFG%/TOV%/OREB%/FT Rate) for a team and its opponents, BDL-only (no ESPN equivalent).
// Pure-function tests only, no network: mapFourFactorsRow is split out from the fetch
// specifically to be testable this way, mirroring the player-side measure_type providers.

process.env.NODE_ENV = 'test';

const { test } = require('node:test');
const assert = require('node:assert');

const { mapFourFactorsRow } = require('../server/providers/balldontlie/teamFourFactors');

// Real `stats` shape confirmed live (Las Vegas Aces, BDL team id 8, season 2025 regular,
// measure_type=four_factors spike, 2026-08-22). Trimmed to the fields this module reads plus a
// couple neighbors -- the real response also carries gp/w/l/min/w_pct and dozens of _rank variants
// this module ignores.
const REAL_STATS = {
  gp: 44, efg_pct: 0.506, fta_rate: 0.273, oreb_pct: 0.277, tm_tov_pct: 0.165,
  opp_efg_pct: 0.489, opp_tov_pct: 0.172, opp_fta_rate: 0.244, opp_oreb_pct: 0.313,
};

test('mapFourFactorsRow: maps the real BDL field names to the app shape', () => {
  assert.deepStrictEqual(mapFourFactorsRow(REAL_STATS), {
    efgPct: 0.506, tovPct: 0.165, orbPct: 0.277, ftRatePct: 0.273,
    oppEfgPct: 0.489, oppTovPct: 0.172, oppOrbPct: 0.313, oppFtRatePct: 0.244,
  });
});

test('mapFourFactorsRow: null/undefined stats returns null, not a crash', () => {
  assert.strictEqual(mapFourFactorsRow(null), null);
  assert.strictEqual(mapFourFactorsRow(undefined), null);
});

test('mapFourFactorsRow: gp === 0 (or missing) returns null -- no BDL tracking data that season', () => {
  assert.strictEqual(mapFourFactorsRow({ gp: 0, efg_pct: 0.5 }), null);
  assert.strictEqual(mapFourFactorsRow({ efg_pct: 0.5 }), null);
});

test('mapFourFactorsRow: a missing individual field defaults to null, not undefined', () => {
  const result = mapFourFactorsRow({ gp: 10 });
  assert.strictEqual(result.efgPct, null);
  assert.strictEqual(result.oppFtRatePct, null);
});
