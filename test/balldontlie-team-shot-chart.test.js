// Tests for server/providers/balldontlie/teamShotChart.js -- team-level zone-aggregated shot chart,
// both the "own" (base) and "opponent" framings. Pure-function tests only, no network:
// buildTeamShotChartFromRow is split out from the fetch specifically to be testable this way,
// mirroring the player-side shotChart.js's buildShotChartFromRow tests.

process.env.NODE_ENV = 'test';

const { test } = require('node:test');
const assert = require('node:assert');

const { buildTeamShotChartFromRow } = require('../server/providers/balldontlie/teamShotChart');

// Real `stats.shot_zones` shape confirmed live (Las Vegas Aces, BDL team id 8, season 2025 regular,
// 2026-08-22). Trimmed to a few zones -- the real response includes all 7 real zones plus the
// redundant corner_3 (left+right summed), which this module ignores same as the player-side one.
const REAL_ROW_BASE = {
  season: 2025,
  stats: {
    shot_zones: {
      corner_3: { fga: 175, fgm: 68, fg_pct: 0.389 },
      restricted_area: { fga: 460, fgm: 290, fg_pct: 0.63 },
      mid_range: { fga: 477, fgm: 204, fg_pct: 0.428 },
      backcourt: { fga: 4, fgm: 0, fg_pct: 0 },
    },
  },
};

const REAL_ROW_OPPONENT = {
  season: 2025,
  stats: {
    shot_zones: {
      corner_3: { opp_fga: 0, opp_fgm: 0, opp_fg_pct: 0 },
      restricted_area: { opp_fga: 707, opp_fgm: 452, opp_fg_pct: 0.639 },
      mid_range: { opp_fga: 502, opp_fgm: 199, opp_fg_pct: 0.396 },
      backcourt: { opp_fga: 10, opp_fgm: 0, opp_fg_pct: 0 },
    },
  },
};

test('buildTeamShotChartFromRow: base/own framing reads unprefixed fields', () => {
  const result = buildTeamShotChartFromRow(REAL_ROW_BASE, '');
  assert.strictEqual(result.season, 2025);
  const ra = result.zones.find(z => z.key === 'restricted_area');
  assert.deepStrictEqual(ra, { key: 'restricted_area', label: 'Restricted Area', fga: 460, fgm: 290, fgPct: 0.63 });
});

test('buildTeamShotChartFromRow: opponent framing reads opp_-prefixed fields', () => {
  const result = buildTeamShotChartFromRow(REAL_ROW_OPPONENT, 'opp_');
  const ra = result.zones.find(z => z.key === 'restricted_area');
  assert.deepStrictEqual(ra, { key: 'restricted_area', label: 'Restricted Area', fga: 707, fgm: 452, fgPct: 0.639 });
});

test('buildTeamShotChartFromRow: corner_3 (redundant left+right sum) is not a real zone key', () => {
  const result = buildTeamShotChartFromRow(REAL_ROW_BASE, '');
  assert.ok(!result.zones.some(z => z.key === 'corner_3'));
});

test('buildTeamShotChartFromRow: a missing zone defaults to fga:0/fgm:0/fgPct:0, not a crash', () => {
  const result = buildTeamShotChartFromRow(REAL_ROW_BASE, '');
  const leftCorner = result.zones.find(z => z.key === 'left_corner_3');
  assert.deepStrictEqual(leftCorner, { key: 'left_corner_3', label: 'Left Corner 3', fga: 0, fgm: 0, fgPct: 0 });
});

test('buildTeamShotChartFromRow: null row returns all-zero zones, not a crash', () => {
  const result = buildTeamShotChartFromRow(null, '');
  assert.ok(Number.isNaN(result.season)); // Number(undefined) -- caller guards on the row existing at all
  assert.strictEqual(result.zones.every(z => z.fga === 0), true);
});
