// Tests for server/lib/leagueLeaders.js -- pure ranking over already-qualified getLeagueStatLines
// entries. No network, no provider dependency.

process.env.NODE_ENV = 'test';

const { test } = require('node:test');
const assert = require('node:assert');

const { buildLeaderboards, CATEGORIES, TOP_N } = require('../server/lib/leagueLeaders');

const ENTRIES = [
  { playerId: '1', name: "A'ja Wilson", teamAbbr: 'LV', PTS: 26.9, REB: 11.9, AST: 2.3, STL: 1.6, BLK: 1.8, FG_PCT: 0.517, FG3_PCT: 0.35, FT_PCT: 0.847 },
  { playerId: '2', name: 'Napheesa Collier', teamAbbr: 'MIN', PTS: 24.5, REB: 8.4, AST: 3.5, STL: 1.6, BLK: 1.1, FG_PCT: 0.481, FG3_PCT: 0.409, FT_PCT: 0.85 },
  { playerId: null, name: 'Unresolved Player', teamAbbr: 'CHI', PTS: 30, REB: 5, AST: 5, STL: 5, BLK: 5, FG_PCT: 0.6, FG3_PCT: 0.5, FT_PCT: 0.9 },
];

test('buildLeaderboards: ranks each category descending by value', () => {
  const boards = buildLeaderboards(ENTRIES);
  const pts = boards.find(b => b.key === 'PTS');
  assert.deepStrictEqual(pts.leaders.map(l => l.name), ['Unresolved Player', "A'ja Wilson", 'Napheesa Collier']);
  assert.strictEqual(pts.leaders[0].value, 30);
});

test('buildLeaderboards: a null playerId (unresolved BDL name) still appears, not dropped', () => {
  const boards = buildLeaderboards(ENTRIES);
  const pts = boards.find(b => b.key === 'PTS');
  assert.strictEqual(pts.leaders[0].playerId, null);
});

test('buildLeaderboards: covers every default category', () => {
  const boards = buildLeaderboards(ENTRIES);
  assert.deepStrictEqual(boards.map(b => b.key), CATEGORIES.map(c => c.key));
});

test('buildLeaderboards: caps at topN', () => {
  const many = Array.from({ length: TOP_N + 5 }, (_, i) => ({ playerId: String(i), name: `P${i}`, teamAbbr: 'X', PTS: i }));
  const boards = buildLeaderboards(many);
  assert.strictEqual(boards.find(b => b.key === 'PTS').leaders.length, TOP_N);
});

test('buildLeaderboards: a non-numeric/missing stat value is excluded from that category, not shown as 0', () => {
  const withGap = [...ENTRIES, { playerId: '9', name: 'No Blocks Data', teamAbbr: 'SEA', PTS: 10, BLK: null }];
  const boards = buildLeaderboards(withGap);
  const blk = boards.find(b => b.key === 'BLK');
  assert.ok(!blk.leaders.some(l => l.name === 'No Blocks Data'));
});
