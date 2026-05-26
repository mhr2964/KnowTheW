// Percentile system — source-agnostic math + caching. All ESPN fetching/parsing (byathlete
// positional indices, per-athlete rebound/foul stats, single-player season averages, the search
// index read) lives behind the provider in server/providers/espn/leagueStats.js. This module only
// builds league distributions from normalized stat lines, computes percentiles, and manages the
// Mongo distribution cache + player index write.

const { getDb } = require('../db');
const { getProvider } = require('../providers');

const DIST_CACHE_COLLECTION = 'distributionCache';
const DIST_TTL_MS = 24 * 60 * 60 * 1000;

const DISTRIBUTION_MIN    = 30;
const POSITION_MIN_BUCKET = 20;

const PERCENTILE_STATS = ['PTS', 'REB', 'AST', 'STL', 'BLK', 'FG_PCT', 'FG3_PCT', 'FT_PCT', 'TOV', 'PF', 'OREB', 'DREB', 'FGM', 'FGA', 'FG3M', 'FG3A', 'FTM', 'FTA', 'MIN'];
const INVERTED_STATS = new Set(['TOV', 'PF']);

const distributionCache    = {};
const distributionInFlight = {};

async function getOrBuildDistribution(season, mode = 'PerGame') {
  const key = `${season}:${mode}`;
  if (distributionCache[key]) return distributionCache[key];
  if (distributionInFlight[key]) return distributionInFlight[key];

  distributionInFlight[key] = (async () => {
    const dbRead = getDb();
    if (dbRead) {
      const doc = await dbRead.collection(DIST_CACHE_COLLECTION).findOne({ season, mode });
      if (doc) {
        const currentYear = new Date().getFullYear();
        const isRecent = Number(season) >= currentYear - 1;
        if (!isRecent || Date.now() - doc.cachedAt < DIST_TTL_MS) {
          distributionCache[key] = doc.distribution;
          return doc.distribution;
        }
      }
    }

    const dist = await buildLeagueDistribution(season, mode);
    if (dist) {
      distributionCache[key] = dist;
      const dbWrite = getDb();
      if (dbWrite) {
        await dbWrite.collection(DIST_CACHE_COLLECTION).updateOne(
          { season, mode },
          { $set: { distribution: dist, cachedAt: Date.now() } },
          { upsert: true }
        );
      }
    }
    return dist ?? null;
  })().finally(() => { delete distributionInFlight[key]; });

  return distributionInFlight[key];
}

// ── Distribution builder ──────────────────────────────────────────────────────
// Sorts the provider's normalized stat lines into per-stat, per-position-group ascending arrays.

async function buildLeagueDistribution(season, mode = 'PerGame') {
  const qualified = await getProvider().getLeagueStatLines(season, mode);
  if (qualified.length < DISTRIBUTION_MIN) return null;

  const groups = { all: qualified };
  for (const entry of qualified) {
    if (entry.pos) (groups[entry.pos] ??= []).push(entry);
  }

  const distribution = {};
  for (const [grp, players] of Object.entries(groups)) {
    distribution[grp] = {};
    for (const stat of PERCENTILE_STATS) {
      distribution[grp][stat] = players
        .filter(p => p[stat] !== null && p[stat] !== undefined)
        .map(p => p[stat])
        .sort((a, b) => a - b);
    }
  }

  await enrichWithIndividualStats(distribution, season, mode);
  return distribution;
}

// OREB/DREB/PF aren't in the byathlete feed, so they're sourced per-player and scaled by mode here.
async function enrichWithIndividualStats(distribution, season, mode) {
  const entries = await getProvider().getLeagueReboundFoulStats(season);
  if (entries.length < DISTRIBUTION_MIN) return;

  const groups = { all: entries };
  for (const entry of entries) {
    if (entry.pos) (groups[entry.pos] ??= []).push(entry);
  }

  for (const [grp, grpEntries] of Object.entries(groups)) {
    if (!distribution[grp]) continue;
    for (const stat of ['OREB', 'DREB', 'PF']) {
      distribution[grp][stat] = grpEntries.map(e => {
        const pg = e[stat];
        if (pg === null || pg === undefined) return null;
        if (mode === 'PerGame') return pg;
        if (mode === 'Totals')  return pg * e.gp;
        return e.mpg > 0 ? (pg / e.mpg) * 36 : null;
      }).filter(v => v !== null).sort((a, b) => a - b);
    }
  }
}

// ── Percentile computation ──────────────────────────────────────────────────

function computePercentile(sortedAsc, value, inverted) {
  if (!sortedAsc?.length || value === null || value === undefined) return null;
  const below = inverted
    ? sortedAsc.filter(v => v > value).length
    : sortedAsc.filter(v => v < value).length;
  return Math.round((below / sortedAsc.length) * 100);
}

const DIST_MODES = ['PerGame', 'Per36', 'Totals'];
const MODE_KEY   = { PerGame: 'perGame', Per36: 'per36', Totals: 'totals' };

function computeSeasonPercentiles(playerStats, fullDist, playerPos) {
  if (!fullDist || !playerStats) return null;
  const posPool = fullDist[playerPos]?.PTS?.length ?? 0;
  const dist = posPool >= POSITION_MIN_BUCKET ? fullDist[playerPos] : fullDist['all'];
  if (!dist) return null;

  const out = {};
  for (const stat of PERCENTILE_STATS) {
    out[stat] = computePercentile(dist[stat], playerStats[stat], INVERTED_STATS.has(stat));
  }
  return out;
}

// Returns { "2025": { perGame: { PTS: 98, ... }, per36: { ... }, totals: { ... } }, ... }
async function getPlayerPercentiles(playerId) {
  const inputs = await getProvider().getPlayerSeasonAverages(playerId);
  if (!inputs) return null;
  const { pos: playerPos, statsByModeBySeason } = inputs;
  const seasons = Object.keys(statsByModeBySeason);
  if (!seasons.length) return null;

  await Promise.all(
    seasons.flatMap(season => DIST_MODES.map(mode => getOrBuildDistribution(season, mode)))
  );

  const result = {};
  for (const season of seasons) {
    const seasonResult = {};
    for (const mode of DIST_MODES) {
      const fullDist = distributionCache[`${season}:${mode}`] ?? null;
      const computed = computeSeasonPercentiles(statsByModeBySeason[season]?.[mode] ?? null, fullDist, playerPos);
      if (computed) seasonResult[MODE_KEY[mode]] = computed;
    }
    if (Object.keys(seasonResult).length) result[season] = seasonResult;
  }

  return Object.keys(result).length ? result : null;
}

async function warmDistributionCache() {
  const currentYear = new Date().getFullYear();
  const seasons = [];
  for (let y = 2011; y <= currentYear; y++) seasons.push(String(y));
  await Promise.all(
    seasons.flatMap(season => DIST_MODES.map(mode => getOrBuildDistribution(season, mode).catch(() => null)))
  );
}

async function buildPlayerIndex() {
  const db = getDb();
  if (!db) return;

  const currentYear = new Date().getFullYear();
  const seasons = [];
  for (let y = 2011; y <= currentYear; y++) seasons.push(String(y));

  const players = await getProvider().getLeaguePlayerIndex(seasons);
  const upserts = players.map(p => ({
    updateOne: { filter: { id: p.id }, update: { $set: p }, upsert: true },
  }));

  if (upserts.length) {
    try {
      await db.collection('playerIndex').bulkWrite(upserts, { ordered: false });
    } catch (err) {
      console.warn('[buildPlayerIndex] write failed:', err.message);
      // Continue — read path falls back to live computation
    }
  }
}

module.exports = { getPlayerPercentiles, PERCENTILE_STATS, warmDistributionCache, buildPlayerIndex };
