// Provider factory. The rest of the app calls getProvider() and never requires a specific
// implementation, so swapping the data source is a one-line env change (STATS_PROVIDER) once a new
// provider is fully implemented.

const PROVIDERS = {
  espn: () => require('./espn'),
  sportradar: () => require('./sportradar'),
};

let cached = null;
let cachedKey = null;
let override = null;

/**
 * @returns {import('./SportsDataProvider').SportsDataProvider} the active data-source provider.
 * Defaults to ESPN. Throws if STATS_PROVIDER names an unknown provider (fail fast over silently
 * falling back to a source the operator didn't ask for).
 */
function getProvider() {
  if (override) return override;
  const key = (process.env.STATS_PROVIDER || 'espn').toLowerCase();
  if (cached && cachedKey === key) return cached;
  const load = PROVIDERS[key];
  if (!load) {
    throw new Error(
      `Unknown STATS_PROVIDER "${key}". Valid values: ${Object.keys(PROVIDERS).join(', ')}.`
    );
  }
  cached = load();
  cachedKey = key;
  return cached;
}

// Test-only: inject a fake provider so route tests can run without a live source.
function _setProviderForTest(p) { override = p; }
// Test-only: reset memoized instance + any injected override (call in test teardown).
function _resetProviderCache() { cached = null; cachedKey = null; override = null; }

module.exports = { getProvider, _setProviderForTest, _resetProviderCache };
