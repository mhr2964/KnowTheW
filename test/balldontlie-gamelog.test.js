// Tests for server/providers/balldontlie/gameLog.js -- Phase 1a of the ESPN->BDL migration plan
// (player game log). Pure-function tests only, no network: buildStatsBag/buildGameMetaMap/
// buildGameLogFromRows are all split out from the fetch specifically to be testable this way,
// mirroring plays.js's buildBoxscoreFromRows / idMap.js's buildTeamMapFromLists convention.

process.env.NODE_ENV = 'test';

const { test } = require('node:test');
const assert = require('node:assert');

const {
  buildStatsBag,
  buildGameMetaMap,
  buildGameLogFromRows,
  isDnpRow,
  pct,
} = require('../server/providers/balldontlie/gameLog');

// --- pct ---

test('pct: made/attempted -> 0-100 scale, one decimal', () => {
  assert.strictEqual(pct(11, 22), 50);
  assert.strictEqual(pct(1, 3), 33.3);
});

test('pct: zero attempts -> 0, not NaN/Infinity', () => {
  assert.strictEqual(pct(0, 0), 0);
});

// --- buildStatsBag ---

// Real row shape confirmed live (A'ja Wilson, game 3861, 2025-08-18 spike).
const REAL_ROW = {
  player: { id: 535 }, team: { id: 8 }, game: { id: 3861, date: '2025-05-17T17:00:00.000Z', season: 2025 },
  min: '36', fgm: 11, fga: 22, fg3m: 1, fg3a: 3, ftm: 8, fta: 8,
  oreb: 2, dreb: 14, reb: 16, ast: 3, stl: 2, blk: 1, turnover: 4, pf: 2, pts: 31, plus_minus: -7,
};

test('buildStatsBag: maps BDL fields into the exact key set gameSplits.js expects', () => {
  const bag = buildStatsBag(REAL_ROW);
  assert.strictEqual(bag.minutes, '36');
  assert.strictEqual(bag.points, 31);
  assert.strictEqual(bag.totalRebounds, 16);
  assert.strictEqual(bag.assists, 3);
  assert.strictEqual(bag.steals, 2);
  assert.strictEqual(bag.blocks, 1);
  assert.strictEqual(bag.turnovers, 4);
  assert.strictEqual(bag.fouls, 2);
  assert.strictEqual(bag.plusMinus, -7);
  assert.strictEqual(bag['fieldGoalsMade-fieldGoalsAttempted'], '11-22');
  assert.strictEqual(bag.fieldGoalPct, 50);
  assert.strictEqual(bag['threePointFieldGoalsMade-threePointFieldGoalsAttempted'], '1-3');
  assert.strictEqual(bag.threePointPct, 33.3);
  assert.strictEqual(bag['freeThrowsMade-freeThrowsAttempted'], '8-8');
  assert.strictEqual(bag.freeThrowPct, 100);
});

test('buildStatsBag: a confirmed-live null fg3m (zero three-point attempts) becomes 0, not "null-3"', () => {
  // Confirmed live (spike): a real zero-attempt game returned fg3m: null, fg3a: 3 -- not fg3m: 0.
  const bag = buildStatsBag({ ...REAL_ROW, fg3m: null, fg3a: 3 });
  assert.strictEqual(bag['threePointFieldGoalsMade-threePointFieldGoalsAttempted'], '0-3');
  assert.strictEqual(bag.threePointPct, 0);
});

// --- buildGameMetaMap ---

const REAL_FRANCHISE_HOME = { id: 1, conference: 'Eastern Conference', abbreviation: 'NY' };
const REAL_FRANCHISE_AWAY = { id: 8, conference: 'Western Conference', abbreviation: 'LV' };
const EXHIBITION_TEAM = { id: 18, conference: null, abbreviation: 'WNBASTARS' };

test('buildGameMetaMap: carries the BDL game id through as gameId, for per-game advanced-stats lookups', () => {
  const rows = [{ id: 3861, date: '2025-05-17T17:00:00.000Z', status_state: 'final', home_team: REAL_FRANCHISE_HOME, visitor_team: REAL_FRANCHISE_AWAY, home_score: 92, away_score: 78 }];
  const map = buildGameMetaMap(rows, 1);
  assert.strictEqual(map.get(3861).gameId, 3861);
});

test('buildGameMetaMap: home game -> atVs vs, opponent is the visitor', () => {
  const rows = [{ id: 3861, date: '2025-05-17T17:00:00.000Z', status_state: 'final', home_team: REAL_FRANCHISE_HOME, visitor_team: REAL_FRANCHISE_AWAY, home_score: 92, away_score: 78 }];
  const map = buildGameMetaMap(rows, 1);
  const meta = map.get(3861);
  assert.strictEqual(meta.atVs, 'vs');
  assert.strictEqual(meta.opponent, 'LV');
  assert.strictEqual(meta.teamScore, 92);
  assert.strictEqual(meta.oppScore, 78);
  assert.strictEqual(meta.result, 'W');
});

test('buildGameMetaMap: away game -> atVs @, result computed from the away perspective', () => {
  const rows = [{ id: 3861, date: '2025-05-17T17:00:00.000Z', status_state: 'final', home_team: REAL_FRANCHISE_HOME, visitor_team: REAL_FRANCHISE_AWAY, home_score: 92, away_score: 78 }];
  const map = buildGameMetaMap(rows, 8);
  const meta = map.get(3861);
  assert.strictEqual(meta.atVs, '@');
  assert.strictEqual(meta.opponent, 'NY');
  assert.strictEqual(meta.teamScore, 78);
  assert.strictEqual(meta.oppScore, 92);
  assert.strictEqual(meta.result, 'L');
});

test('buildGameMetaMap: excludes games against a non-franchise opponent (All-Star/exhibition)', () => {
  const rows = [{ id: 999, date: '2025-07-01T00:00:00.000Z', status_state: 'final', home_team: REAL_FRANCHISE_HOME, visitor_team: EXHIBITION_TEAM, home_score: 100, away_score: 90 }];
  const map = buildGameMetaMap(rows, 1);
  assert.strictEqual(map.has(999), false);
});

test('buildGameMetaMap: an unfinished/future game has no scores -> result "?" not a false W/L', () => {
  const rows = [{ id: 4000, date: '2026-09-01T00:00:00.000Z', status_state: 'pre', home_team: REAL_FRANCHISE_HOME, visitor_team: REAL_FRANCHISE_AWAY, home_score: 0, away_score: 0 }];
  const map = buildGameMetaMap(rows, 1);
  const meta = map.get(4000);
  assert.strictEqual(meta.result, '?');
  assert.strictEqual(meta.teamScore, null);
  assert.strictEqual(meta.oppScore, null);
});

// --- buildGameLogFromRows ---

test('buildGameLogFromRows: joins stat rows to game meta, sorts ascending by date', () => {
  const statRows = [
    { ...REAL_ROW, game: { id: 2, date: '2025-06-01T00:00:00.000Z' } },
    { ...REAL_ROW, game: { id: 1, date: '2025-05-17T17:00:00.000Z' } },
  ];
  const gameMeta = new Map([
    [1, { date: '2025-05-17T17:00:00.000Z', opponent: 'LV', atVs: 'vs', result: 'W', teamScore: 92, oppScore: 78 }],
    [2, { date: '2025-06-01T00:00:00.000Z', opponent: 'CHI', atVs: '@', result: 'L', teamScore: 70, oppScore: 80 }],
  ]);
  const log = buildGameLogFromRows(statRows, gameMeta);
  assert.strictEqual(log.games.length, 2);
  assert.strictEqual(log.games[0].date, '2025-05-17T17:00:00.000Z');
  assert.strictEqual(log.games[1].date, '2025-06-01T00:00:00.000Z');
  assert.ok(log.columns.length > 0);
  assert.deepStrictEqual(Object.keys(log.columns[0]), ['key', 'label', 'kind']);
});

test('buildGameLogFromRows: a stat row whose game was filtered out of the meta map is silently dropped', () => {
  const statRows = [{ ...REAL_ROW, game: { id: 999, date: '2025-07-01T00:00:00.000Z' } }];
  const log = buildGameLogFromRows(statRows, new Map());
  assert.strictEqual(log.games.length, 0);
});

test('buildGameLogFromRows: no rows -> empty games array, still returns valid columns', () => {
  const log = buildGameLogFromRows([], new Map());
  assert.strictEqual(log.games.length, 0);
  assert.ok(log.columns.length > 0);
});

// --- isDnpRow / DNP filtering ---
// Confirmed live (2025-08-18 shadow-compare against A'ja Wilson's real 2025 season): BDL's
// /player_stats includes a row for games the player was on the roster for but did not play, with
// min:"0" and every counting stat null -- real examples pulled directly from two such games.

test('isDnpRow: a real confirmed-live DNP row (min "0", all stats null) is detected', () => {
  const dnpRow = {
    player: { id: 535 }, team: { id: 8 }, game: { id: 3932, date: '2025-06-18T00:00:00.000Z', season: 2025 },
    min: '0', fgm: null, fga: null, fg3m: null, fg3a: null, ftm: null, fta: null,
    oreb: null, dreb: null, reb: null, ast: null, stl: null, blk: null, turnover: null, pf: null, pts: null, plus_minus: null,
  };
  assert.strictEqual(isDnpRow(dnpRow), true);
});

test('isDnpRow: a real played game (min "36") is not a DNP', () => {
  assert.strictEqual(isDnpRow(REAL_ROW), false);
});

test('buildGameLogFromRows: a DNP row is dropped even when its game IS in the meta map', () => {
  const dnpRow = { ...REAL_ROW, min: '0', pts: null, game: { id: 1, date: '2025-05-17T17:00:00.000Z' } };
  const gameMeta = new Map([[1, { date: '2025-05-17T17:00:00.000Z', opponent: 'NY', atVs: '@', result: 'L', teamScore: 78, oppScore: 92 }]]);
  const log = buildGameLogFromRows([dnpRow], gameMeta);
  assert.strictEqual(log.games.length, 0);
});
