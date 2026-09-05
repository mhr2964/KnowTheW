// Tests for server/lib/awardsHistory.js's pure row-building logic. No network, no DB --
// buildAwardsRows takes an already-resolved name->id map.

process.env.NODE_ENV = 'test';

const { test } = require('node:test');
const assert = require('node:assert');

const { buildAwardsRows } = require('../server/lib/awardsHistory');

const ID_BY_NAME = new Map([
  ["A'ja Wilson", '3149391'],
  ['Breanna Stewart', '2998928'],
]);

test('buildAwardsRows: years are sorted descending', () => {
  const rows = buildAwardsRows(new Map());
  for (let i = 1; i < rows.length; i++) {
    assert.ok(rows[i - 1].year > rows[i].year);
  }
});

test('buildAwardsRows: includes the real 2025 season (all 12 real categories present in source data)', () => {
  const rows = buildAwardsRows(ID_BY_NAME);
  const row2025 = rows.find(r => r.year === 2025);
  assert.ok(row2025);
  assert.strictEqual(row2025.mvp.name, "A'ja Wilson");
  assert.strictEqual(row2025.mvp.playerId, '3149391');
});

test('buildAwardsRows: a resolvable name gets its playerId attached', () => {
  const rows = buildAwardsRows(ID_BY_NAME);
  const row2025 = rows.find(r => r.year === 2025);
  assert.strictEqual(row2025.mvp.playerId, '3149391');
});

test('buildAwardsRows: an unresolved name (not in the id map) gets playerId null, not dropped', () => {
  const rows = buildAwardsRows(new Map());
  const row2025 = rows.find(r => r.year === 2025);
  assert.strictEqual(row2025.mvp.name, "A'ja Wilson");
  assert.strictEqual(row2025.mvp.playerId, null);
});

test('buildAwardsRows: 2002 has no ROY (lockout season) -- null, not a missing key', () => {
  const rows = buildAwardsRows(new Map());
  const row2002 = rows.find(r => r.year === 2002);
  assert.ok(row2002);
  assert.strictEqual(row2002.roy, null);
});

test('buildAwardsRows: allWnbaFirst is a 5-entry array for a real year', () => {
  const rows = buildAwardsRows(ID_BY_NAME);
  const row2025 = rows.find(r => r.year === 2025);
  assert.strictEqual(row2025.allWnbaFirst.length, 5);
  assert.strictEqual(row2025.allWnbaFirst[0].name, "A'ja Wilson");
  assert.strictEqual(row2025.allWnbaFirst[0].playerId, '3149391');
});

test('buildAwardsRows: a year before Sixth Player existed (2000) has sixth: null', () => {
  const rows = buildAwardsRows(new Map());
  const row2000 = rows.find(r => r.year === 2000);
  assert.strictEqual(row2000.sixth, null);
});
