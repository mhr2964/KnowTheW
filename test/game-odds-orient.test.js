// Tests for server/lib/gameOdds.js's orientOddsForTeam -- pure home/away perspective flip.

process.env.NODE_ENV = 'test';

const { test } = require('node:test');
const assert = require('node:assert');

const { orientOddsForTeam } = require('../server/lib/gameOdds');

const RAW = {
  vendor: 'draftkings',
  spread: { home: '-2.5', away: '2.5' },
  moneyline: { home: -1600, away: 800 },
  total: { value: '162.5', over: -105, under: -125 },
};

test('orientOddsForTeam: home team gets the home spread/moneyline', () => {
  const oriented = orientOddsForTeam(RAW, true);
  assert.strictEqual(oriented.spread, '-2.5');
  assert.strictEqual(oriented.moneyline, -1600);
  assert.strictEqual(oriented.total, '162.5');
});

test('orientOddsForTeam: away team gets the away spread/moneyline, same total either way', () => {
  const oriented = orientOddsForTeam(RAW, false);
  assert.strictEqual(oriented.spread, '2.5');
  assert.strictEqual(oriented.moneyline, 800);
  assert.strictEqual(oriented.total, '162.5');
});

test('orientOddsForTeam: null raw (no odds posted for this game) -> null, not a throw', () => {
  assert.strictEqual(orientOddsForTeam(null, true), null);
});
