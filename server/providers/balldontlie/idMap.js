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

// Returns { id, cacheable }. cacheable is false when the BDL search itself failed (network/rate
// limit/auth/etc -- bdlFetch already returns null indistinguishably for all of those) -- caching a
// fetch FAILURE the same way as a genuine "zero real candidates" result would permanently mark a
// real player as unresolvable off one bad request. Confirmed live (2026-08-17): a full cache-warming
// pass wrote 149 of 150 resolutions as confirmed misses before this fix. Root cause of THAT specific
// run turned out to be a dead API key (see client.js's own comment) rather than anything about the
// request pattern -- but this fix is worth keeping regardless, since ANY transient failure (a real
// rate limit, a network blip) would poison the cache the exact same permanent way without it.
async function resolveBdlPlayerIdUncached(espnPlayerId) {
  const basics = await espn.getPlayerBasics(espnPlayerId) ?? await espn.getRetiredPlayer(espnPlayerId);
  const fullName = basics?.name?.trim();
  if (!fullName) return { id: null, cacheable: true }; // no ESPN identity to search with -- genuine, not transient

  const lastName = fullName.split(/\s+/).pop();
  const results = await bdlFetch('/players', { search: lastName, per_page: 25 });
  if (!results) return { id: null, cacheable: false };

  const { id, ambiguous } = matchPlayerCandidate(fullName, results.data);
  if (ambiguous) {
    console.warn(`[balldontlie/idMap] ambiguous player match for "${fullName}" (espnId=${espnPlayerId}) — leaving unresolved`);
  }
  return { id, cacheable: true };
}

// In-process memoization on top of the Mongo cache-aside: a single request/run can call
// resolveBdlPlayerId for the SAME player many times over (once per game in a season, once per
// season in a career), often concurrently, before Mongo's write has even landed (writeCache is
// fire-and-forget). This coalesces concurrent calls into one BDL search instead of a thundering
// herd. Deliberately NOT kept after a non-cacheable (transient-failure) result settles -- a later,
// non-concurrent call should get to retry rather than being stuck on one bad break for the rest of
// the process's uptime.
const playerIdPromises = new Map();

async function resolveBdlPlayerId(espnPlayerId) {
  const key = String(espnPlayerId);
  if (playerIdPromises.has(key)) return playerIdPromises.get(key);

  const promise = (async () => {
    const cached = await getCached('bdlPlayerIdMap', key);
    if (cached !== null) return cached.bdlId;

    const { id: bdlId, cacheable } = await resolveBdlPlayerIdUncached(espnPlayerId);
    // Cache both a real resolution and a confirmed miss (bdlId: null) -- identity never changes, so
    // there's no reason to re-search on every request either way. A failed BDL search itself
    // (cacheable: false) is NOT written -- that would permanently mark a real player unresolvable off
    // one transient failure instead of leaving the slot open for a future, successful attempt.
    if (cacheable) {
      writeCache('bdlPlayerIdMap', key, { bdlId });
    } else {
      playerIdPromises.delete(key);
    }
    return bdlId;
  })();

  playerIdPromises.set(key, promise);
  return promise;
}

module.exports = {
  isRealFranchise, getBdlTeams, resolveBdlTeamId, resolveBdlPlayerId,
  // exported for unit tests:
  buildTeamMapFromLists, matchPlayerCandidate,
  _resetPlayerIdCacheForTest: () => playerIdPromises.clear(),
};
