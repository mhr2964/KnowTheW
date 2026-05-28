// Unit tests for computePbpStats (server/lib/analysis/pbpStats.js).
// All fixtures are synthetic — no ESPN or Mongo calls.

process.env.NODE_ENV = 'test';

const { test } = require('node:test');
const assert = require('node:assert');
const { computePbpStats, MIN_ON_GAMES } = require('../server/lib/analysis/pbpStats');

// Build a minimal pbpResult with on-court shooting stats.
function makeGame({ fga=8, fgm=3, fg3a=2, fg3m=1, fta=4, ftm=3, orb=1, drb=3, tov=2, ast=2, pts=10 } = {}) {
  return {
    fetched: true,
    onCourt: { fga, fgm, fg3a, fg3m, fta, ftm, orb, drb, tov, ast, pts },
    boxscore: null,
  };
}

function makeGames(n, overrides = {}) {
  return Array.from({ length: n }, () => makeGame(overrides));
}

test('returns null when fewer than MIN_ON_GAMES usable games', () => {
  const results = makeGames(MIN_ON_GAMES - 1);
  assert.strictEqual(computePbpStats(results), null);
});

test('returns null for an empty array', () => {
  assert.strictEqual(computePbpStats([]), null);
});

test('skips games where fetched=false', () => {
  const results = [
    ...makeGames(MIN_ON_GAMES),
    { fetched: false, onCourt: makeGame().onCourt, boxscore: null },
  ];
  // MIN_ON_GAMES usable — should return a result
  assert.notStrictEqual(computePbpStats(results), null);
});

test('skips games where onCourt is null', () => {
  const results = [
    ...makeGames(MIN_ON_GAMES),
    { fetched: true, onCourt: null, boxscore: null },
  ];
  assert.notStrictEqual(computePbpStats(results), null);
});

test('exact MIN_ON_GAMES games returns a result', () => {
  assert.notStrictEqual(computePbpStats(makeGames(MIN_ON_GAMES)), null);
});

test('FG% is fgm/fga', () => {
  // 6 fgm / 12 fga = 0.5
  const result = computePbpStats(makeGames(MIN_ON_GAMES, { fga: 12, fgm: 6, fg3a: 2, fg3m: 1 }));
  assert.strictEqual(result.fgPct, 0.5);
});

test('3P% is null when fg3a is 0', () => {
  const result = computePbpStats(makeGames(MIN_ON_GAMES, { fg3a: 0, fg3m: 0 }));
  assert.strictEqual(result.fg3Pct, null);
});

test('3P% is fg3m/fg3a when fg3a > 0', () => {
  // 2 fg3m / 4 fg3a per game, 5 games => 10/20 = 0.5
  const result = computePbpStats(makeGames(MIN_ON_GAMES, { fg3a: 4, fg3m: 2 }));
  assert.strictEqual(result.fg3Pct, 0.5);
});

test('FT% is null when fta is 0', () => {
  const result = computePbpStats(makeGames(MIN_ON_GAMES, { fta: 0, ftm: 0 }));
  assert.strictEqual(result.ftPct, null);
});

test('eFG% = (fgm + 0.5*fg3m) / fga', () => {
  // fgm=4, fg3m=2, fga=8 per game => (4 + 1) / 8 = 0.625
  const result = computePbpStats(makeGames(MIN_ON_GAMES, { fga: 8, fgm: 4, fg3a: 2, fg3m: 2 }));
  assert.strictEqual(result.efgPct, 0.625);
});

test('TS% denominator uses 0.44*fta', () => {
  // pts=10, fga=8, fta=4 per game => 10 / (2*(8+0.44*4)) = 10/18.52 ≈ 0.540
  const result = computePbpStats(makeGames(MIN_ON_GAMES, { fga: 8, fgm: 4, fg3a: 0, fg3m: 0, fta: 4, ftm: 2, pts: 10 }));
  const expected = Math.round(10 / (2 * (8 + 0.44 * 4)) * 1000) / 1000;
  assert.strictEqual(result.tsPct, expected);
});

test('per-game averages are season totals divided by games', () => {
  // 5 games, ast=2/game → astPg=2.0; tov=2/game → tovPg=2.0
  const result = computePbpStats(makeGames(5, { ast: 2, tov: 2, orb: 1, drb: 3, pts: 10 }));
  assert.strictEqual(result.astPg, 2.0);
  assert.strictEqual(result.tovPg, 2.0);
  assert.strictEqual(result.orbPg, 1.0);
  assert.strictEqual(result.drbPg, 3.0);
  assert.strictEqual(result.ptsPg, 10.0);
});

test('games count excludes non-fetched and null onCourt entries', () => {
  const good   = makeGames(5);
  const bad    = [{ fetched: false, onCourt: null, boxscore: null }];
  const result = computePbpStats([...good, ...bad]);
  assert.strictEqual(result.games, 5);
});
