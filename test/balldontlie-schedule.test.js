// Tests for server/providers/balldontlie/schedule.js -- Phase 2 of the ESPN-migration plan
// (regular-season team schedule). Pure-function tests only, no network: buildOpponentLookup and
// mapGameToScheduleEvent are split out from the fetch specifically to be testable this way.

process.env.NODE_ENV = 'test';

const { test } = require('node:test');
const assert = require('node:assert');

const {
  buildOpponentLookup,
  mapGameToScheduleEvent,
} = require('../server/providers/balldontlie/schedule');

// --- buildOpponentLookup ---

test('buildOpponentLookup: keys by uppercased abbreviation, carries id + logo', () => {
  const espnTeams = [{ id: '8', abbreviation: 'LV', logo: 'https://example.com/lv.png' }];
  const map = buildOpponentLookup(espnTeams);
  assert.deepStrictEqual(map.get('LV'), { id: '8', logo: 'https://example.com/lv.png' });
});

test('buildOpponentLookup: a team with no logo maps to logo: null, not undefined', () => {
  const espnTeams = [{ id: '1', abbreviation: 'NY', logo: null }];
  const map = buildOpponentLookup(espnTeams);
  assert.strictEqual(map.get('NY').logo, null);
});

// --- mapGameToScheduleEvent ---

const REAL_HOME = { id: 1, abbreviation: 'NY', conference: 'Eastern Conference' };
const REAL_AWAY = { id: 8, abbreviation: 'LV', conference: 'Western Conference' };
const EXHIBITION = { id: 18, abbreviation: 'WNBASTARS', conference: null };

const LOOKUP = buildOpponentLookup([
  { id: '1', abbreviation: 'NY', logo: 'https://example.com/ny.png' },
  { id: '8', abbreviation: 'LV', logo: 'https://example.com/lv.png' },
]);

test('mapGameToScheduleEvent: home team perspective -> atVs vs, opponent enriched with ESPN logo', () => {
  const game = { id: 3861, date: '2025-05-17T17:00:00.000Z', status_state: 'final', postseason: false, home_team: REAL_HOME, visitor_team: REAL_AWAY, home_score: 92, away_score: 78 };
  const event = mapGameToScheduleEvent(game, '1', LOOKUP);
  assert.strictEqual(event.id, '3861');
  assert.strictEqual(event.atVs, 'vs');
  assert.strictEqual(event.opponent.abbreviation, 'LV');
  assert.strictEqual(event.opponent.logo, 'https://example.com/lv.png');
  assert.strictEqual(event.teamScore, 92);
  assert.strictEqual(event.oppScore, 78);
  assert.strictEqual(event.result, 'W');
  assert.strictEqual(event.winner, true);
  assert.strictEqual(event.roundLabel, undefined);
});

test('mapGameToScheduleEvent: visitor team perspective -> atVs @, result computed from the away side', () => {
  const game = { id: 3861, date: '2025-05-17T17:00:00.000Z', status_state: 'final', postseason: false, home_team: REAL_HOME, visitor_team: REAL_AWAY, home_score: 92, away_score: 78 };
  const event = mapGameToScheduleEvent(game, '8', LOOKUP);
  assert.strictEqual(event.atVs, '@');
  assert.strictEqual(event.opponent.abbreviation, 'NY');
  assert.strictEqual(event.teamScore, 78);
  assert.strictEqual(event.oppScore, 92);
  assert.strictEqual(event.result, 'L');
  assert.strictEqual(event.winner, false);
});

test('mapGameToScheduleEvent: postseason games are excluded -> null (playoffs stay ESPN)', () => {
  const game = { id: 4100, date: '2025-10-05T00:00:00.000Z', status_state: 'final', postseason: true, home_team: REAL_HOME, visitor_team: REAL_AWAY, home_score: 90, away_score: 85 };
  assert.strictEqual(mapGameToScheduleEvent(game, '1', LOOKUP), null);
});

test('mapGameToScheduleEvent: a game against a non-franchise opponent (All-Star/exhibition) is excluded -> null', () => {
  const game = { id: 4200, date: '2025-07-20T00:00:00.000Z', status_state: 'final', postseason: false, home_team: REAL_HOME, visitor_team: EXHIBITION, home_score: 131, away_score: 151 };
  assert.strictEqual(mapGameToScheduleEvent(game, '1', LOOKUP), null);
});

test('mapGameToScheduleEvent: an unfinished/future game has no scores -> result/winner null, not a false W/L', () => {
  const game = { id: 5000, date: '2026-09-01T00:00:00.000Z', status_state: 'pre', postseason: false, home_team: REAL_HOME, visitor_team: REAL_AWAY, home_score: 0, away_score: 0 };
  const event = mapGameToScheduleEvent(game, '1', LOOKUP);
  assert.strictEqual(event.result, null);
  assert.strictEqual(event.winner, null);
  assert.strictEqual(event.teamScore, null);
  assert.strictEqual(event.oppScore, null);
});

test('mapGameToScheduleEvent: an opponent abbreviation with no ESPN match still returns a valid event with logo: null', () => {
  const unknownOpp = { id: 99, abbreviation: 'ZZZ', conference: 'Eastern Conference' };
  const game = { id: 6000, date: '2025-05-17T17:00:00.000Z', status_state: 'final', postseason: false, home_team: REAL_HOME, visitor_team: unknownOpp, home_score: 90, away_score: 85 };
  const event = mapGameToScheduleEvent(game, '1', LOOKUP);
  assert.strictEqual(event.opponent.abbreviation, 'ZZZ');
  assert.strictEqual(event.opponent.logo, null);
});
