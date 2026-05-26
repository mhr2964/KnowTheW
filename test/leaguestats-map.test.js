// Characterization test for the byathlete index mapping (M6) — the single most fragile, fully
// undocumented coupling in the app. Locks the positional reads into ESPN's categories[].values[]
// arrays and the PerGame/Totals/Per36 derivations so a refactor or source swap can't silently
// shift an index (which would corrupt the percentile distributions with no error).

process.env.NODE_ENV = 'test';

const { test } = require('node:test');
const assert = require('node:assert');

const { mapLeagueStatLine } = require('../server/providers/espn/leagueStats');

// gen[0]=GP, gen[1]=MPG, gen[5]=REB.
// off[0]=totPTS, off[1]=PTS, off[2]=FGM, off[3]=FGA, off[4]=FG%, off[5]=FG3M, off[6]=FG3A,
//   off[7]=FG3%, off[8]=FTM, off[9]=FTA, off[10]=FT%, off[11]=AST, off[12]=TOV.
// def[0]=STL, def[1]=BLK.
const ATHLETE = {
  athlete: { position: { abbreviation: 'G' } },
  categories: [
    { values: [30, 32, 0, 0, 0, 8] },                                  // general
    { values: [600, 20, 7, 15, 50, 2, 5, 40, 4, 5, 80, 6, 3] },        // offensive
    { values: [2, 1] },                                                // defensive
  ],
};

test('mapLeagueStatLine — PerGame', () => {
  assert.deepStrictEqual(mapLeagueStatLine(ATHLETE, 'PerGame'), {
    pos: 'G', PTS: 20, REB: 8, AST: 6, STL: 2, BLK: 1,
    FG_PCT: 0.5, FG3_PCT: 0.4, FT_PCT: 0.8, TOV: 3,
    PF: null, OREB: null, DREB: null,
    FGM: 7, FGA: 15, FG3M: 2, FG3A: 5, FTM: 4, FTA: 5, MIN: 32,
  });
});

test('mapLeagueStatLine — Totals (per-game x GP, PTS from off[0])', () => {
  assert.deepStrictEqual(mapLeagueStatLine(ATHLETE, 'Totals'), {
    pos: 'G', PTS: 600, REB: 240, AST: 180, STL: 60, BLK: 30,
    FG_PCT: 0.5, FG3_PCT: 0.4, FT_PCT: 0.8, TOV: 90,
    PF: null, OREB: null, DREB: null,
    FGM: 210, FGA: 450, FG3M: 60, FG3A: 150, FTM: 120, FTA: 150, MIN: 960,
  });
});

test('mapLeagueStatLine — Per36 (per-game x 36/MPG)', () => {
  assert.deepStrictEqual(mapLeagueStatLine(ATHLETE, 'Per36'), {
    pos: 'G', PTS: 22.5, REB: 9, AST: 6.75, STL: 2.25, BLK: 1.125,
    FG_PCT: 0.5, FG3_PCT: 0.4, FT_PCT: 0.8, TOV: 3.375,
    PF: null, OREB: null, DREB: null,
    FGM: 7.875, FGA: 16.875, FG3M: 2.25, FG3A: 5.625, FTM: 4.5, FTA: 5.625, MIN: 960,
  });
});

test('mapLeagueStatLine — returns null below the GP/MPG qualification gate', () => {
  const benchwarmer = { ...ATHLETE, categories: [{ values: [5, 32, 0, 0, 0, 8] }, ATHLETE.categories[1], ATHLETE.categories[2]] };
  assert.strictEqual(mapLeagueStatLine(benchwarmer, 'PerGame'), null);
  const lowMin = { ...ATHLETE, categories: [{ values: [30, 4, 0, 0, 0, 8] }, ATHLETE.categories[1], ATHLETE.categories[2]] };
  assert.strictEqual(mapLeagueStatLine(lowMin, 'PerGame'), null);
});
