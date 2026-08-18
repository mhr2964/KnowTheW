// Regression coverage for resolveBdlPlayerId's caching behavior -- separate file from
// balldontlie-idmap.test.js because this needs require.cache-substituted fakes for client/
// teamSeasonCache/espn registered BEFORE idMap.js is first required (it destructures bdlFetch/
// getCached/writeCache/espn at its own require time), which must happen before any other test file
// in this process has already required the real idMap.js. Node's test runner gives each test file
// its own process, so this is safe in isolation.
//
// The bug this locks in (found live, 2026-08-17): a burst of ~200 concurrent /players searches
// during a cache-warming pass got 401'd. Before the fix, bdlFetch returning null on ANY failure was
// indistinguishable from "zero real candidates", so every one of those got written to
// bdlPlayerIdMap as a PERMANENT confirmed miss -- 149 of 150 resolutions in that run were wrong for
// this reason, not because the players don't exist in BDL.

process.env.NODE_ENV = 'test';

const Module = require('module');
const { test, beforeEach } = require('node:test');
const assert = require('node:assert');

const CLIENT_PATH   = require.resolve('../server/providers/balldontlie/client');
const CACHE_PATH    = require.resolve('../server/lib/teamSeasonCache');
const ESPN_PATH     = require.resolve('../server/providers/espn');

function fakeModule(resolvedPath, exportsObj) {
  const mod = new Module(resolvedPath);
  mod.exports = exportsObj;
  mod.loaded = true;
  require.cache[resolvedPath] = mod;
}

let bdlFetchImpl = async () => null;
const mongoStore = new Map();
const writeCalls = [];

fakeModule(CLIENT_PATH, {
  bdlFetch: (...args) => bdlFetchImpl(...args),
  withCache: (cacheObj, key, fn) => fn(), // pass-through, no caching needed for these tests
  bdlTeamsCache: {},
});
fakeModule(CACHE_PATH, {
  getCached: async (collection, key) => (mongoStore.has(key) ? mongoStore.get(key) : null),
  writeCache: (collection, key, payload) => { writeCalls.push(key); mongoStore.set(key, payload); },
});
fakeModule(ESPN_PATH, {
  getPlayerBasics: async (id) => (id === 'known' ? { name: 'Star Wilson' } : null),
  getRetiredPlayer: async () => null,
});

const idMap = require('../server/providers/balldontlie/idMap');

beforeEach(() => {
  mongoStore.clear();
  writeCalls.length = 0;
  idMap._resetPlayerIdCacheForTest();
});

test('resolveBdlPlayerId: a successful search resolves and is cached', async () => {
  bdlFetchImpl = async () => ({ data: [{ id: 535, first_name: 'Star', last_name: 'Wilson' }] });
  const id = await idMap.resolveBdlPlayerId('known');
  assert.strictEqual(id, 535);
  assert.deepStrictEqual(writeCalls, ['known']);
  assert.deepStrictEqual(mongoStore.get('known'), { bdlId: 535 });
});

test('resolveBdlPlayerId: a genuine zero-match result IS cached as a confirmed miss', async () => {
  bdlFetchImpl = async () => ({ data: [] });
  const id = await idMap.resolveBdlPlayerId('known');
  assert.strictEqual(id, null);
  assert.deepStrictEqual(writeCalls, ['known']);
  assert.deepStrictEqual(mongoStore.get('known'), { bdlId: null });
});

test('resolveBdlPlayerId: a failed BDL fetch (bdlFetch -> null) is NOT cached, so a later attempt can retry', async () => {
  bdlFetchImpl = async () => null; // simulates a 401/429/network failure, same as bdlFetch's real contract
  const id1 = await idMap.resolveBdlPlayerId('known');
  assert.strictEqual(id1, null);
  assert.deepStrictEqual(writeCalls, [], 'a transient failure must never be written to Mongo');
  assert.strictEqual(mongoStore.has('known'), false);

  // A later attempt (after the failure has settled) must actually retry BDL, not silently reuse a
  // cached miss -- confirms the fix, not just the absence of a write.
  bdlFetchImpl = async () => ({ data: [{ id: 535, first_name: 'Star', last_name: 'Wilson' }] });
  const id2 = await idMap.resolveBdlPlayerId('known');
  assert.strictEqual(id2, 535);
  assert.deepStrictEqual(writeCalls, ['known']);
});

test('resolveBdlPlayerId: concurrent calls for the same player coalesce into one BDL search', async () => {
  let calls = 0;
  bdlFetchImpl = async () => { calls++; return { data: [{ id: 535, first_name: 'Star', last_name: 'Wilson' }] }; };
  const results = await Promise.all([
    idMap.resolveBdlPlayerId('known'),
    idMap.resolveBdlPlayerId('known'),
    idMap.resolveBdlPlayerId('known'),
  ]);
  assert.deepStrictEqual(results, [535, 535, 535]);
  assert.strictEqual(calls, 1, 'three concurrent calls for the same player should coalesce into one search');
});
