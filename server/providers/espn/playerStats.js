// ESPN player-level fetches that previously lived as raw fetch() calls inside route handlers and
// gradedReportInputs. Centralizing them here is the M3 step toward a clean provider boundary.
//
// Note: getPlayerSeasonStats still returns ESPN's raw stats JSON (regData/postData) because the
// downstream parser (statsParser.parseESPNSeasonData) consumes that shape directly. Fully
// normalizing the season-stats payload (so raw ESPN JSON stops crossing the boundary) is deferred
// to a later milestone; for now this just consolidates WHERE the fetch happens, not its shape.

const { ESPN_WEB } = require('../../lib/espnClient');

/** Minimal player identity used by the graded-report builder: { id, name, position } or null. */
async function getPlayerBasics(playerId) {
  const r = await fetch(`${ESPN_WEB}/athletes/${playerId}`);
  if (!r.ok) return null;
  const data = await r.json();
  const a = data.athlete;
  if (!a) return null;
  return {
    id:       String(a.id),
    name:     a.displayName ?? a.fullName ?? 'Unknown',
    position: a.position?.abbreviation ?? '',
  };
}

/** Full retired-player profile (not in the active-roster cache), or null if ESPN has no record. */
async function getRetiredPlayer(playerId) {
  const r = await fetch(`${ESPN_WEB}/athletes/${playerId}`);
  if (!r.ok) return null;
  const data = await r.json();
  const a = data.athlete;
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

/** Raw regular-season + playoff season-stats payloads (each null on a non-2xx response). */
async function getPlayerSeasonStats(playerId) {
  const [regData, postData] = await Promise.all([
    fetch(`${ESPN_WEB}/athletes/${playerId}/stats?seasontype=2`).then(r => (r.ok ? r.json() : null)),
    fetch(`${ESPN_WEB}/athletes/${playerId}/stats?seasontype=3`).then(r => (r.ok ? r.json() : null)),
  ]);
  return { regData, postData };
}

module.exports = { getPlayerBasics, getRetiredPlayer, getPlayerSeasonStats };
