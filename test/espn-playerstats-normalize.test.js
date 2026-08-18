// Tests for server/providers/espn/playerStats.js's raw-ESPN-JSON -> normalized PlayerSeasonRow[]
// parsing (normalizeSeasonRows/parseRawStatMap) -- relocated here from statsParser.js as part of
// the normalized-provider-contract refactor. No network calls; a synthetic raw payload matching
// ESPN's real categories/statistics/stats shape (confirmed via live inspection this session).

process.env.NODE_ENV = 'test';

const { test } = require('node:test');
const assert = require('node:assert');

const { normalizeSeasonRows, parseRawStatMap } = require('../server/providers/espn/playerStats');

// --- parseRawStatMap ---

test('parseRawStatMap: splits a dash-composite name/value pair into two keys', () => {
  const m = parseRawStatMap(['fieldGoalsMade-fieldGoalsAttempted'], ['7-17']);
  assert.strictEqual(m.fieldGoalsMade, 7);
  assert.strictEqual(m.fieldGoalsAttempted, 17);
});

test('parseRawStatMap: a simple (non-composite) name maps directly', () => {
  const m = parseRawStatMap(['gamesPlayed'], ['33']);
  assert.strictEqual(m.gamesPlayed, 33);
});

test('parseRawStatMap: a composite name whose value is not a dash string -> both halves null', () => {
  const m = parseRawStatMap(['fieldGoalsMade-fieldGoalsAttempted'], [null]);
  assert.strictEqual(m.fieldGoalsMade, null);
  assert.strictEqual(m.fieldGoalsAttempted, null);
});

// --- normalizeSeasonRows ---

function rawPayload(years) {
  return {
    categories: [
      {
        name: 'averages',
        names: ['gamesPlayed', 'gamesStarted', 'avgMinutes'],
        statistics: years.map(y => ({ season: { year: y.year }, teamId: y.teamId, stats: [String(y.gp), String(y.gs), String(y.avgMin)] })),
      },
      {
        name: 'totals',
        names: [
          'fieldGoalsMade-fieldGoalsAttempted', 'threePointFieldGoalsMade-threePointFieldGoalsAttempted',
          'freeThrowsMade-freeThrowsAttempted', 'offensiveRebounds', 'defensiveRebounds', 'totalRebounds',
          'assists', 'steals', 'blocks', 'turnovers', 'fouls', 'points',
        ],
        statistics: years.map(y => ({
          season: { year: y.year }, teamId: y.teamId,
          stats: [`${y.fgm}-${y.fga}`, `${y.fg3m}-${y.fg3a}`, `${y.ftm}-${y.fta}`, String(y.oreb), String(y.dreb), String(y.reb), String(y.ast), String(y.stl), String(y.blk), String(y.tov), String(y.pf), String(y.pts)],
        })),
      },
    ],
  };
}

test('normalizeSeasonRows: null on missing categories', () => {
  assert.strictEqual(normalizeSeasonRows(null), null);
  assert.strictEqual(normalizeSeasonRows({}), null);
});

test('normalizeSeasonRows: null when averages or totals category is missing', () => {
  assert.strictEqual(normalizeSeasonRows({ categories: [{ name: 'averages', names: [], statistics: [] }] }), null);
});

test('normalizeSeasonRows: builds one row per year present in both categories, sorted ascending', () => {
  const data = rawPayload([
    { year: '2019', teamId: 5, gp: 26, gs: 25, avgMin: 28.5, fgm: 158, fga: 330, fg3m: 1, fg3a: 8, ftm: 114, fta: 144, oreb: 42, dreb: 125, reb: 167, ast: 47, stl: 13, blk: 45, tov: 56, pf: 52, pts: 430 },
    { year: '2018', teamId: 5, gp: 33, gs: 33, avgMin: 30.6, fgm: 245, fga: 530, fg3m: 0, fg3a: 0, ftm: 192, fta: 248, oreb: 66, dreb: 198, reb: 264, ast: 74, stl: 27, blk: 55, tov: 46, pf: 68, pts: 682 },
  ]);
  const rows = normalizeSeasonRows(data);
  assert.strictEqual(rows.length, 2);
  assert.strictEqual(rows[0].year, '2018');
  assert.strictEqual(rows[1].year, '2019');
  assert.strictEqual(rows[0].gp, 33);
  assert.strictEqual(rows[0].gs, 33);
  assert.strictEqual(rows[0].teamId, '5');
  assert.strictEqual(rows[0].totalMinutes, Math.round(30.6 * 33));
  assert.strictEqual(rows[0].totals.fgm, 245);
  assert.strictEqual(rows[0].totals.fga, 530);
  assert.strictEqual(rows[0].totals.pts, 682);
  assert.strictEqual(rows[0].totals.reb, 264);
});

test('normalizeSeasonRows: a year present in averages but not totals is dropped (needs both)', () => {
  const data = rawPayload([{ year: '2020', teamId: 5, gp: 10, gs: 10, avgMin: 20, fgm: 1, fga: 2, fg3m: 0, fg3a: 0, ftm: 0, fta: 0, oreb: 0, dreb: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0, pts: 2 }]);
  data.categories[1].statistics = []; // totals category has no matching entry
  const rows = normalizeSeasonRows(data);
  assert.strictEqual(rows.length, 0);
});
