// teamSeasonCache.js — MongoDB cache-aside helper for past-season data.
//
// Provides a single shared helper `readOrFetch` used by the stats, schedule, and season-info
// routes. All three collections follow the same document shape:
//   { _id: '<teamId>-<season>' (or '<teamId>-<season>-<seasontype>'), payload, cachedAt }
//
// No TTL — past-season data is immutable. Manual invalidation via db.collection.deleteMany() is
// the acceptable v1 mechanism for the rare ESPN-correction case.
//
// Design decisions:
//   - String _id keys match the teamHistories / teamNarratives pattern.
//   - Single-tier cache (no in-process L1 over MongoDB L2) for past seasons. Current season uses
//     the existing in-process caches in the ESPN provider's client — those remain unchanged.
//   - getDb() null → bypass cache, call fetchFn directly. Identical degradation to historyAggregator.
//   - Write is fire-and-forget — a failed write logs a warning but does not break the response.
//   - Write is gated: writes on non-null non-empty responses, AND on `{ empty: true, confirmedEmpty: true }`
//     envelopes (ESPN 200 with zero results — legitimate, immutable for past seasons). A bare
//     `{ empty: true }` without confirmedEmpty signals a transient ESPN error and is never cached.

const { getDb } = require('../db');

// Reads from the named MongoDB collection using key as _id.
// Returns cached.payload on hit, null on miss or error.
async function getCached(collectionName, key) {
  const db = getDb();
  if (!db) return null;
  try {
    const doc = await db.collection(collectionName).findOne({ _id: key });
    return doc ? doc.payload : null;
  } catch (err) {
    console.warn(`[teamSeasonCache] read failed coll=${collectionName} key=${key}:`, err.message);
    return null;
  }
}

// Writes payload to the named MongoDB collection under key.
// Fire-and-forget — errors are logged and swallowed; the caller's response is unaffected.
function writeCache(collectionName, key, payload) {
  const db = getDb();
  if (!db) return; // dev path — no MongoDB
  db.collection(collectionName)
    .replaceOne(
      { _id: key },
      { _id: key, payload, cachedAt: new Date() },
      { upsert: true }
    )
    .catch(err =>
      console.warn(`[teamSeasonCache] write failed coll=${collectionName} key=${key}:`, err.message)
    );
}

// Cache-aside: check MongoDB first, call fetchFn on miss, write result if non-empty.
// collectionName: e.g. 'teamSeasonStats', 'teamSeasonSchedule', 'teamSeasonInfo'
// key: string _id — caller is responsible for assembling the right key (e.g. include seasontype
//   in the key for schedule to prevent collision between regular and playoff entries).
// fetchFn: async () => payload — called only on cache miss.
//
// Write gate: writes to MongoDB when either:
//   - fresh is non-null and not empty (normal successful response), OR
//   - fresh.confirmedEmpty is true (ESPN returned 200 with zero data — legitimate, immutable for past seasons).
//
// Does NOT write when fresh.empty is true without confirmedEmpty. That envelope signals a transient
// ESPN error (non-2xx or network failure); caching it would permanently serve wrong data.
//
// Distinction set by route handlers:
//   { empty: true }                   — transient error, do not cache
//   { empty: true, confirmedEmpty: true } — ESPN 200 + zero results, cache forever
async function readOrFetch(collectionName, key, fetchFn) {
  const db = getDb();
  if (!db) {
    // Dev path: no MongoDB — call fetchFn directly with no caching.
    return fetchFn();
  }

  const cached = await getCached(collectionName, key);
  if (cached !== null) return cached;

  // Cache miss — fetch from upstream.
  const fresh = await fetchFn();

  // Gate: persist if non-null and (non-empty OR confirmed-empty from a real ESPN 200 response).
  if (fresh != null && (!fresh.empty || fresh.confirmedEmpty)) {
    writeCache(collectionName, key, fresh);
  }

  return fresh;
}

module.exports = { getCached, writeCache, readOrFetch };
