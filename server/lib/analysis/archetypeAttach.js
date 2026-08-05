// archetypeAttach.js — tags each roster player with the archetype label the player page
// would show, sourced from the precomputed fingerprint cache in ONE Mongo read (vs. a
// /archetype call per player). Moved out of routes/teams.js (formerly routes/api.js)
// verbatim during the God-Module split — no behavior change. Lives under analysis/
// alongside the rest of the archetype/fingerprint cluster since it depends on
// loadFingerprintIndex + confidenceFor.
//
// Lets the roster render the same hoverable badge; players under the fingerprint sample
// gate aren't in the cache → no badge. Best-effort: a cache miss/hiccup leaves the roster
// untouched rather than failing the request.
const { loadFingerprintIndex } = require('../percentileClient');
const { confidenceFor }        = require('./archetypes');

async function attachArchetypeNames(players) {
  if (!Array.isArray(players) || players.length === 0) return players;
  try {
    const index = await loadFingerprintIndex();
    // Carry both the label and its confidence (derived from the cached sample size, same
    // rule the /archetype card uses) so the roster badge can show its confidence dot
    // without a hover fetch.
    const byId = new Map(index.map(f => [String(f.id), {
      name: f.archetype,
      confidence: f.archetype ? confidenceFor({ totalMinutes: f.totalMinutes, seasonsCovered: f.seasonsCovered }) : null,
    }]));
    return players.map(p => {
      const a = byId.get(String(p.id));
      return { ...p, archetypeName: a?.name ?? null, archetypeConfidence: a?.confidence ?? null };
    });
  } catch {
    return players;
  }
}

module.exports = { attachArchetypeNames };
