// Name -> ESPN player id resolution. Extracted out of providers/balldontlie/idMap.js (2026-09-05):
// despite living there, this has no BDL dependency at all -- it's built from ESPN's own active-
// player list plus the playerIndex Mongo collection (same source percentileClient.js's loadPosMap
// already reads), so it's provider-neutral and belongs at this shared layer, same reasoning
// providers/cache.js's own header comment gives for its extraction out of espn/client.js.
//
// Originally built to bridge a BDL bulk endpoint's plain name (e.g. /player_shot_locations) back to
// this site's canonical ESPN id (every player-linking UI on this site routes by ESPN id) -- but any
// feature starting from a bare name (award-history data, for one) needs the exact same bridge.
//
// Rather than a name search per row (this codebase's forward direction, one BDL API call per
// player), build one in-process name->id index from sources this app already holds locally:
// getActivePlayers() (in memory) and the playerIndex Mongo collection (id/name for ~every
// historical player). Memoized for the process lifetime -- identity doesn't change at runtime.

const { getDb } = require('../db');
const espn = require('../providers/espn');

let nameIndexPromise = null;
async function buildNameIndex() {
  const db = getDb();
  const indexDocs = db
    ? await db.collection('playerIndex').find({}, { projection: { _id: 0, id: 1, name: 1 } }).toArray()
    : [];
  const byName = new Map();
  for (const p of [...espn.getActivePlayers(), ...indexDocs]) {
    if (!p?.name) continue;
    const key = p.name.trim().toLowerCase();
    if (!byName.has(key)) byName.set(key, new Set());
    byName.get(key).add(String(p.id));
  }
  return byName;
}

// Exact full-name match only. Returns null for zero or multiple matches -- a wrong link would
// misattribute a real row to the wrong player, worse than the row just showing a name with no link.
async function resolveEspnIdByName(fullName) {
  if (!nameIndexPromise) nameIndexPromise = buildNameIndex();
  const map = await nameIndexPromise;
  const ids = map.get(fullName.trim().toLowerCase());
  if (!ids || ids.size !== 1) return null;
  return [...ids][0];
}

module.exports = {
  resolveEspnIdByName,
  _resetNameIndexCacheForTest: () => { nameIndexPromise = null; },
};
