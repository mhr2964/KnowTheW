// Season-dispatch and cross-provider event-id routing for the balldontlie hybrid facade.
// getGamePbpStats(eventId, playerId) gets no season -- only an opaque id -- so it has to infer
// ESPN vs BDL from the "bdl:<id>" string-prefix scheme (see index.js's own comment). Getting this
// wrong either leaks BDL data into pre-2008 seasons or silently falls back to ESPN post-2008.
//
// espn/plays/idMap are swapped for fakes via require.cache BEFORE balldontlie/index.js is first
// required, so the facade's real dispatch logic runs against controlled, in-memory responses
// instead of live network calls. Node's test runner gives each test file its own process, so this
// cache substitution can't leak into other test files.

process.env.NODE_ENV = 'test';

const path = require('path');
const Module = require('module');
const { test } = require('node:test');
const assert = require('node:assert');

const ESPN_PATH   = require.resolve('../server/providers/espn');
const PLAYS_PATH  = require.resolve('../server/providers/balldontlie/plays');
const IDMAP_PATH  = require.resolve('../server/providers/balldontlie/idMap');

const { PBP_OC_KEYS } = require('../server/providers/types');
const ZERO_OC = Object.fromEntries(PBP_OC_KEYS.map(k => [k, 0]));
const ZERO_TM = { fga: 0, fgm: 0, fg3m: 0, fta: 0, ftm: 0, pts: 0, orb: 0, drb: 0, tov: 0, ast: 0 };

function fakeModule(resolvedPath, exportsObj) {
  const mod = new Module(resolvedPath);
  mod.exports = exportsObj;
  mod.loaded = true;
  require.cache[resolvedPath] = mod;
}

const calls = [];
fakeModule(ESPN_PATH, {
  getRegularSeasonEventIds: async (playerId, season) => { calls.push(['espn.getRegularSeasonEventIds', playerId, season]); return ['espn-event-1']; },
  getGamePbpStats: async (eventId, playerId) => { calls.push(['espn.getGamePbpStats', eventId, playerId]); return { fetched: true, onCourt: 'espn-oc', boxscore: { tm: ZERO_TM } }; },
  getSeasonPBPSummary: async (playerId, season) => { calls.push(['espn.getSeasonPBPSummary', playerId, season]); return { source: 'espn' }; },
});
fakeModule(IDMAP_PATH, {
  resolveBdlPlayerId: async (espnPlayerId) => { calls.push(['idMap.resolveBdlPlayerId', espnPlayerId]); return `bdl-${espnPlayerId}`; },
  resolveBdlTeamId: async (espnTeamId) => `bdl-${espnTeamId}`,
});
fakeModule(PLAYS_PATH, {
  getRegularSeasonEventIdsBdl: async (bdlPlayerId, season) => { calls.push(['plays.getRegularSeasonEventIdsBdl', bdlPlayerId, season]); return [`bdl:${bdlPlayerId}-game1`]; },
  getGamePbpStatsBdl: async (bdlGameId, bdlPlayerId) => { calls.push(['plays.getGamePbpStatsBdl', bdlGameId, bdlPlayerId]); return { fetched: true, onCourt: ZERO_OC, boxscore: { tm: ZERO_TM } }; },
});

// balldontlie/index.js exports withValidation(new BallDontLieProvider()) -- the Proxy still
// forwards through to the real instance/fakes below it, so calling through the export exercises
// the actual dispatch logic, not a bypass of it.
const provider = require('../server/providers/balldontlie');

test.beforeEach(() => { calls.length = 0; });

test('getRegularSeasonEventIds: pre-2008 season delegates to ESPN untouched', async () => {
  const result = await provider.getRegularSeasonEventIds('player1', 2007);
  assert.deepStrictEqual(result, ['espn-event-1']);
  assert.deepStrictEqual(calls, [['espn.getRegularSeasonEventIds', 'player1', 2007]]);
});

test('getRegularSeasonEventIds: 2008+ season resolves the BDL player id and tags ids "bdl:"', async () => {
  const result = await provider.getRegularSeasonEventIds('player1', 2008);
  assert.deepStrictEqual(result, ['bdl:bdl-player1-game1']);
  assert.deepStrictEqual(calls, [
    ['idMap.resolveBdlPlayerId', 'player1'],
    ['plays.getRegularSeasonEventIdsBdl', 'bdl-player1', 2008],
  ]);
});

test('getGamePbpStats: a bare (non-"bdl:") eventId always routes to ESPN, regardless of season', async () => {
  const result = await provider.getGamePbpStats('401234567', 'player1');
  assert.strictEqual(result.onCourt, 'espn-oc');
  assert.deepStrictEqual(calls, [['espn.getGamePbpStats', '401234567', 'player1']]);
});

test('getGamePbpStats: a "bdl:<id>" eventId strips the prefix and routes to BDL', async () => {
  const result = await provider.getGamePbpStats('bdl:99', 'player1');
  assert.deepStrictEqual(result.onCourt, ZERO_OC);
  assert.deepStrictEqual(calls, [
    ['idMap.resolveBdlPlayerId', 'player1'],
    ['plays.getGamePbpStatsBdl', '99', 'bdl-player1'],
  ]);
});

test('getGamePbpStats: an unresolvable BDL player id fails soft (fetched:false), not a throw', async () => {
  const idMapMod = require.cache[IDMAP_PATH];
  idMapMod.exports.resolveBdlPlayerId = async () => null;
  const result = await provider.getGamePbpStats('bdl:99', 'unknown-player');
  assert.deepStrictEqual(result, { fetched: false, onCourt: null, boxscore: null });
});

test('getSeasonPBPSummary: pre-2008 delegates whole; 2008+ drives getRegularSeasonEventIds -> getGamePbpStats through this.*', async () => {
  const idMapMod = require.cache[IDMAP_PATH];
  idMapMod.exports.resolveBdlPlayerId = async (id) => `bdl-${id}`;

  const pre = await provider.getSeasonPBPSummary('player1', 2007);
  assert.deepStrictEqual(pre, { source: 'espn' });

  calls.length = 0;
  const post = await provider.getSeasonPBPSummary('player1', 2008);
  // Real aggregatePBPSummary runs over the one bdl-tagged event id, calling this.getGamePbpStats
  // (not a bare module reference) -- proven by the routing call showing up, not an ESPN call.
  assert.ok(calls.some(c => c[0] === 'plays.getRegularSeasonEventIdsBdl'));
  assert.ok(calls.some(c => c[0] === 'plays.getGamePbpStatsBdl'));
  assert.ok(!calls.some(c => c[0].startsWith('espn.')));
});
