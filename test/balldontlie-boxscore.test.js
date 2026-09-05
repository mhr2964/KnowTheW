// Tests for server/providers/balldontlie/boxScore.js -- pure mapping/aggregation logic only, no
// network. Fixtures confirmed live (game 3861, NY @ LV, 2025-05-17).

process.env.NODE_ENV = 'test';

const { test } = require('node:test');
const assert = require('node:assert');

const { buildQuarterScores, buildPlayFeed, toPlayerBoxRow, toTeamBoxLine } = require('../server/providers/balldontlie/boxScore');

// --- toPlayerBoxRow ---

const REAL_PLAYER_ROW = {
  player: { id: 422, first_name: 'Kiah', last_name: 'Stokes' },
  team: { id: 8 },
  min: '18', fgm: null, fga: 1, fg3m: null, fg3a: 1, ftm: null, fta: null,
  oreb: 3, dreb: 4, reb: 7, ast: 1, stl: null, blk: null, turnover: null, pf: 3, pts: null, plus_minus: -6,
};

test('toPlayerBoxRow: nulls (zero-attempt/zero-stat quirk) map to 0, not null', () => {
  const row = toPlayerBoxRow(REAL_PLAYER_ROW);
  assert.strictEqual(row.name, 'Kiah Stokes');
  assert.strictEqual(row.points, 0);
  assert.strictEqual(row.fgm, 0);
  assert.strictEqual(row.fga, 1);
  assert.strictEqual(row.steals, 0);
  assert.strictEqual(row.plusMinus, -6);
  assert.strictEqual(row.bdlTeamId, 8);
});

// --- toTeamBoxLine ---

const REAL_TEAM_ROW = {
  team: { id: 8 }, fgm: 28, fga: 82, fg_pct: 34, fg3m: 11, fg3a: 32, fg3_pct: 34,
  ftm: 11, fta: 13, ft_pct: 85, oreb: 12, dreb: 29, reb: 41, ast: 18, stl: 4, blk: 2,
  turnovers: 10, fouls: 20,
};

test('toTeamBoxLine: computes points from the box line (WNBATeamStat has no pts field)', () => {
  const line = toTeamBoxLine(REAL_TEAM_ROW);
  // 2*28 + 11 + 11 = 78 -- matches the real away_score for this game (LV, the road team, lost 78-92)
  assert.strictEqual(line.points, 78);
  assert.strictEqual(line.reb, 41);
  assert.strictEqual(line.fgPct, 34);
});

// --- buildQuarterScores ---

// Minimal real-shaped fixture: 2 periods, each with a non-final play and a final play carrying
// that period's cumulative running score.
const PLAY_ROWS = [
  { order: 1, period: 1, home_score: 0, away_score: 0 },
  { order: 2, period: 1, home_score: 10, away_score: 8 },
  { order: 3, period: 1, home_score: 22, away_score: 18 },
  { order: 4, period: 2, home_score: 25, away_score: 20 },
  { order: 5, period: 2, home_score: 40, away_score: 35 },
];

test('buildQuarterScores: each period is the delta from the prior period\'s running total', () => {
  const quarters = buildQuarterScores(PLAY_ROWS);
  assert.deepStrictEqual(quarters, [
    { period: 1, home: 22, away: 18 },
    { period: 2, home: 18, away: 17 }, // 40-22, 35-18
  ]);
});

test('buildQuarterScores: uses the LAST play (by order) within a period, not the first', () => {
  const shuffled = [PLAY_ROWS[2], PLAY_ROWS[0], PLAY_ROWS[1]]; // out of order
  const quarters = buildQuarterScores(shuffled);
  assert.strictEqual(quarters[0].home, 22);
});

test('buildQuarterScores: empty/missing plays -> empty array, not a crash', () => {
  assert.deepStrictEqual(buildQuarterScores([]), []);
  assert.deepStrictEqual(buildQuarterScores(undefined), []);
});

test('buildQuarterScores: a play with no period is ignored', () => {
  const withGap = [...PLAY_ROWS, { order: 6, period: null, home_score: 999, away_score: 999 }];
  const quarters = buildQuarterScores(withGap);
  assert.strictEqual(quarters.length, 2);
});

// --- buildPlayFeed ---

const RAW_PLAYS = [
  { order: 2, period: 1, clock: '9:00', text: 'Made shot', scoring_play: true, home_score: 2, away_score: 0, team: { id: 1 } },
  { order: 1, period: 1, clock: '10:00', text: 'Jumpball', scoring_play: false, home_score: 0, away_score: 0, team: { id: 8 } },
];

test('buildPlayFeed: sorts ascending by order (raw rows are not guaranteed ordered)', () => {
  const feed = buildPlayFeed(RAW_PLAYS, 1);
  assert.deepStrictEqual(feed.map(p => p.order), [1, 2]);
});

test('buildPlayFeed: resolves team.id to home/away, not a raw BDL id', () => {
  const feed = buildPlayFeed(RAW_PLAYS, 1);
  assert.strictEqual(feed[0].team, 'away'); // team.id 8, homeTeamId is 1
  assert.strictEqual(feed[1].team, 'home'); // team.id 1
});

test('buildPlayFeed: a play with no team (e.g. End Game) gets team: null, not dropped', () => {
  const feed = buildPlayFeed([{ order: 1, period: 4, clock: '0.0', text: 'End of Game', scoring_play: false, home_score: 92, away_score: 78, team: null }], 1);
  assert.strictEqual(feed[0].team, null);
});
