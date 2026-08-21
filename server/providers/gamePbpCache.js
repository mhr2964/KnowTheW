// Cache-aside wrapper around a per-GAME raw PBP fetch. Both provider's getGamePbpStats(eventId,
// playerId) implementations look player-specific from the outside, but neither actually makes a
// player-scoped network call: BDL's /plays, roster (/player_stats), and /team_stats calls all
// return whole-game data regardless of which player asked (confirmed by reading plays.js -- the
// player id is only used AFTER the fetch, to pick a row/filter locally); ESPN's single
// fetchGameSummary(eventId) call is the same. Caching the raw per-game fetch (not the final
// per-player result) means a whole roster's worth of players sharing a game only ever pays the real
// network cost once, not once per player -- the difference matters a lot for a warm-everything
// backfill, where every player on a team gets touched.
//
// Reuses the same cache-aside pattern lib/teamSeasonCache.js already proves out for
// computeSeasonPBP's own Mongo cache (advancedStats.js): past-season-only gate, fire-and-forget
// write, graceful no-Mongo dev-path fallback.

const { getCached, writeCache } = require('../lib/teamSeasonCache');
const { isPastSeason } = require('../lib/seasonWindow');

const GAME_RAW_COLLECTION = 'gamePbpRaw';

// providerName: 'balldontlie' | 'espn' (plain string, not the provider instance -- this is called
// from inside each provider's own per-game module, which doesn't hold a reference to itself).
// gameId: the provider's own raw game id (BDL numeric id, or ESPN's eventId) -- NOT the
// cross-provider-dispatch-prefixed eventId string getGamePbpStats receives, so a cache key can never
// collide across providers even without the providerName prefix (kept anyway, for readability and
// as a second line of defense). season: only used for the isPastSeason gate, never sent upstream.
// fetchRaw: async () => raw per-game payload, or null/falsy on failure -- never cached on failure,
// same "don't cache a transient miss" rule teamSeasonCache.js's own write-gate enforces.
async function getCachedRawGameData(providerName, gameId, season, fetchRaw) {
  if (!isPastSeason(season)) return fetchRaw();

  const key = `${providerName}-${gameId}`;
  const cached = await getCached(GAME_RAW_COLLECTION, key);
  if (cached !== null) return cached;

  const fresh = await fetchRaw();
  if (fresh) writeCache(GAME_RAW_COLLECTION, key, fresh);
  return fresh;
}

module.exports = { getCachedRawGameData, GAME_RAW_COLLECTION };
