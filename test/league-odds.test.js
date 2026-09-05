// Tests for server/providers/balldontlie/leagueOdds.js's pure slate-building logic. No network.

process.env.NODE_ENV = 'test';

const { test } = require('node:test');
const assert = require('node:assert');

const { buildUpcomingSlate } = require('../server/providers/balldontlie/leagueOdds');

const OPPONENT_LOOKUP = new Map([
  ['LV', { id: '17', logo: null }],
  ['ATL', { id: '4', logo: null }],
]);

const FUTURE = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
const PAST = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

const REAL_GAME = {
  id: 4001, date: FUTURE, postseason: false,
  home_team: { id: 8, abbreviation: 'LV', conference: 'Western Conference' },
  visitor_team: { id: 4, abbreviation: 'ATL', conference: 'Eastern Conference' },
};

test('buildUpcomingSlate: maps a real future regular-season game', () => {
  const slate = buildUpcomingSlate([REAL_GAME], OPPONENT_LOOKUP);
  assert.strictEqual(slate.length, 1);
  assert.strictEqual(slate[0].gameId, 4001);
  assert.strictEqual(slate[0].home.abbreviation, 'LV');
  assert.strictEqual(slate[0].home.id, '17');
  assert.strictEqual(slate[0].away.abbreviation, 'ATL');
});

test('buildUpcomingSlate: excludes a past game', () => {
  const slate = buildUpcomingSlate([{ ...REAL_GAME, date: PAST }], OPPONENT_LOOKUP);
  assert.strictEqual(slate.length, 0);
});

test('buildUpcomingSlate: excludes a postseason game (odds never apply)', () => {
  const slate = buildUpcomingSlate([{ ...REAL_GAME, postseason: true }], OPPONENT_LOOKUP);
  assert.strictEqual(slate.length, 0);
});

test('buildUpcomingSlate: excludes an All-Star/exhibition game (non-real franchise)', () => {
  const exhibition = { ...REAL_GAME, home_team: { id: 99, abbreviation: 'EAST', conference: null } };
  const slate = buildUpcomingSlate([exhibition], OPPONENT_LOOKUP);
  assert.strictEqual(slate.length, 0);
});

test('buildUpcomingSlate: sorts chronologically', () => {
  const later = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
  const sooner = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
  const slate = buildUpcomingSlate(
    [{ ...REAL_GAME, id: 1, date: later }, { ...REAL_GAME, id: 2, date: sooner }],
    OPPONENT_LOOKUP
  );
  assert.deepStrictEqual(slate.map(g => g.gameId), [2, 1]);
});

test('buildUpcomingSlate: an unmapped abbreviation gets id null, not dropped', () => {
  const slate = buildUpcomingSlate([REAL_GAME], new Map());
  assert.strictEqual(slate.length, 1);
  assert.strictEqual(slate[0].home.id, null);
});
