// Provider factory + contract tests. These lock in the swappability seam: ESPN is the default,
// the env var selects the implementation, unknown names fail fast, and the not-yet-implemented
// Sportradar stub throws loudly on first data call (the M8 leak-detector behavior).

process.env.NODE_ENV = 'test';

const { test, afterEach } = require('node:test');
const assert = require('node:assert');

const { getProvider, _resetProviderCache } = require('../server/providers');
const { SportsDataProvider, NotImplementedError } = require('../server/providers/SportsDataProvider');

// The full data-source contract surface. The two tests below form the leak detector: ESPN must
// override every method, and the not-yet-built Sportradar provider must throw on every method —
// so any consumer reaching past the provider would show up as "works under sportradar".
const CONTRACT_METHODS = [
  'getTeams', 'getRoster', 'getHistoricalRoster', 'getSeasonRoster',
  'getTeamStats', 'getTeamStatsRaw', 'getTeamPointsAllowed', 'getTeamPointsAllowedRaw',
  'getTeamSchedule', 'getPlayoffSchedule', 'getStandingsRaw',
  'getPlayerBasics', 'getRetiredPlayer', 'getPlayerSeasonStats', 'getPlayerGameLog',
  'getGameLogEvents', 'getGamePbpStats', 'getActivePlayers', 'findActivePlayer',
  'getLeagueStatLines', 'getLeagueReboundFoulStats', 'getPlayerSeasonAverages', 'getLeaguePlayerIndex',
];

afterEach(() => {
  delete process.env.STATS_PROVIDER;
  _resetProviderCache();
});

test('getProvider() defaults to the ESPN provider', () => {
  _resetProviderCache();
  assert.strictEqual(getProvider().name, 'espn');
});

test('STATS_PROVIDER selects the implementation', () => {
  process.env.STATS_PROVIDER = 'sportradar';
  _resetProviderCache();
  assert.strictEqual(getProvider().name, 'sportradar');
});

test('an unknown STATS_PROVIDER fails fast', () => {
  process.env.STATS_PROVIDER = 'statsperform';
  _resetProviderCache();
  assert.throws(() => getProvider(), /Unknown STATS_PROVIDER "statsperform"/);
});

test('the Sportradar stub throws NotImplementedError on a data call', async () => {
  process.env.STATS_PROVIDER = 'sportradar';
  _resetProviderCache();
  const provider = getProvider();
  await assert.rejects(
    async () => provider.getTeams(),
    (err) => err instanceof NotImplementedError && err.method === 'getTeams'
  );
});

test('the ESPN provider implements every contract method (no throwing defaults leak through)', () => {
  process.env.STATS_PROVIDER = 'espn';
  _resetProviderCache();
  const provider = getProvider();
  for (const method of CONTRACT_METHODS) {
    assert.strictEqual(typeof provider[method], 'function', `missing ${method}`);
    // If a method weren't overridden, provider[method] would resolve to the base's throwing stub.
    assert.notStrictEqual(provider[method], SportsDataProvider.prototype[method], `${method} not overridden`);
  }
});

test('M8 leak test: the Sportradar stub throws NotImplementedError on EVERY contract method', () => {
  process.env.STATS_PROVIDER = 'sportradar';
  _resetProviderCache();
  const provider = getProvider();
  assert.strictEqual(provider.name, 'sportradar');
  for (const method of CONTRACT_METHODS) {
    assert.throws(
      () => provider[method](),
      (err) => err instanceof NotImplementedError && err.method === method,
      `${method} should throw NotImplementedError under the sportradar stub`
    );
  }
});
