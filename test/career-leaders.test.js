// Tests for server/lib/careerLeaders.js's pure accumulation/ranking logic. No network.

process.env.NODE_ENV = 'test';

const { test } = require('node:test');
const assert = require('node:assert');

const { accumulateCareerTotals, buildCareerLeaderboards, CATEGORIES, TOP_N } = require('../server/lib/careerLeaders');

// Same player across two seasons, identified consistently by canonicalId.
const SEASON_ENTRIES = [
  { canonicalId: '1', name: "A'ja Wilson", teamAbbr: 'LV', PTS: 600, REB: 300, AST: 50, STL: 40, BLK: 60 },
  { canonicalId: '1', name: "A'ja Wilson", teamAbbr: 'LV', PTS: 650, REB: 320, AST: 55, STL: 45, BLK: 65 },
  { canonicalId: '2', name: 'Napheesa Collier', teamAbbr: 'MIN', PTS: 700, REB: 250, AST: 80, STL: 50, BLK: 30 },
  { canonicalId: null, name: 'Unresolved Legend', teamAbbr: 'CHI', PTS: 900, REB: 100, AST: 20, STL: 10, BLK: 5 },
];

test('accumulateCareerTotals: sums a player\'s stats across multiple seasons', () => {
  const acc = accumulateCareerTotals(SEASON_ENTRIES);
  const wilson = acc.find(a => a.playerId === '1');
  assert.strictEqual(wilson.PTS, 1250);
  assert.strictEqual(wilson.seasons, 2);
});

test('accumulateCareerTotals: an unresolved playerId (null) groups by name, not dropped or merged with others', () => {
  const acc = accumulateCareerTotals(SEASON_ENTRIES);
  const legend = acc.find(a => a.name === 'Unresolved Legend');
  assert.ok(legend);
  assert.strictEqual(legend.playerId, null);
  assert.strictEqual(legend.PTS, 900);
});

test('accumulateCareerTotals: distinct players are not merged together', () => {
  const acc = accumulateCareerTotals(SEASON_ENTRIES);
  assert.strictEqual(acc.length, 3); // Wilson (2 seasons merged), Collier, Unresolved Legend
});

test('buildCareerLeaderboards: ranks by career total descending', () => {
  const acc = accumulateCareerTotals(SEASON_ENTRIES);
  const boards = buildCareerLeaderboards(acc);
  const pts = boards.find(b => b.key === 'PTS');
  // Wilson's two seasons combine to 1250, beating Unresolved Legend's single 900-point season.
  assert.deepStrictEqual(pts.leaders.map(l => l.name), ["A'ja Wilson", 'Unresolved Legend', 'Napheesa Collier']);
  assert.strictEqual(pts.leaders[0].value, 1250);
});

test('buildCareerLeaderboards: rounds the value (Totals mode float noise from per-game*gp compounds across seasons)', () => {
  const acc = accumulateCareerTotals([
    { canonicalId: '9', name: 'Float Noise', teamAbbr: 'X', PTS: 100.33, REB: 0, AST: 0, STL: 0, BLK: 0 },
    { canonicalId: '9', name: 'Float Noise', teamAbbr: 'X', PTS: 200.29, REB: 0, AST: 0, STL: 0, BLK: 0 },
  ]);
  const boards = buildCareerLeaderboards(acc);
  const pts = boards.find(b => b.key === 'PTS');
  assert.strictEqual(pts.leaders[0].value, 301); // 300.62 rounded, not shown with float noise
});

test('buildCareerLeaderboards: covers every default category and caps at topN', () => {
  const acc = accumulateCareerTotals(SEASON_ENTRIES);
  const boards = buildCareerLeaderboards(acc);
  assert.deepStrictEqual(boards.map(b => b.key), CATEGORIES.map(c => c.key));
  assert.ok(TOP_N >= 3);
});
