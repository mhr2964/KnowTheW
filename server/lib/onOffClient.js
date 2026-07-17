// On/off season computation with MongoDB cache-aside.
//
// Mirrors the computeSeasonPBP / computeSeasonPBPUncached pattern in advancedStats.js:
//   - Past seasons are read from / written to playerSeasonOnOff (Mongo collection).
//   - Current season bypasses Mongo entirely — live data.
//   - Cache writes are gated on a complete fetch (every eventId returned a non-null summary)
//     so partial ESPN failures are never baked in permanently.
//
// Only regular-season events are included (seasontype=2). Playoffs on/off is a future addition.

'use strict';

const { getProvider } = require('../providers');
const { getCached, writeCache } = require('./teamSeasonCache');
const { computeOnOff } = require('./analysis/onOff');
const { isPastSeason } = require('./seasonWindow');

// Returns { onoff, complete } or null. Callers decide what to cache vs return.
async function computeSeasonOnOffUncached(playerId, season, seasontype = 2) {
  const eventIds = await getProvider().getRegularSeasonEventIds(playerId, season, seasontype);
  if (!eventIds?.length) return null;

  const pbpResults   = await Promise.all(eventIds.map(id => getProvider().getGamePbpStats(id, playerId)));
  const fetchedCount = pbpResults.filter(r => r.fetched).length;
  const onoff        = computeOnOff(pbpResults);
  const complete     = fetchedCount === eventIds.length;
  return onoff ? { onoff, complete } : null;
}

/**
 * Compute (or retrieve from cache) the on/off net rating for a player's season.
 * @param {string|number} playerId
 * @param {number|string} season  4-digit year
 * @param {number} [seasontype=2]  2 = regular season
 * @returns {Promise<{on,off,delta,games}|null>}
 */
async function computeSeasonOnOff(playerId, season, seasontype = 2) {
  if (isPastSeason(season)) {
    const cacheKey = `${playerId}-${season}-${seasontype}`;
    const cached   = await getCached('playerSeasonOnOff', cacheKey);
    if (cached !== null) return cached;

    const result = await computeSeasonOnOffUncached(playerId, season, seasontype);
    if (!result) return null;

    if (result.complete) writeCache('playerSeasonOnOff', cacheKey, result.onoff);
    return result.onoff;
  }

  // Current season: live compute, no Mongo.
  const result = await computeSeasonOnOffUncached(playerId, season, seasontype);
  return result?.onoff ?? null;
}

module.exports = { computeSeasonOnOff };
