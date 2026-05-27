// Percentile system — source-agnostic math + caching. All ESPN fetching/parsing (byathlete
// positional indices, per-athlete rebound/foul stats, single-player season averages, the search
// index read) lives behind the provider in server/providers/espn/leagueStats.js. This module only
// builds league distributions from normalized stat lines, computes percentiles, and manages the
// Mongo distribution cache + player index write.

const { getDb } = require('../db');
const { getProvider } = require('../providers');
const { latestCompletedSeason } = require('./seasonWindow');

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
        // We only ever build COMPLETED seasons (see seasonWindow.js), whose stats are stable, so a
        // cached distribution is always reusable. The TTL only guards the (now-excluded) in-progress
        // season, so in practice the cache is reused without rebuild churn.
        const isInProgress = Number(season) > latestCompletedSeason();
        if (!isInProgress || Date.now() - doc.cachedAt < DIST_TTL_MS) {
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

// `pool`: 'position' (default) ranks a player within their G/F/C pool ("good for your position" —
// used by archetypes); 'all' ranks against the whole league ("absolute playstyle" — used by Cross-Era
// Similarity, so a guard's tiny block rate isn't inflated to "elite for a guard" and matched to a big).
function computeSeasonPercentiles(playerStats, fullDist, playerPos, pool = 'position') {
  if (!fullDist || !playerStats) return null;
  const posPool = fullDist[playerPos]?.PTS?.length ?? 0;
  const dist = pool === 'all'
    ? fullDist['all']
    : (posPool >= POSITION_MIN_BUCKET ? fullDist[playerPos] : fullDist['all']);
  if (!dist) return null;

  const out = {};
  for (const stat of PERCENTILE_STATS) {
    out[stat] = computePercentile(dist[stat], playerStats[stat], INVERTED_STATS.has(stat));
  }
  return out;
}

// Returns { "2025": { perGame: { PTS: 98, ... }, per36: { ... }, totals: { ... } }, ... }
// `pool` ('position' | 'all') chooses the comparison group — see computeSeasonPercentiles.
async function getPlayerPercentiles(playerId, { pool = 'position' } = {}) {
  const inputs = await getProvider().getPlayerSeasonAverages(playerId);
  if (!inputs) return null;
  const { statsByModeBySeason } = inputs;
  // Pool by the STABLE playerIndex position, not inputs.pos (prefetch-timing-dependent → jittery).
  const playerPos = await resolvePlayerPos(playerId);
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
      const computed = computeSeasonPercentiles(statsByModeBySeason[season]?.[mode] ?? null, fullDist, playerPos, pool);
      if (computed) seasonResult[MODE_KEY[mode]] = computed;
    }
    if (Object.keys(seasonResult).length) result[season] = seasonResult;
  }

  return Object.keys(result).length ? result : null;
}

async function warmDistributionCache() {
  const lastSeason = latestCompletedSeason(); // exclude the in-progress season (jitter source)
  const seasons = [];
  for (let y = 2011; y <= lastSeason; y++) seasons.push(String(y));
  await Promise.all(
    seasons.flatMap(season => DIST_MODES.map(mode => getOrBuildDistribution(season, mode).catch(() => null)))
  );
}

async function buildPlayerIndex() {
  const db = getDb();
  if (!db) return;

  const lastSeason = latestCompletedSeason();
  const seasons = [];
  for (let y = 2011; y <= lastSeason; y++) seasons.push(String(y));

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

const FINGERPRINT_COLLECTION = 'playerFingerprints';

// A handful of historical players carry no usable position in the league feed (the index stores the
// literal string 'NA'). Their G/F/C is well established; backfill it by id so the similarity
// position gate + same-position preference work and the UI shows no "NA" chip. Keyed by ESPN id.
const POSITION_OVERRIDES = {
  385: 'G', // Sheryl Swoopes (perimeter swingman)
  706: 'C', // Alison Bales
  742: 'F', // Sidney Spencer
  721: 'F', // Kerri Gardin
};

// Resolve a usable G/F/C: the season-averages feed (which often returns '' for older players), else
// the index position, else the override — treating both '' and the literal 'NA' as "unknown".
function resolvePos(fpPos, indexPos, id) {
  const p = fpPos || indexPos;
  if (p && p !== 'NA') return p;
  return POSITION_OVERRIDES[id] ?? null;
}

// Stable position source for percentile POOLING. The percentile system pools players by position, and
// the pool a player lands in must NOT depend on request timing. The provider's pos comes from
// espn.playerById, which a background roster prefetch fills asynchronously (empty → '' → all-pool;
// filled → 'F' → forwards-pool), and which never contains historical players at all — so the same
// player gets different fingerprints across calls, and historical vs active players get pooled
// inconsistently. The playerIndex (Mongo, byathlete-derived) carries a stable G/F/C for ~all players;
// use it as the authoritative pooling position. Memoized so it's a single query, not one per percentile.
let posMapPromise = null;
async function loadPosMap() {
  const db = getDb();
  if (!db) return new Map();
  const docs = await db.collection('playerIndex')
    .find({}, { projection: { _id: 0, id: 1, position: 1 } }).toArray();
  return new Map(docs.map(d => [String(d.id), d.position]));
}

/** Deterministic G/F/C (or null) for a player, from the playerIndex + overrides — independent of the
 *  roster prefetch. Used for percentile pooling and the fingerprint's `pos`. */
async function resolvePlayerPos(playerId) {
  if (!posMapPromise) posMapPromise = loadPosMap();
  const map = await posMapPromise;
  return resolvePos(null, map.get(String(playerId)), playerId);
}
// Seed-time concurrency: one ESPN getPlayerSeasonAverages call per player, so cap parallelism to
// stay friendly to the upstream feed while still finishing a ~700-player build in reasonable time.
const FINGERPRINT_BUILD_CONCURRENCY = 6;

// Process `items` through async `fn` at most `limit` at a time (chunked). Errors per item are the
// caller's responsibility (fn should not throw). Keeps the seed build from opening 700 sockets.
async function mapWithConcurrency(items, limit, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += limit) {
    const chunk = items.slice(i, i + limit);
    out.push(...await Promise.all(chunk.map(fn)));
  }
  return out;
}

// Precompute every indexed player's career fingerprint into the playerFingerprints collection so
// Cross-Era Similarity can rank a candidate pool from one Mongo read instead of ~700 live ESPN
// calls per request. Reuses getPlayerFingerprint (the exact archetype code path) so the cached axes
// can't drift from what /archetype computes. Best-effort, like buildPlayerIndex: a failure warns and
// the read path simply finds no candidates. Requires playerIndex + warm distributions to exist first.
//
// Lazy require of playerFingerprint avoids a load-time circular dependency (playerFingerprint
// requires this module for getPlayerPercentiles); by call time both modules are fully initialized.
async function buildFingerprintIndex() {
  const db = getDb();
  if (!db) return;
  const { getPlayerFingerprint, AXES_VERSION } = require('./analysis/playerFingerprint');

  const season = latestCompletedSeason();
  const indexed = await db.collection('playerIndex')
    .find({}, { projection: { _id: 0, id: 1, name: 1, position: 1 } }).toArray();

  const docs = await mapWithConcurrency(indexed, FINGERPRINT_BUILD_CONCURRENCY, async (p) => {
    try {
      // 'all' pool → league-wide absolute playstyle (see computeSeasonPercentiles); similarity ranks
      // on playstyle, not "good for your position".
      const fp = await getPlayerFingerprint(p.id, { pool: 'all' });
      const ok = !fp.insufficient && fp.axes;
      return {
        id: p.id,
        name: p.name ?? null,
        // The season-averages feed often returns an empty/'NA' pos for older players; the index
        // carries a reliable G/F/C for nearly all of them, and resolvePos backfills the last few from
        // POSITION_OVERRIDES. Without this, position-less players slip past the similarity gate.
        pos: resolvePos(fp.pos, p.position, p.id),
        axes: ok ? fp.axes : null,
        advanced: ok ? fp.advanced : null,
        totalMinutes: fp.totalMinutes ?? 0,
        seasonsCovered: fp.seasonsCovered ?? 0,
        season,
        axesVersion: AXES_VERSION,
      };
    } catch (err) {
      console.warn(`[buildFingerprintIndex] ${p.id} failed:`, err.message);
      return null;
    }
  });

  const upserts = docs.filter(Boolean).map(d => ({
    updateOne: { filter: { id: d.id }, update: { $set: d }, upsert: true },
  }));
  if (!upserts.length) return;
  try {
    await db.collection(FINGERPRINT_COLLECTION).bulkWrite(upserts, { ordered: false });
  } catch (err) {
    console.warn('[buildFingerprintIndex] write failed:', err.message);
  }
}

// Load the candidate pool for Cross-Era Similarity: only fingerprintable players (axes present)
// stamped with the CURRENT season + axis-schema version, so a stale cache (older axes, or a season
// behind) yields no candidates rather than wrong comparisons. Returns [] when there's no db/cache.
async function loadFingerprintIndex() {
  const db = getDb();
  if (!db) return [];
  const { AXES_VERSION } = require('./analysis/playerFingerprint');
  return db.collection(FINGERPRINT_COLLECTION)
    .find(
      { season: latestCompletedSeason(), axesVersion: AXES_VERSION, axes: { $ne: null } },
      { projection: { _id: 0, id: 1, name: 1, pos: 1, axes: 1, advanced: 1 } },
    )
    .toArray();
}

module.exports = {
  getPlayerPercentiles,
  PERCENTILE_STATS,
  warmDistributionCache,
  buildPlayerIndex,
  buildFingerprintIndex,
  loadFingerprintIndex,
  resolvePlayerPos,
};
