// Unit tests for computePbpTableRow and computeCareerRow (server/lib/analysis/pbpTable.js).

process.env.NODE_ENV = 'test';

const { test } = require('node:test');
const assert = require('node:assert');
const { computePbpTableRow, computeCareerRow, PBP_TABLE_HEADERS } = require('../server/lib/analysis/pbpTable');

const H = Object.fromEntries(PBP_TABLE_HEADERS.map((h, i) => [h, i]));

function makeGame(oc = {}) {
  return {
    fetched: true,
    onCourt: {
      fga: 8, fgm: 3, fg3a: 2, fg3m: 1, fta: 4, ftm: 3, orb: 1, drb: 3,
      tov: 2, ast: 2, pga: 6,
      oFga: 7, oFgm: 3, oFg3a: 1, oFta: 2, oOrb: 1, oDrb: 3, oTov: 1,
      pts: 9, oPts: 8,
      badPassTov: 1, lostBallTov: 1,
      foulCommitShoot: 2, foulCommitOff: 0,
      foulDrawnShoot: 3, foulDrawnOff: 0,
      and1: 1, blkd: 1,
      ...oc,
    },
    // computeOnOff needs boxscore for off-court derivation
    boxscore: {
      tm:  { fga: 65, fgm: 28, fg3m: 7, fta: 18, ftm: 14, orb: 10, drb: 25, tov: 12, ast: 20, pts: 77 },
      oppPts: 72,
      opp: { fgm: 26, fga: 60, fg3m: 5, ftm: 10, fta: 14, orb: 8, drb: 24, tov: 14, ast: 18, pts: 72 },
    },
  };
}

function makeGames(n, oc = {}) {
  return Array.from({ length: n }, () => makeGame(oc));
}

const META = { season: '2024', team: 'MIN', age: 27, gp: 34, minutes: 1180 };

test('returns null when onOff returns null (too few games)', () => {
  // computeOnOff needs MIN_ON_GAMES (5) — 4 games should fail
  const result = computePbpTableRow(makeGames(4), META);
  assert.strictEqual(result, null);
});

test('returns a row array with correct length', () => {
  const row = computePbpTableRow(makeGames(6), META);
  assert.notStrictEqual(row, null);
  assert.strictEqual(row.length, PBP_TABLE_HEADERS.length);
});

test('metadata columns populated correctly', () => {
  const row = computePbpTableRow(makeGames(6), META);
  assert.strictEqual(row[H.SEASON_ID], '2024');
  assert.strictEqual(row[H.TEAM_ABBREVIATION], 'MIN');
  assert.strictEqual(row[H.AGE], 27);
  assert.strictEqual(row[H.GP], 34);
  assert.strictEqual(row[H.MIN], 1180);
});

test('volume columns are season totals across games', () => {
  const n = 6;
  const row = computePbpTableRow(makeGames(n, { badPassTov: 2, lostBallTov: 1, pga: 4, and1: 1, blkd: 1 }), META);
  assert.strictEqual(row[H.BAD_PASS], 2 * n);
  assert.strictEqual(row[H.LOST_BALL], 1 * n);
  assert.strictEqual(row[H.PGA], 4 * n);
  assert.strictEqual(row[H.AND1], 1 * n);
  assert.strictEqual(row[H.BLKD], 1 * n);
});

test('foul columns are season totals', () => {
  const n = 6;
  const row = computePbpTableRow(makeGames(n, { foulCommitShoot: 2, foulCommitOff: 1, foulDrawnShoot: 3, foulDrawnOff: 0 }), META);
  assert.strictEqual(row[H.FOUL_COMMIT_SHOOT], 2 * n);
  assert.strictEqual(row[H.FOUL_COMMIT_OFF],   1 * n);
  assert.strictEqual(row[H.FOUL_DRAWN_SHOOT],  3 * n);
  assert.strictEqual(row[H.FOUL_DRAWN_OFF],    0);
});

test('ON_COURT and ON_OFF are populated (non-null) when enough games present', () => {
  const row = computePbpTableRow(makeGames(6), META);
  assert.notStrictEqual(row[H.ON_COURT], null);
  assert.notStrictEqual(row[H.ON_OFF], null);
});

test('skips games where fetched=false or onCourt=null for volume columns', () => {
  const games = [
    ...makeGames(5),
    { fetched: false, onCourt: makeGame().onCourt, boxscore: null },
    { fetched: true, onCourt: null, boxscore: null },
  ];
  const rowFull = computePbpTableRow(makeGames(5), META);
  const rowWithSkips = computePbpTableRow(games, META);
  // Volume totals should be identical — skip entries excluded
  assert.strictEqual(rowFull[H.BAD_PASS], rowWithSkips[H.BAD_PASS]);
});

test('computeCareerRow returns null for empty rows', () => {
  assert.strictEqual(computeCareerRow([]), null);
});

test('computeCareerRow sums volume columns across seasons', () => {
  const row1 = computePbpTableRow(makeGames(6, { badPassTov: 2, pga: 4 }), { ...META, season: '2023' });
  const row2 = computePbpTableRow(makeGames(6, { badPassTov: 3, pga: 5 }), { ...META, season: '2024' });
  const career = computeCareerRow([row1, row2]);
  assert.strictEqual(career[H.BAD_PASS], row1[H.BAD_PASS] + row2[H.BAD_PASS]);
  assert.strictEqual(career[H.PGA],      row1[H.PGA]      + row2[H.PGA]);
});

test('computeCareerRow career label is "Career"', () => {
  const row = computePbpTableRow(makeGames(6), META);
  const career = computeCareerRow([row]);
  assert.strictEqual(career[H.SEASON_ID], 'Career');
});

test('computeCareerRow GP and MIN are totals', () => {
  const meta1 = { ...META, season: '2023', gp: 30, minutes: 1000 };
  const meta2 = { ...META, season: '2024', gp: 34, minutes: 1200 };
  const r1 = computePbpTableRow(makeGames(6), meta1);
  const r2 = computePbpTableRow(makeGames(6), meta2);
  const career = computeCareerRow([r1, r2]);
  assert.strictEqual(career[H.GP],  64);
  assert.strictEqual(career[H.MIN], 2200);
});

test('computeCareerRow ON_COURT is games-weighted average', () => {
  // Both seasons same on-court net → career should match
  const r1 = computePbpTableRow(makeGames(6), { ...META, season: '2023', gp: 10 });
  const r2 = computePbpTableRow(makeGames(6), { ...META, season: '2024', gp: 10 });
  const career = computeCareerRow([r1, r2]);
  assert.strictEqual(career[H.ON_COURT], r1[H.ON_COURT]);
});
