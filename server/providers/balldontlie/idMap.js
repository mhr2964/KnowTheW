// Identity resolution between this site's ESPN-sourced team/player ids (used everywhere in the
// app — identity itself stays ESPN-sourced forever, see docs/design/provider-architecture.md) and
// BallDontLie's own numeric ids. Every BDL-backed provider method needs to cross this bridge.
//
// Team resolution is cheap and reliable (abbreviation match against a ~35-row list, cached).
// Player resolution is the one real correctness risk in this whole provider: it's a name search,
// not an id lookup, so it can collide (two players sharing a name) or miss (typos, suffixes).
// Resolutions are cached permanently — including confirmed-unresolvable players — via the existing
// Mongo cache-aside helper, since identity never changes and a wrong/missing resolution should be
// investigated once, not re-attempted on every request.

const { bdlFetch, withCache, bdlTeamsCache } = require('./client');
const { getCached, writeCache } = require('../../lib/teamSeasonCache');
const espn = require('../espn');

// A BDL team counts as a real WNBA franchise iff it has a conference assigned. Confirmed by spike:
// every exhibition/All-Star/national-team entry (TEAM COOP, EAST/WEST All-Star squads, Team WNBA,
// Team USA, BRAZIL/JAPAN/AUS/PUERTORICO, TBD placeholders, and the not-yet-launched Portland/Toronto
// expansion entries) has conference:null; all 15 real franchises (including defunct-but-real
// Houston Comets/Sacramento Monarchs) have a real conference. Simpler and more future-proof than
// matching against a hardcoded exhibition-name list.
function isRealFranchise(team) {
  return team?.conference != null;
}

async function fetchBdlTeamsRaw() {
  const data = await bdlFetch('/teams', { per_page: 100 });
  return data?.data ?? null;
}

function getBdlTeams() {
  return withCache(bdlTeamsCache, 'all', fetchBdlTeamsRaw);
}

let teamMapPromise = null;

// Pure abbreviation-matching logic, split out so it's unit-testable without a network call —
// mirrors plays.js's buildBoxscoreFromRows split for the same reason.
function buildTeamMapFromLists(espnTeams, bdlTeams) {
  if (!bdlTeams) return {};
  const bdlByAbbr = new Map(
    bdlTeams.filter(isRealFranchise).map(t => [String(t.abbreviation).toUpperCase(), t.id])
  );
  const map = {};
  for (const t of espnTeams) {
    const bdlId = bdlByAbbr.get(String(t.abbreviation).toUpperCase());
    if (bdlId != null) map[String(t.id)] = bdlId;
  }
  return map;
}

// Builds { [espnTeamId]: bdlTeamId } by matching on abbreviation among real franchises only.
// Memoized in-process for the process lifetime — team identity/abbreviations don't change at
// runtime, and a restart is a fine way to pick up a genuine rename (matches how ESPN's own teams
// cache uses a long TTL rather than "never changes").
async function buildTeamMap() {
  const [espnTeams, bdlTeams] = await Promise.all([espn.getTeams(), getBdlTeams()]);
  return buildTeamMapFromLists(espnTeams, bdlTeams);
}

async function resolveBdlTeamId(espnTeamId) {
  if (!teamMapPromise) teamMapPromise = buildTeamMap();
  const map = await teamMapPromise;
  return map[String(espnTeamId)] ?? null;
}

// Player resolution: search BDL by last name, match the full name exactly (case-insensitive).
// Exactly one match -> resolved. Zero matches -> unresolvable (cached as a confirmed miss so we
// don't re-search on every request). More than one exact full-name match is a real, rare same-name
// collision (e.g. two different "A. Johnson"s aren't full-name collisions, but true duplicates
// happen in any sufficiently large sports history) -- logged and treated as unresolvable rather than
// guessed, since a silent wrong match would corrupt stats without looking wrong.
// Pure candidate-matching logic, split out so the actual correctness-risk part (exact vs zero vs
// ambiguous name matching) is unit-testable without a network call or an ESPN dependency.
function matchPlayerCandidate(fullName, bdlPlayers) {
  const candidates = (bdlPlayers ?? []).filter(p =>
    `${p.first_name} ${p.last_name}`.trim().toLowerCase() === fullName.toLowerCase()
  );
  if (candidates.length === 1) return { id: candidates[0].id, ambiguous: false };
  if (candidates.length > 1) return { id: null, ambiguous: true };
  return { id: null, ambiguous: false };
}

async function resolveBdlPlayerIdUncached(espnPlayerId) {
  const basics = await espn.getPlayerBasics(espnPlayerId) ?? await espn.getRetiredPlayer(espnPlayerId);
  const fullName = basics?.name?.trim();
  if (!fullName) return null;

  const lastName = fullName.split(/\s+/).pop();
  const results = await bdlFetch('/players', { search: lastName, per_page: 25 });
  const { id, ambiguous } = matchPlayerCandidate(fullName, results?.data);

  if (ambiguous) {
    console.warn(`[balldontlie/idMap] ambiguous player match for "${fullName}" (espnId=${espnPlayerId}) — leaving unresolved`);
  }
  return id;
}

async function resolveBdlPlayerId(espnPlayerId) {
  const key = String(espnPlayerId);
  const cached = await getCached('bdlPlayerIdMap', key);
  if (cached !== null) return cached.bdlId;

  const bdlId = await resolveBdlPlayerIdUncached(espnPlayerId);
  // Cache both a real resolution and a confirmed miss (bdlId: null) -- identity never changes, so
  // there's no reason to re-search on every request either way.
  writeCache('bdlPlayerIdMap', key, { bdlId });
  return bdlId;
}

module.exports = {
  isRealFranchise, getBdlTeams, resolveBdlTeamId, resolveBdlPlayerId,
  // exported for unit tests:
  buildTeamMapFromLists, matchPlayerCandidate,
};
