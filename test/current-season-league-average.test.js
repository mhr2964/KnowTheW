// Tests for server/lib/currentSeasonLeagueAverage.js -- the live-computed replacement for a WNBA_LG
// entry that can never be permanently hardcoded (the season is still being played). Found necessary
// live on 2026-08-18: any player whose only season is the current one got a silently-empty Advanced
// tab, since WNBA_LG had no entry for it (confirmed provider-agnostic, affects ESPN too).

process.env.NODE_ENV = 'test';

const { test, afterEach } = require('node:test');
const assert = require('node:assert');

const providers = require('../server/providers');
const {
  averageTeamStats,
  computeLiveLeagueAverageUncached,
  getCurrentSeasonLeagueAverage,
  peekCurrentSeasonLeagueAverage,
  MIN_TEAMS_FOR_REAL_AVERAGE,
  _resetCacheForTest,
} = require('../server/lib/currentSeasonLeagueAverage');
const { getLeagueAverage, WNBA_LG } = require('../server/constants/leagueAverages');

afterEach(() => {
  providers._resetProviderCache();
  _resetCacheForTest();
});

// --- averageTeamStats (pure function) ---

test('averageTeamStats: averages per-game fields across teams and derives fg3a/trb', () => {
  const rows = [
    { fgmPg: 30, fgaPg: 68, fg3mPg: 8, fg3Pct: 40, ftmPg: 14, ftaPg: 18, orbPg: 8, drbPg: 26, astPg: 20, tovPg: 13, ptsPg: 82 },
    { fgmPg: 28, fgaPg: 66, fg3mPg: 6, fg3Pct: 30, ftmPg: 12, ftaPg: 16, orbPg: 6, drbPg: 24, astPg: 18, tovPg: 15, ptsPg: 74 },
  ];
  const result = averageTeamStats(rows, null);

  assert.strictEqual(result.fgm, 29);
  assert.strictEqual(result.fga, 67);
  assert.strictEqual(result.fg3m, 7);
  assert.strictEqual(result.ftm, 13);
  assert.strictEqual(result.fta, 17);
  assert.strictEqual(result.orb, 7);
  assert.strictEqual(result.drb, 25);
  assert.strictEqual(result.trb, 32); // orb + drb, not independently averaged
  assert.strictEqual(result.ast, 19);
  assert.strictEqual(result.tov, 14);
  assert.strictEqual(result.pts, 78);
  // fg3a: team1 = 8/0.40=20, team2 = 6/0.30=20 -> avg 20
  assert.strictEqual(result.fg3a, 20);
});

test('averageTeamStats: carries stl/blk/pf forward from the previous season, never fabricates them', () => {
  const rows = [{ fgmPg: 30, fgaPg: 68, fg3mPg: 8, fg3Pct: 40, ftmPg: 14, ftaPg: 18, orbPg: 8, drbPg: 26, astPg: 20, tovPg: 13, ptsPg: 82 }];
  const previous = { stl: 7.4, blk: 3.9, pf: 17.5 };
  const result = averageTeamStats(rows, previous);
  assert.strictEqual(result.stl, 7.4);
  assert.strictEqual(result.blk, 3.9);
  assert.strictEqual(result.pf, 17.5);
});

test('averageTeamStats: no previous season available -> stl/blk/pf are null, not 0 or NaN', () => {
  const rows = [{ fgmPg: 30, fgaPg: 68, fg3mPg: 8, fg3Pct: 40, ftmPg: 14, ftaPg: 18, orbPg: 8, drbPg: 26, astPg: 20, tovPg: 13, ptsPg: 82 }];
  const result = averageTeamStats(rows, null);
  assert.strictEqual(result.stl, null);
  assert.strictEqual(result.blk, null);
  assert.strictEqual(result.pf, null);
});

test('averageTeamStats: a team with fg3Pct 0 contributes 0 fg3a for that team, not Infinity/NaN', () => {
  const rows = [{ fgmPg: 30, fgaPg: 68, fg3mPg: 0, fg3Pct: 0, ftmPg: 14, ftaPg: 18, orbPg: 8, drbPg: 26, astPg: 20, tovPg: 13, ptsPg: 82 }];
  const result = averageTeamStats(rows, null);
  assert.strictEqual(result.fg3a, 0);
});

// --- computeLiveLeagueAverageUncached (provider-dependent) ---

function fakeProvider({ teams, statsByTeam }) {
  return {
    name: 'fake',
    getTeams: async () => teams,
    getTeamStats: async (teamId) => statsByTeam[teamId] ?? null,
  };
}

test('computeLiveLeagueAverageUncached: returns null when fewer than MIN_TEAMS_FOR_REAL_AVERAGE teams report real data', () => {
  const teams = Array.from({ length: MIN_TEAMS_FOR_REAL_AVERAGE }, (_, i) => ({ id: String(i), abbreviation: `T${i}` }));
  // Only 2 teams have real stats; the rest return null (transient failure or no data yet).
  const statsByTeam = {
    '0': { fgmPg: 30, fgaPg: 68, fg3mPg: 8, fg3Pct: 40, ftmPg: 14, ftaPg: 18, orbPg: 8, drbPg: 26, astPg: 20, tovPg: 13, ptsPg: 82 },
    '1': { fgmPg: 28, fgaPg: 66, fg3mPg: 6, fg3Pct: 30, ftmPg: 12, ftaPg: 16, orbPg: 6, drbPg: 24, astPg: 18, tovPg: 15, ptsPg: 74 },
  };
  providers._setProviderForTest(fakeProvider({ teams, statsByTeam }));
  return computeLiveLeagueAverageUncached(2026).then(result => {
    assert.strictEqual(result, null);
  });
});

test('computeLiveLeagueAverageUncached: excludes teams whose stats came back noData/empty, still returns a real average if enough teams remain', async () => {
  const teamCount = MIN_TEAMS_FOR_REAL_AVERAGE + 2;
  const teams = Array.from({ length: teamCount }, (_, i) => ({ id: String(i), abbreviation: `T${i}` }));
  const realRow = { fgmPg: 30, fgaPg: 68, fg3mPg: 8, fg3Pct: 40, ftmPg: 14, ftaPg: 18, orbPg: 8, drbPg: 26, astPg: 20, tovPg: 13, ptsPg: 82 };
  const statsByTeam = {};
  for (let i = 0; i < teamCount; i++) {
    statsByTeam[String(i)] = i < 2 ? { noData: true } : realRow;
  }
  providers._setProviderForTest(fakeProvider({ teams, statsByTeam }));
  const result = await computeLiveLeagueAverageUncached(2026);
  assert.ok(result);
  assert.strictEqual(result.fgm, 30); // every included row is identical, average equals the row itself
});

test('computeLiveLeagueAverageUncached: a thrown getTeamStats error for one team does not fail the whole average', async () => {
  const teamCount = MIN_TEAMS_FOR_REAL_AVERAGE + 1;
  const teams = Array.from({ length: teamCount }, (_, i) => ({ id: String(i), abbreviation: `T${i}` }));
  const realRow = { fgmPg: 30, fgaPg: 68, fg3mPg: 8, fg3Pct: 40, ftmPg: 14, ftaPg: 18, orbPg: 8, drbPg: 26, astPg: 20, tovPg: 13, ptsPg: 82 };
  providers._setProviderForTest({
    name: 'fake',
    getTeams: async () => teams,
    getTeamStats: async (teamId) => {
      if (teamId === '0') throw new Error('transient upstream failure');
      return realRow;
    },
  });
  const result = await computeLiveLeagueAverageUncached(2026);
  assert.ok(result);
});

// --- getCurrentSeasonLeagueAverage / peekCurrentSeasonLeagueAverage (caching) ---

test('peekCurrentSeasonLeagueAverage: returns null before the cache has ever been populated', () => {
  assert.strictEqual(peekCurrentSeasonLeagueAverage(new Date().getFullYear()), null);
});

test('peekCurrentSeasonLeagueAverage: returns null for a genuinely past season (not this module\'s job)', () => {
  assert.strictEqual(peekCurrentSeasonLeagueAverage(2019), null);
});

test('getCurrentSeasonLeagueAverage then peek: a populated cache is readable synchronously afterward', async () => {
  const currentYear = new Date().getFullYear();
  const teamCount = MIN_TEAMS_FOR_REAL_AVERAGE + 1;
  const teams = Array.from({ length: teamCount }, (_, i) => ({ id: String(i), abbreviation: `T${i}` }));
  const realRow = { fgmPg: 30, fgaPg: 68, fg3mPg: 8, fg3Pct: 40, ftmPg: 14, ftaPg: 18, orbPg: 8, drbPg: 26, astPg: 20, tovPg: 13, ptsPg: 82 };
  providers._setProviderForTest(fakeProvider({ teams, statsByTeam: Object.fromEntries(teams.map(t => [t.id, realRow])) }));

  const fetched = await getCurrentSeasonLeagueAverage(currentYear);
  assert.ok(fetched);
  const peeked = peekCurrentSeasonLeagueAverage(currentYear);
  assert.deepStrictEqual(peeked, fetched);
});

// --- getLeagueAverage (the synchronous accessor consumers actually use) ---

test('getLeagueAverage: a completed season returns the static WNBA_LG entry directly', () => {
  assert.deepStrictEqual(getLeagueAverage('2023'), WNBA_LG['2023']);
});

test('getLeagueAverage: the current season with no warm cache yet returns null (same degradation as a missing year always had)', () => {
  const currentYear = String(new Date().getFullYear());
  assert.strictEqual(WNBA_LG[currentYear], undefined, 'test assumption: current year must not be in the static table');
  assert.strictEqual(getLeagueAverage(currentYear), null);
});

test('getLeagueAverage: the current season with a warm cache returns the live-computed average', async () => {
  const currentYear = new Date().getFullYear();
  const teamCount = MIN_TEAMS_FOR_REAL_AVERAGE + 1;
  const teams = Array.from({ length: teamCount }, (_, i) => ({ id: String(i), abbreviation: `T${i}` }));
  const realRow = { fgmPg: 30, fgaPg: 68, fg3mPg: 8, fg3Pct: 40, ftmPg: 14, ftaPg: 18, orbPg: 8, drbPg: 26, astPg: 20, tovPg: 13, ptsPg: 82 };
  providers._setProviderForTest(fakeProvider({ teams, statsByTeam: Object.fromEntries(teams.map(t => [t.id, realRow])) }));

  await getCurrentSeasonLeagueAverage(currentYear);
  const result = getLeagueAverage(currentYear);
  assert.ok(result);
  assert.strictEqual(result.fgm, 30);
});

test('getLeagueAverage: a genuinely unknown year (too old, not in the table, not current) returns null', () => {
  assert.strictEqual(getLeagueAverage('1900'), null);
});
