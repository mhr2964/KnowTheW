// Locks the two date heuristics in seasonWindow.js so the hardening pass (tightened comments,
// isPastSeason dedup) didn't accidentally change either cutoff. No ESPN or Mongo calls.

process.env.NODE_ENV = 'test';

const { test } = require('node:test');
const assert = require('node:assert');

const { latestCompletedSeason, isPastSeason } = require('../server/lib/seasonWindow');

test('latestCompletedSeason: before November, the prior year is the latest completed season', () => {
  assert.strictEqual(latestCompletedSeason(new Date('2026-10-31T12:00:00')), 2025);
});

test('latestCompletedSeason: November 1 onward, the current year counts as completed', () => {
  assert.strictEqual(latestCompletedSeason(new Date('2026-11-01T00:00:00')), 2026);
});

test('latestCompletedSeason: December still reads the current year', () => {
  assert.strictEqual(latestCompletedSeason(new Date('2026-12-31T23:59:59')), 2026);
});

test('latestCompletedSeason: January reads the prior year', () => {
  assert.strictEqual(latestCompletedSeason(new Date('2026-01-01T00:00:00')), 2025);
});

test('isPastSeason: a season before the current year is past', () => {
  assert.strictEqual(isPastSeason(2024, new Date('2026-06-01')), true);
});

test('isPastSeason: the current year is not past (still live)', () => {
  assert.strictEqual(isPastSeason(2026, new Date('2026-06-01')), false);
});

test('isPastSeason: a future year is not past', () => {
  assert.strictEqual(isPastSeason(2027, new Date('2026-06-01')), false);
});

test('isPastSeason accepts a string season, same as callers pass from route params', () => {
  assert.strictEqual(isPastSeason('2024', new Date('2026-06-01')), true);
});
