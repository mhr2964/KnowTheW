// Play-by-Play season stats computation with MongoDB cache-aside.
//
// Runs computeOnOff + computePbpStats over the same pbpResults array so callers get both
// on/off net ratings and shooting splits from one Mongo cache entry + one ESPN fetch pass.
//
// Cache pattern mirrors onOffClient.js: past seasons cached in playerSeasonPbpStats, current
// season always live. Cache writes gated on a complete fetch (every eventId fetched).

'use strict';

const { getProvider } = require('../providers');
const { getCached, writeCache } = require('./teamSeasonCache');
const { computeOnOff } = require('./analysis/onOff');
const { computePbpStats } = require('./analysis/pbpStats');

async function computeSeasonPbpStatsUncached(playerId, season, seasontype = 2) {
  const eventIds = await getProvider().getRegularSeasonEventIds(playerId, season, seasontype);
  if (!eventIds?.length) return null;

  const pbpResults   = await Promise.all(eventIds.map(id => getProvider().getGamePbpStats(id, playerId)));
  const fetchedCount = pbpResults.filter(r => r.fetched).length;
  const onoff        = computeOnOff(pbpResults);
  const shooting     = computePbpStats(pbpResults);
  const complete     = fetchedCount === eventIds.length;

  if (!onoff && !shooting) return null;
  return { onoff: onoff ?? null, shooting: shooting ?? null, complete };
}

/**
 * Compute (or retrieve from cache) play-by-play shooting + on/off stats for a player's season.
 * @param {string|number} playerId
 * @param {number|string} season  4-digit year
 * @param {number} [seasontype=2]  2 = regular season
 * @returns {Promise<{onoff:object|null, shooting:object|null}|null>}
 */
async function computeSeasonPbpStats(playerId, season, seasontype = 2) {
  const currentYear  = new Date().getFullYear();
  const isPastSeason = Number(season) < currentYear;

  if (isPastSeason) {
    const cacheKey = `${playerId}-${season}-${seasontype}`;
    const cached   = await getCached('playerSeasonPbpStats', cacheKey);
    if (cached !== null) return cached;

    const result = await computeSeasonPbpStatsUncached(playerId, season, seasontype);
    if (!result) return null;

    const data = { onoff: result.onoff, shooting: result.shooting };
    if (result.complete) writeCache('playerSeasonPbpStats', cacheKey, data);
    return data;
  }

  // Current season: live compute, no Mongo.
  const result = await computeSeasonPbpStatsUncached(playerId, season, seasontype);
  if (!result) return null;
  return { onoff: result.onoff, shooting: result.shooting };
}

module.exports = { computeSeasonPbpStats };
