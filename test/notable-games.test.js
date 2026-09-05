// Tests for server/providers/balldontlie/notableGames.js's pure ranking logic. No network.

process.env.NODE_ENV = 'test';

const { test } = require('node:test');
const assert = require('node:assert');

const { buildNotableGames, CATEGORIES, TOP_N } = require('../server/providers/balldontlie/notableGames');

const ROWS = [
  { playerId: '1', name: "A'ja Wilson", teamAbbr: 'LV', gameId: 100, date: '2025-06-01', pts: 42, reb: 10, ast: 3, stl: 1, blk: 2 },
  { playerId: '2', name: 'Napheesa Collier', teamAbbr: 'MIN', gameId: 101, date: '2025-06-02', pts: 38, reb: 12, ast: 4, stl: 2, blk: 1 },
  { playerId: null, name: 'Unresolved Player', teamAbbr: 'CHI', gameId: 102, date: '2025-06-03', pts: 50, reb: 5, ast: 5, stl: 5, blk: 0 },
];

test('buildNotableGames: ranks each category descending by that game\'s value', () => {
  const cats = buildNotableGames(ROWS);
  const pts = cats.find(c => c.key === 'pts');
  assert.deepStrictEqual(pts.games.map(g => g.name), ['Unresolved Player', "A'ja Wilson", 'Napheesa Collier']);
  assert.strictEqual(pts.games[0].value, 50);
});

test('buildNotableGames: an unresolved playerId (null) still appears, not dropped', () => {
  const cats = buildNotableGames(ROWS);
  const pts = cats.find(c => c.key === 'pts');
  assert.strictEqual(pts.games[0].playerId, null);
});

test('buildNotableGames: covers every default category', () => {
  const cats = buildNotableGames(ROWS);
  assert.deepStrictEqual(cats.map(c => c.key), CATEGORIES.map(c => c.key));
});

test('buildNotableGames: caps at topN', () => {
  const many = Array.from({ length: TOP_N + 5 }, (_, i) => ({ playerId: String(i), name: `P${i}`, teamAbbr: 'X', gameId: i, date: '2025-06-01', pts: i }));
  const cats = buildNotableGames(many);
  assert.strictEqual(cats.find(c => c.key === 'pts').games.length, TOP_N);
});

test('buildNotableGames: each entry carries a gameId for a box-score link', () => {
  const cats = buildNotableGames(ROWS);
  const pts = cats.find(c => c.key === 'pts');
  assert.strictEqual(pts.games[0].gameId, 102);
});
