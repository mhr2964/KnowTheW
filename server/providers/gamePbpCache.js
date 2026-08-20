// Cache-aside wrapper around provider.getGamePbpStats(eventId, playerId) -- the shared per-game
// primitive BOTH computeSeasonPbpRow (Play-by-Play tab) and getSeasonPBPSummary (Advanced tab, via
// pbpAggregate.js) call, for every game, every player, every visitor. Completed-game data is
// immutable, but until now nothing cached it anywhere in the chain (confirmed live during the
// 2026-08-20 H12-timeout investigation: computeSeasonPbpRow's own comment already said "uncached at
// the HTTP layer", and this is the reason why -- there was no cache to inherit). A full season fans
// out to ~120 BDL requests (3 per game, see providers/balldontlie/client.js's rate-limiter comment)
// with zero reuse across requests, which is real, avoidable load on the shared ~500/min BDL budget.
//
// Reuses the exact cache-aside pattern lib/teamSeasonCache.js already proves out for
// computeSeasonPBP's own Mongo cache (advancedStats.js) -- same past-season-only gate, same
// fire-and-forget write, same graceful no-Mongo dev-path fallback.

const { getCached, writeCache } = require('../lib/teamSeasonCache');
const { isPastSeason } = require('../lib/seasonWindow');

const GAME_PBP_COLLECTION = 'gamePbpStats';

// provider: the provider instance (needs .name and .getGamePbpStats). season: the season this
// eventId belongs to -- only used for the isPastSeason gate, never sent upstream. Current-season
// games bypass the cache entirely (mirrors computeSeasonPBP's existing boundary exactly) -- not
// because they can't be immutable (a played game IS final even mid-season), but because this codebase
// has no per-game "is this specific game over" signal today, and season-level is the only boundary
// already proven safe here. A `fetched:false` result (transient upstream failure, not "no data for
// this game") is deliberately never cached -- caching it would permanently serve a false negative for
// a game that really does have data, the same failure mode teamSeasonCache.js's own write-gate exists
// to prevent.
async function getCachedGamePbpStats(provider, eventId, playerId, season) {
  const fetchFn = () => provider.getGamePbpStats(eventId, playerId);
  if (!isPastSeason(season)) return fetchFn();

  const key = `${provider.name}-${eventId}-${playerId}`;
  const cached = await getCached(GAME_PBP_COLLECTION, key);
  if (cached !== null) return cached;

  const fresh = await fetchFn();
  if (fresh?.fetched) writeCache(GAME_PBP_COLLECTION, key, fresh);
  return fresh;
}

module.exports = { getCachedGamePbpStats, GAME_PBP_COLLECTION };
