// Tests for server/providers/balldontlie/clutchSplits.js -- clutch-scope box score, BDL-only (no
// ESPN equivalent). Pure-function tests only, no network: mapClutchStatsRow is split out from the
// fetch specifically to be testable this way, mirroring advancedRatings.js's mapAdvancedStatsRow.

process.env.NODE_ENV = 'test';

const { test } = require('node:test');
const assert = require('node:assert');

const { mapClutchStatsRow } = require('../server/providers/balldontlie/clutchSplits');

// Real `stats` shape confirmed live (A'ja Wilson, id 535, season 2025 regular, scope=clutch,
// measure_type=base, per_mode=per_game spike, 2026-08-22). Trimmed to the fields this module reads
// plus a few neighbors -- the real response also carries dozens of _rank variants this module ignores.
const REAL_STATS = {
  gp: 15, min: 3.1, pf: 0.1, ast: 0.4, blk: 0.2, fga: 1.3, fgm: 0.6, fta: 1.9, ftm: 1.5,
  pts: 2.7, reb: 1.4, stl: 0.1, tov: 0.2, dreb: 1.1, oreb: 0.3, fg3_a: 0.1, fg3_m: 0,
  fg_pct: 0.45, ft_pct: 0.786, fg3_pct: 0, wnba_fantasy_pts: 5.1, nba_fantasy_pts: 5.7,
};

test('mapClutchStatsRow: maps the real BDL field names to the app camelCase shape', () => {
  assert.deepStrictEqual(mapClutchStatsRow(REAL_STATS), {
    gp: 15, min: 3.1,
    fgm: 0.6, fga: 1.3, fgPct: 0.45,
    fg3m: 0, fg3a: 0.1, fg3Pct: 0,
    ftm: 1.5, fta: 1.9, ftPct: 0.786,
    oreb: 0.3, dreb: 1.1, reb: 1.4,
    ast: 0.4, stl: 0.1, blk: 0.2, tov: 0.2, pf: 0.1, pts: 2.7,
    fantasyPts: 5.1,
  });
});

test('mapClutchStatsRow: null stats (no data.data[0] from BDL) returns null, not a crash', () => {
  assert.strictEqual(mapClutchStatsRow(null), null);
  assert.strictEqual(mapClutchStatsRow(undefined), null);
});

test('mapClutchStatsRow: a missing individual field defaults to null, not undefined', () => {
  const result = mapClutchStatsRow({ pts: 2.7 });
  assert.strictEqual(result.pts, 2.7);
  assert.strictEqual(result.ast, null);
  assert.strictEqual(result.fantasyPts, null);
});
