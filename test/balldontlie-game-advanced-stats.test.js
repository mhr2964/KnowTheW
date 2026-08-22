// Tests for server/providers/balldontlie/gameAdvancedStats.js -- pure mapping logic only, no network.

process.env.NODE_ENV = 'test';

const { test } = require('node:test');
const assert = require('node:assert');

const { mapGameAdvancedStatsRow } = require('../server/providers/balldontlie/gameAdvancedStats');

// Real shape confirmed live (Nneka Ogwumike, game 3866, 2026-08-22 spike) -- trimmed to a few
// fields per category, enough to prove the long-snake_case -> camelCase extraction is correct.
const REAL_STATS = {
  misc: { points_paint: 16, points_fast_break: 0, fouls_personal: 4, blocks: 0 },
  usage: { usage_percentage: 0.301, percentage_points: 0.319, percentage_assists: 0.13 },
  scoring: { percentage_points2pt: 0.783, percentage_points3pt: 0.13 },
  advanced: { offensive_rating: 100, defensive_rating: 83.1, net_rating: 16.9, pie: 0.256 },
  four_factors: { effective_field_goal_percentage: 0.484, team_turnover_percentage: 0.146 },
};

test('mapGameAdvancedStatsRow: extracts all five category bundles under camelCase keys', () => {
  const mapped = mapGameAdvancedStatsRow(REAL_STATS);
  assert.strictEqual(mapped.misc.pointsPaint, 16);
  assert.strictEqual(mapped.misc.foulsPersonal, 4);
  assert.strictEqual(mapped.usage.usagePct, 0.301);
  assert.strictEqual(mapped.scoring.pctPoints2pt, 0.783);
  assert.strictEqual(mapped.advanced.offRating, 100);
  assert.strictEqual(mapped.advanced.defRating, 83.1);
  assert.strictEqual(mapped.advanced.pie, 0.256);
  assert.strictEqual(mapped.fourFactors.efgPct, 0.484);
  assert.strictEqual(mapped.fourFactors.tovPct, 0.146);
});

test('mapGameAdvancedStatsRow: null stats -> null (no row for this player/game)', () => {
  assert.strictEqual(mapGameAdvancedStatsRow(null), null);
});

test('mapGameAdvancedStatsRow: a missing category bundle maps to undefined, not a crash', () => {
  const mapped = mapGameAdvancedStatsRow({ misc: REAL_STATS.misc });
  assert.ok(mapped.misc);
  assert.strictEqual(mapped.usage, undefined);
  assert.strictEqual(mapped.advanced, undefined);
});

test('mapGameAdvancedStatsRow: a missing field within a present category -> null, not undefined', () => {
  const mapped = mapGameAdvancedStatsRow({ advanced: { pie: 0.256 } });
  assert.strictEqual(mapped.advanced.pie, 0.256);
  assert.strictEqual(mapped.advanced.offRating, null);
});
