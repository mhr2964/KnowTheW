// Tests for server/providers/balldontlie/odds.js -- pure mapping/selection logic only, no network.

process.env.NODE_ENV = 'test';

const { test } = require('node:test');
const assert = require('node:assert');

const { mapOddsRow, pickPreferredOdds } = require('../server/providers/balldontlie/odds');

// Real shape confirmed live, 2026-08-22 spike against /wnba/v1/odds.
const DRAFTKINGS_ROW = {
  id: 272531428, game_id: 25027, vendor: 'draftkings',
  spread_home_value: '-2.5', spread_home_odds: -260,
  spread_away_value: '2.5', spread_away_odds: 195,
  moneyline_home_odds: -1600, moneyline_away_odds: 800,
  total_value: '162.5', total_over_odds: -105, total_under_odds: -125,
  updated_at: '2026-08-22T04:15:04.087Z',
};
const FANDUEL_ROW = { ...DRAFTKINGS_ROW, id: 272525079, vendor: 'fanduel', spread_home_value: '-3.5' };
const OBSCURE_ROW = { ...DRAFTKINGS_ROW, id: 999, vendor: 'someobscurebook' };

test('mapOddsRow: extracts spread/moneyline/total under a stable shape', () => {
  const mapped = mapOddsRow(DRAFTKINGS_ROW);
  assert.strictEqual(mapped.vendor, 'draftkings');
  assert.strictEqual(mapped.spread.home, '-2.5');
  assert.strictEqual(mapped.spread.away, '2.5');
  assert.strictEqual(mapped.moneyline.home, -1600);
  assert.strictEqual(mapped.total.value, '162.5');
  assert.strictEqual(mapped.total.over, -105);
});

test('mapOddsRow: a missing field maps to null, not undefined', () => {
  const mapped = mapOddsRow({ vendor: 'x', game_id: 1 });
  assert.strictEqual(mapped.spread.home, null);
  assert.strictEqual(mapped.total.value, null);
});

test('pickPreferredOdds: prefers draftkings over fanduel when both are present', () => {
  const chosen = pickPreferredOdds([FANDUEL_ROW, DRAFTKINGS_ROW]);
  assert.strictEqual(chosen.vendor, 'draftkings');
});

test('pickPreferredOdds: falls back to whatever is present when no preferred vendor posted yet', () => {
  const chosen = pickPreferredOdds([OBSCURE_ROW]);
  assert.strictEqual(chosen.vendor, 'someobscurebook');
});

test('pickPreferredOdds: empty/missing rows -> null, not a throw', () => {
  assert.strictEqual(pickPreferredOdds([]), null);
  assert.strictEqual(pickPreferredOdds(undefined), null);
});
