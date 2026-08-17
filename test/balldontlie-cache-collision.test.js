// Regression test for the cache-key collision this feature introduced a fix for: none of the
// existing Mongo cache keys (teamSeasonStats, playerSeasonPbp, playerSeasonOnOff,
// playerSeasonPbpStats, advancedStats) embedded a provider name before this session's build, so
// toggling STATS_PROVIDER between requests could silently read back the OTHER source's cached
// value for the same teamId/season -- both ESPN and BallDontLie cover season 2008+, and their
// numbers legitimately differ, so this isn't a hypothetical.
//
// Exercises the real route (GET /api/teams/:id/stats?season=<past year>) against a generic
// in-memory fake db, injected via server/db.js's existing _setDbForTest hook -- proves the fix at
// the level a real request actually takes, not just by re-reading the cache-key string in source.

process.env.NODE_ENV = 'test';

const { test, before, after } = require('node:test');
const assert = require('node:assert');

const providers = require('../server/providers');
const { _setDbForTest, _resetDbForTest } = require('../server/db');
const app = require('../server/index');

function createFakeDb() {
  const byCollection = new Map();
  return {
    collection(name) {
      if (!byCollection.has(name)) byCollection.set(name, new Map());
      const store = byCollection.get(name);
      return {
        async findOne({ _id }) { return store.get(_id) ?? null; },
        async replaceOne({ _id }, doc) { store.set(_id, doc); return { acknowledged: true }; },
      };
    },
    _allIds(name) { return [...(byCollection.get(name)?.keys() ?? [])]; },
  };
}

const PAST_SEASON = 2020; // any year != the current calendar year, to force the Mongo cache path

let server, baseUrl, fakeDb;

before(async () => {
  fakeDb = createFakeDb();
  _setDbForTest(fakeDb);
  await new Promise((resolve) => {
    server = app.listen(0, () => { baseUrl = `http://127.0.0.1:${server.address().port}`; resolve(); });
  });
});

after(async () => {
  _resetDbForTest();
  providers._resetProviderCache();
  await new Promise((resolve) => server.close(resolve));
});

test('two providers with the same name never collide, and each caches under its own key', async () => {
  providers._setProviderForTest({
    name: 'espn',
    getTeamStatsRaw: async () => ({ ptsPg: 80, fgaPg: 60 }),
    getTeamPointsAllowedRaw: async () => 75,
  });
  const espnRes = await fetch(`${baseUrl}/api/teams/1/stats?season=${PAST_SEASON}`);
  assert.strictEqual(espnRes.status, 200);
  const espnBody = await espnRes.json();
  assert.strictEqual(espnBody.stats.ptsPg, 80);

  providers._setProviderForTest({
    name: 'balldontlie',
    getTeamStatsRaw: async () => ({ ptsPg: 82, fgaPg: 65 }),
    getTeamPointsAllowedRaw: async () => 77,
  });
  const bdlRes = await fetch(`${baseUrl}/api/teams/1/stats?season=${PAST_SEASON}`);
  assert.strictEqual(bdlRes.status, 200);
  const bdlBody = await bdlRes.json();
  // If the cache key were NOT provider-scoped, this would come back as 80 (ESPN's cached value)
  // instead of BDL's fresh 82 -- the exact collision this fix prevents.
  assert.strictEqual(bdlBody.stats.ptsPg, 82);

  // Re-requesting under ESPN again must still read ESPN's own cached value, not BDL's (which was
  // written to Mongo second and would win a same-key collision).
  providers._setProviderForTest({
    name: 'espn',
    getTeamStatsRaw: async () => { throw new Error('should not be called -- must be served from cache'); },
    getTeamPointsAllowedRaw: async () => 75,
  });
  const espnAgain = await fetch(`${baseUrl}/api/teams/1/stats?season=${PAST_SEASON}`);
  assert.strictEqual(espnAgain.status, 200);
  const espnAgainBody = await espnAgain.json();
  assert.strictEqual(espnAgainBody.stats.ptsPg, 80);

  const ids = fakeDb._allIds('teamSeasonStats');
  assert.deepStrictEqual(ids.sort(), [`balldontlie-1-${PAST_SEASON}`, `espn-1-${PAST_SEASON}`]);
});
