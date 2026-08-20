// Shared in-process cache primitives for provider data modules. Extracted from
// server/providers/espn/client.js (previously the only place these lived, cross-imported into
// server/providers/balldontlie/client.js) so neither provider's client depends on the other's —
// ESPN and BallDontLie are meant to be swappable via STATS_PROVIDER, and one provider's client
// requiring the other's file undermines that.

const { isPastSeason } = require('../lib/seasonWindow');

// Generic cache wrapper: returns cached value if present, else calls fn() and caches the result.
// Caches null on network error so a flaky upstream doesn't keep hammering on retries.
async function withCache(cache, key, fn) {
  if (key in cache) return cache[key];
  try { return (cache[key] = await fn()); }
  catch { return (cache[key] = null); }
}

// TTL variant of withCache, for data that changes (current-season stats) rather than immutable
// past-season data. Serves the stale value on a transient fetch error instead of throwing, so a
// flaky upstream degrades to "a bit old" rather than a failed request. Entries are {value, at}
// objects — keep this on its own cache object per call site, never share one with withCache above,
// or a season-boundary reclassification (current -> past) could read the wrong shape back.
async function withTtlCache(cache, key, ttlMs, fn) {
  const entry = cache[key];
  if (entry && Date.now() - entry.at < ttlMs) return entry.value;
  try {
    const value = await fn();
    cache[key] = { value, at: Date.now() };
    return value;
  } catch {
    if (entry) return entry.value;
    cache[key] = { value: null, at: Date.now() };
    return null;
  }
}

// Past seasons are over and immutable -> cache forever. The current season changes after every
// game -> short TTL instead of no cache at all. Shared by every provider module that fetches
// season-scoped data (gamelogs, shot charts) and previously duplicated this exact value.
const CURRENT_SEASON_TTL_MS = 15 * 60 * 1000;

// One past/current-season cache pair behind a single .get(season, key, fn) call, replacing the
// hand-declared {pastCache}/{currentCache} object pair + `isPastSeason(season) ? withCache :
// withTtlCache` branch duplicated across every gamelog/shot-chart-shaped provider module. Two
// separate backing objects (not one object with a shared key shape) so a season crossing the
// past/current boundary between requests can never read the other cache's entry shape.
function makeSeasonCache() {
  const past = {};
  const current = {};
  return {
    get(season, key, fn) {
      if (isPastSeason(season)) return withCache(past, key, fn);
      return withTtlCache(current, key, CURRENT_SEASON_TTL_MS, fn);
    },
  };
}

module.exports = { withCache, withTtlCache, CURRENT_SEASON_TTL_MS, makeSeasonCache };
