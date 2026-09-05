// Tests for server/providers/balldontlie/leagueStats.js -- Part 2 of the 5-part provider plan
// (percentile system: getLeagueStatLines, getLeagueReboundFoulStats, getPlayerSeasonAverages).
// Pure-function tests only, no network -- real row shapes captured live (2026-08-20 spike) as fixtures.

process.env.NODE_ENV = 'test';

const { test } = require('node:test');
const assert = require('node:assert');

const {
  mapBdlLeagueStatLine,
  toPercentileStatsFromRow,
  isDnpRow,
} = require('../server/providers/balldontlie/leagueStats');

// --- mapBdlLeagueStatLine ---

// Real row shape confirmed live (Alyssa Thomas, /player_season_stats?season=2025, 2026-08-20 spike).
const REAL_SEASON_ROW = {
  player: { id: 373, first_name: 'Alyssa', last_name: 'Thomas', position_abbreviation: 'F' },
  team: { abbreviation: 'CONN' },
  season: 2025, season_type: 2,
  games_played: 39, min: 31.31,
  fgm: 6.18, fga: 11.62, fg_pct: 53.2,
  fg3m: 0, fg3a: 0.15, fg3_pct: 0,
  ftm: 3, fta: 4.33, ft_pct: 69.2,
  reb: 8.82, ast: 9.15, stl: 1.59, blk: 0.44, turnover: 3.46, pts: 15.36,
};

test('mapBdlLeagueStatLine: PerGame mode reads BDL fields directly, pct fields scaled 0-1', () => {
  const line = mapBdlLeagueStatLine(REAL_SEASON_ROW, 'PerGame');
  assert.strictEqual(line.pos, 'F');
  assert.strictEqual(line.PTS, 15.36);
  assert.strictEqual(line.REB, 8.82);
  assert.strictEqual(line.AST, 9.15);
  assert.strictEqual(line.FG_PCT, 0.532);
  assert.strictEqual(line.MIN, 31.31);
  // Not on this endpoint -- left null, filled in separately by getLeagueReboundFoulStatsBdl.
  assert.strictEqual(line.OREB, null);
  assert.strictEqual(line.DREB, null);
  assert.strictEqual(line.PF, null);
  assert.strictEqual(line.bdlPlayerId, 373);
  assert.strictEqual(line.name, 'Alyssa Thomas');
  assert.strictEqual(line.teamAbbr, 'CONN');
});

test('mapBdlLeagueStatLine: Totals mode multiplies per-game by games_played', () => {
  const line = mapBdlLeagueStatLine(REAL_SEASON_ROW, 'Totals');
  assert.strictEqual(line.PTS, 15.36 * 39);
  assert.strictEqual(line.REB, 8.82 * 39);
});

test('mapBdlLeagueStatLine: Per36 mode scales by 36/mpg', () => {
  const line = mapBdlLeagueStatLine(REAL_SEASON_ROW, 'Per36');
  const scale = 36 / 31.31;
  assert.ok(Math.abs(line.PTS - 15.36 * scale) < 1e-9);
});

test('mapBdlLeagueStatLine: below the GP/MPG qualification gate -> null', () => {
  assert.strictEqual(mapBdlLeagueStatLine({ ...REAL_SEASON_ROW, games_played: 5 }, 'PerGame'), null);
  assert.strictEqual(mapBdlLeagueStatLine({ ...REAL_SEASON_ROW, min: 5 }, 'PerGame'), null);
});

// --- isDnpRow ---

test('isDnpRow: zero/null/empty minutes are DNP, a real minutes value is not', () => {
  assert.strictEqual(isDnpRow({ min: '0' }), true);
  assert.strictEqual(isDnpRow({ min: null }), true);
  assert.strictEqual(isDnpRow({ min: '' }), true);
  assert.strictEqual(isDnpRow({ min: '34' }), false);
});

// --- toPercentileStatsFromRow ---

// Shape confirmed live via seasonStats.js's aggregateToSeasonRow (PlayerSeasonRow contract).
const REAL_SEASON_TOTALS_ROW = {
  year: '2025', teamId: '8', gp: 40, gs: null, totalMinutes: 1250,
  totals: {
    fgm: 332, fga: 658, fg3m: 5, fg3a: 20, ftm: 120, fta: 150,
    oreb: 60, dreb: 300, reb: 360, ast: 100, stl: 40, blk: 60, tov: 90, pf: 80, pts: 937,
  },
};

test('toPercentileStatsFromRow: Totals mode passes totals through unchanged', () => {
  const result = toPercentileStatsFromRow(REAL_SEASON_TOTALS_ROW);
  assert.strictEqual(result.Totals.PTS, 937);
  assert.strictEqual(result.Totals.OREB, 60);
  assert.strictEqual(result.Totals.MIN, 1250);
  assert.ok(Math.abs(result.Totals.FG_PCT - 332 / 658) < 1e-9);
});

test('toPercentileStatsFromRow: PerGame mode divides totals by games played', () => {
  const result = toPercentileStatsFromRow(REAL_SEASON_TOTALS_ROW);
  assert.strictEqual(result.PerGame.PTS, 937 / 40);
  assert.strictEqual(result.PerGame.MIN, 1250 / 40);
});

test('toPercentileStatsFromRow: Per36 mode scales totals by 36/totalMinutes', () => {
  const result = toPercentileStatsFromRow(REAL_SEASON_TOTALS_ROW);
  assert.ok(Math.abs(result.Per36.PTS - (937 / 1250) * 36) < 1e-9);
  assert.strictEqual(result.Per36.MIN, 1250);
});

test('toPercentileStatsFromRow: below the GP/MPG qualification gate -> null', () => {
  assert.strictEqual(toPercentileStatsFromRow({ ...REAL_SEASON_TOTALS_ROW, gp: 5 }), null);
  assert.strictEqual(toPercentileStatsFromRow({ ...REAL_SEASON_TOTALS_ROW, totalMinutes: 50 }), null);
});
