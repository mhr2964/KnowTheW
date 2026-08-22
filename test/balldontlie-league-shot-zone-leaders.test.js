// Tests for server/providers/balldontlie/leagueShotZoneLeaders.js -- pure ranking logic only, no
// network (fetchAllShotZoneRows is covered by leagueShotZones.js's own tests/live spikes).

process.env.NODE_ENV = 'test';

const { test } = require('node:test');
const assert = require('node:assert');

const { buildZoneLeaderboards, MIN_ZONE_FGA } = require('../server/providers/balldontlie/leagueShotZoneLeaders');

function row(id, firstName, lastName, teamAbbr, zones) {
  return {
    player: { id, first_name: firstName, last_name: lastName, team: { abbreviation: teamAbbr } },
    stats: { shot_zones: zones },
  };
}

test('buildZoneLeaderboards: ranks by FG% desc within a zone', () => {
  const rows = [
    row(1, 'A', 'One', 'LV', { restricted_area: { fga: 100, fgm: 70, fg_pct: 0.7 } }),
    row(2, 'B', 'Two', 'NY', { restricted_area: { fga: 100, fgm: 60, fg_pct: 0.6 } }),
    row(3, 'C', 'Three', 'CHI', { restricted_area: { fga: 100, fgm: 80, fg_pct: 0.8 } }),
  ];
  const zones = buildZoneLeaderboards(rows);
  const ra = zones.find(z => z.key === 'restricted_area');
  assert.deepStrictEqual(ra.leaders.map(l => l.name), ['C Three', 'A One', 'B Two']);
});

test('buildZoneLeaderboards: a zone attempt count below MIN_ZONE_FGA is excluded', () => {
  const rows = [
    row(1, 'Low', 'Volume', 'LV', { restricted_area: { fga: MIN_ZONE_FGA - 1, fgm: MIN_ZONE_FGA - 1, fg_pct: 1 } }),
    row(2, 'Real', 'Rotation', 'NY', { restricted_area: { fga: MIN_ZONE_FGA, fgm: 20, fg_pct: 20 / MIN_ZONE_FGA } }),
  ];
  const ra = buildZoneLeaderboards(rows).find(z => z.key === 'restricted_area');
  assert.strictEqual(ra.leaders.length, 1);
  assert.strictEqual(ra.leaders[0].name, 'Real Rotation');
});

test('buildZoneLeaderboards: ties on FG% break by FGA desc', () => {
  const rows = [
    row(1, 'Fewer', 'Attempts', 'LV', { mid_range: { fga: 20, fgm: 10, fg_pct: 0.5 } }),
    row(2, 'More', 'Attempts', 'NY', { mid_range: { fga: 40, fgm: 20, fg_pct: 0.5 } }),
  ];
  const mr = buildZoneLeaderboards(rows).find(z => z.key === 'mid_range');
  assert.deepStrictEqual(mr.leaders.map(l => l.name), ['More Attempts', 'Fewer Attempts']);
});

test('buildZoneLeaderboards: caps each zone at topN', () => {
  const rows = Array.from({ length: 20 }, (_, i) =>
    row(i, `P${i}`, 'X', 'LV', { backcourt: { fga: 25, fgm: i, fg_pct: i / 25 } }));
  const bc = buildZoneLeaderboards(rows, { topN: 5 }).find(z => z.key === 'backcourt');
  assert.strictEqual(bc.leaders.length, 5);
});

test('buildZoneLeaderboards: a row with no player id is skipped, not a crash', () => {
  const rows = [{ player: null, stats: { shot_zones: { mid_range: { fga: 50, fgm: 25, fg_pct: 0.5 } } } }];
  const mr = buildZoneLeaderboards(rows).find(z => z.key === 'mid_range');
  assert.strictEqual(mr.leaders.length, 0);
});
