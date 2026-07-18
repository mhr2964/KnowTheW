// ESPN player-level fetches that previously lived as raw fetch() calls inside route handlers and
// gradedReportInputs. Centralizing them here is the M3 step toward a clean provider boundary.
//
// Note: getPlayerSeasonStats still returns ESPN's raw stats JSON (regData/postData) because the
// downstream parser (statsParser.parseESPNSeasonData) consumes that shape directly. Fully
// normalizing the season-stats payload (so raw ESPN JSON stops crossing the boundary) is deferred
// to a later milestone; for now this just consolidates WHERE the fetch happens, not its shape.

const { ESPN_WEB, withTtlCache } = require('./client');

// These three are hit on every player-page load (basics on lookup, season stats behind every
// Per Game/Totals/Per 36/Advanced tab) with no cache in front of them at all before this — every
// visitor to the same player re-triggered a fresh ESPN fetch. TTL'd rather than cached forever
// because the payload includes the in-progress current season, which changes after every game;
// 15 minutes bounds ESPN traffic to a small fraction of page views while keeping same-day
// freshness. withTtlCache serves the last-known-good value on a transient ESPN error.
const PLAYER_TTL_MS = 15 * 60 * 1000;
const basicsCache = {};
const retiredCache = {};
const seasonStatsCache = {};

// Fetch the ESPN athlete record once; both player-profile shapes below build from it. Returns the
// `athlete` object or null (non-2xx response or missing athlete).
async function fetchAthlete(playerId) {
  const r = await fetch(`${ESPN_WEB}/athletes/${playerId}`);
  if (!r.ok) return null;
  const data = await r.json();
  return data.athlete ?? null;
}

async function fetchPlayerBasicsRaw(playerId) {
  const a = await fetchAthlete(playerId);
  if (!a) return null;
  return {
    id:       String(a.id),
    name:     a.displayName ?? a.fullName ?? 'Unknown',
    position: a.position?.abbreviation ?? '',
  };
}

/** Minimal player identity used by the graded-report builder: { id, name, position } or null. */
function getPlayerBasics(playerId) {
  return withTtlCache(basicsCache, playerId, PLAYER_TTL_MS, () => fetchPlayerBasicsRaw(playerId));
}

async function fetchRetiredPlayerRaw(playerId) {
  const a = await fetchAthlete(playerId);
  if (!a) return null;
  return {
    id:           String(a.id),
    name:         a.displayName,
    position:     a.position?.abbreviation ?? '',
    positionName: a.position?.displayName  ?? '',
    jersey:       a.jersey ?? null,
    headshot:     a.headshot?.href ?? null,
    height:       a.height ?? null,
    weight:       a.weight ?? null,
    age:          a.age    ?? null,
    college:      a.college?.name ?? null,
    birthPlace:   null,
    experience:   a.experience?.years ?? null,
    teamId:       null,
    teamName:     null,
    retired:      true,
  };
}

/** Full retired-player profile (not in the active-roster cache), or null if ESPN has no record. */
function getRetiredPlayer(playerId) {
  return withTtlCache(retiredCache, playerId, PLAYER_TTL_MS, () => fetchRetiredPlayerRaw(playerId));
}

async function fetchPlayerSeasonStatsRaw(playerId) {
  const [regData, postData] = await Promise.all([
    fetch(`${ESPN_WEB}/athletes/${playerId}/stats?seasontype=2`).then(r => (r.ok ? r.json() : null)),
    fetch(`${ESPN_WEB}/athletes/${playerId}/stats?seasontype=3`).then(r => (r.ok ? r.json() : null)),
  ]);
  return { regData, postData };
}

/** Raw regular-season + playoff season-stats payloads (each null on a non-2xx response). */
function getPlayerSeasonStats(playerId) {
  return withTtlCache(seasonStatsCache, playerId, PLAYER_TTL_MS, () => fetchPlayerSeasonStatsRaw(playerId));
}

module.exports = { getPlayerBasics, getRetiredPlayer, getPlayerSeasonStats };
