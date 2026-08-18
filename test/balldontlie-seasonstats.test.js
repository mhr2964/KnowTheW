// Tests for server/providers/balldontlie/seasonStats.js -- Phase 1b of the ESPN-migration plan
// (player season stats, whole-career merge). Pure-function tests for the aggregation math; the
// merge orchestration (computeHybridSeasonStatsUncached) is covered via fakes since it composes
// espn.getPlayerSeasonStats + idMap.resolveBdlPlayerId + BDL fetches, all already independently
// tested/verified elsewhere this session.

process.env.NODE_ENV = 'test';

const { test, afterEach } = require('node:test');
const assert = require('node:assert');

const {
  aggregateToSeasonRow,
  addRowToTotals,
  computeHybridSeasonStatsUncached,
} = require('../server/providers/balldontlie/seasonStats');

const idMap = require('../server/providers/balldontlie/idMap');
const espn = require('../server/providers/espn');

// --- addRowToTotals ---

const REAL_ROW = {
  min: '36', fgm: 11, fga: 22, fg3m: 1, fg3a: 3, ftm: 8, fta: 8,
  oreb: 2, dreb: 14, reb: 16, ast: 3, stl: 2, blk: 1, turnover: 4, pf: 2, pts: 31,
};

test('addRowToTotals: maps BDL field names into PlayerSeasonTotals field names (turnover -> tov)', () => {
  const totals = { fgm: 0, fga: 0, fg3m: 0, fg3a: 0, ftm: 0, fta: 0, oreb: 0, dreb: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0, pts: 0 };
  addRowToTotals(totals, REAL_ROW);
  assert.strictEqual(totals.tov, 4);
  assert.strictEqual(totals.pts, 31);
  assert.strictEqual(totals.fgm, 11);
});

test('addRowToTotals: accumulates across multiple calls', () => {
  const totals = { fgm: 0, fga: 0, fg3m: 0, fg3a: 0, ftm: 0, fta: 0, oreb: 0, dreb: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0, pts: 0 };
  addRowToTotals(totals, REAL_ROW);
  addRowToTotals(totals, REAL_ROW);
  assert.strictEqual(totals.pts, 62);
});

// --- aggregateToSeasonRow ---

test('aggregateToSeasonRow: gp is the row count, gs is always null (no BDL field exists)', () => {
  const result = aggregateToSeasonRow('2025', '17', [REAL_ROW, REAL_ROW]);
  assert.strictEqual(result.gp, 2);
  assert.strictEqual(result.gs, null);
  assert.strictEqual(result.totals.pts, 62);
  assert.strictEqual(result.totalMinutes, 72);
  assert.strictEqual(result.teamId, '17');
});

test('aggregateToSeasonRow: no rows -> null (that split did not happen for this player-season)', () => {
  assert.strictEqual(aggregateToSeasonRow('2025', '17', []), null);
});

test('aggregateToSeasonRow: year is always stringified', () => {
  const result = aggregateToSeasonRow(2025, '17', [REAL_ROW]);
  assert.strictEqual(result.year, '2025');
});

// --- computeHybridSeasonStatsUncached (merge orchestration, via fakes) ---

afterEach(() => {
  idMap._resetPlayerIdCacheForTest();
});

test('computeHybridSeasonStatsUncached: both ESPN splits null (transient failure) -> propagated unchanged, no BDL attempted', async () => {
  const origGetPlayerSeasonStats = espn.getPlayerSeasonStats;
  espn.getPlayerSeasonStats = async () => ({ regSeasons: null, postSeasons: null });
  try {
    const result = await computeHybridSeasonStatsUncached('123');
    assert.strictEqual(result.regSeasons, null);
    assert.strictEqual(result.postSeasons, null);
  } finally {
    espn.getPlayerSeasonStats = origGetPlayerSeasonStats;
  }
});

const EMPTY_TOTALS = { fgm: 0, fga: 0, fg3m: 0, fg3a: 0, ftm: 0, fta: 0, oreb: 0, dreb: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0, pts: 0 };

test('computeHybridSeasonStatsUncached: no BDL-era seasons in ESPN data -> pure ESPN result unchanged', async () => {
  const espnResult = { regSeasons: [{ year: '2005', teamId: '9', gp: 30, gs: 30, totalMinutes: 900, totals: EMPTY_TOTALS }], postSeasons: null };
  const origGetPlayerSeasonStats = espn.getPlayerSeasonStats;
  espn.getPlayerSeasonStats = async () => espnResult;
  try {
    const result = await computeHybridSeasonStatsUncached('123');
    assert.strictEqual(result, espnResult);
  } finally {
    espn.getPlayerSeasonStats = origGetPlayerSeasonStats;
  }
});
