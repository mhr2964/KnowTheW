const { getDb } = require('../db');

const ESPN      = 'https://site.api.espn.com/apis/site/v2/sports/basketball/wnba';
const ESPN_WEB  = 'https://site.web.api.espn.com/apis/common/v3/sports/basketball/wnba';
const STANDINGS = 'https://site.api.espn.com/apis/v2/sports/basketball/wnba/standings';

const TEAMS_TTL_MS = 6 * 60 * 60 * 1000;
let teamsCache = null;
let teamsFetchedAt = 0;
let teamsRefreshing = null;

const rosterPromises = {};
const rosterData = {};
const playerById = {};
const teamSeasonStatsCache = {};
const teamPtsAllowedCache  = {};

// Generic cache wrapper: returns cached value if present, else calls fn() and caches the result.
// Caches null on network error so a flaky upstream doesn't keep hammering on retries.
async function withCache(cache, key, fn) {
  if (key in cache) return cache[key];
  try { return (cache[key] = await fn()); }
  catch { return (cache[key] = null); }
}

async function fetchTeams() {
  const [teamsRes, standings] = await Promise.all([
    fetch(`${ESPN}/teams?limit=100`),
    fetchStandings(),
  ]);
  if (!teamsRes.ok) throw new Error(`ESPN teams ${teamsRes.status}`);
  const data = await teamsRes.json();
  return data.sports[0].leagues[0].teams.map(({ team: t }) => {
    const logo = t.logos?.[0]?.href || null;
    const std  = standings?.[String(t.id)] ?? null;
    const out  = {
      id: t.id,
      name: t.displayName,
      shortName: t.shortDisplayName,
      // ESPN's team.abbreviation is unreliable for WNBA (returns "CONNECTICU", "DALLAS").
      // The logo filename is the canonical tricode, so derive from there and fall back if missing.
      abbreviation: tricodeFromLogo(logo) || t.abbreviation,
      color: t.color || '555555',
      logo,
      slug: t.slug,
      location: t.location || null,
    };
    if (std) {
      const totalGames = (std.wins ?? 0) + (std.losses ?? 0);
      // Preseason / 0-0 → omit both record and seed; only conference + location remain.
      if (totalGames > 0) {
        if (std.wins != null && std.losses != null) out.record = `${std.wins}-${std.losses}`;
        const seedLabel = formatSeedLabel(std.seed);
        if (seedLabel) out.seedLabel = seedLabel;
      }
      if (std.conference) out.conference = std.conference;
    }
    return out;
  });
}

function tricodeFromLogo(url) {
  const m = url && url.match(/\/teamlogos\/wnba\/\d+\/([a-z]{2,4})\.png/i);
  return m ? m[1].toUpperCase() : null;
}

async function fetchStandings() {
  try {
    const res = await fetch(STANDINGS);
    if (!res.ok) return null;
    const data = await res.json();
    const out = {};
    for (const child of data.children ?? []) {
      const conference = child.name;
      for (const entry of child.standings?.entries ?? []) {
        const teamId = String(entry.team?.id ?? '');
        if (!teamId) continue;
        const stat = (name) => (entry.stats ?? []).find(s => s.name === name)?.value;
        const w = stat('wins'), l = stat('losses'), seed = stat('playoffSeed');
        out[teamId] = {
          conference,
          wins:   typeof w === 'number' ? Math.round(w) : null,
          losses: typeof l === 'number' ? Math.round(l) : null,
          seed:   typeof seed === 'number' ? Math.round(seed) : null,
        };
      }
    }
    return out;
  } catch {
    return null;
  }
}

function formatSeedLabel(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return null;
  const v = n % 100;
  const suffix = (v >= 11 && v <= 13) ? 'th' : (['th','st','nd','rd'][n % 10] || 'th');
  return `${n}${suffix}`;
}

async function fetchRoster(teamId, teamName) {
  const res = await fetch(`${ESPN}/teams/${teamId}/roster`);
  if (!res.ok) throw new Error(`ESPN roster ${res.status}`);
  const data = await res.json();
  return (data.athletes || []).map(p => ({
    id: p.id,
    name: p.fullName || p.displayName,
    position: p.position?.abbreviation || '',
    positionName: p.position?.displayName || '',
    jersey: p.jersey || '',
    headshot: p.headshot?.href || null,
    height: p.displayHeight || null,
    weight: p.displayWeight || null,
    age: p.age || null,
    college: p.college?.name || null,
    birthPlace: p.birthPlace
      ? [p.birthPlace.city, p.birthPlace.state, p.birthPlace.country].filter(Boolean).join(', ')
      : null,
    experience: p.experience?.years ?? null,
    teamId,
    teamName,
  }));
}

async function getTeams() {
  const now = Date.now();
  const stale = teamsCache && now - teamsFetchedAt > TEAMS_TTL_MS;

  if ((!teamsCache || stale) && !teamsRefreshing) {
    teamsRefreshing = fetchTeams()
      .then(fresh => { teamsCache = fresh; teamsFetchedAt = Date.now(); return fresh; })
      .catch(err => {
        console.error('fetchTeams failed:', err.message);
        if (teamsCache) return teamsCache;
        throw err;
      })
      .finally(() => { teamsRefreshing = null; });
  }

  if (teamsCache) return teamsCache;
  return teamsRefreshing;
}

function getRoster(teamId, teamName) {
  if (!rosterPromises[teamId]) {
    rosterPromises[teamId] = fetchRoster(teamId, teamName).then(players => {
      rosterData[teamId] = players;
      players.forEach(p => { playerById[p.id] = p; });
      return players;
    });
  }
  return rosterPromises[teamId];
}

// Raw stats fetch — no in-process cache wrapper. Used by past-season route handlers that route
// through the MongoDB teamSeasonCache instead. The in-process cache (teamSeasonStatsCache) is
// reserved for current-season use only so its invalidation story stays clean.
//
// Return values:
//   null         — ESPN returned a non-2xx response (transient error, do not cache).
//   { noData: true } — ESPN returned 200 but the response body has no stats categories (confirmed
//                  empty; safe to cache permanently for past seasons, e.g. pre-draft expansion year).
//   { fgaPg, ... } — Normalized stats object.
async function fetchTeamStatsRaw(teamId, year) {
  const res = await fetch(`${ESPN}/teams/${teamId}/statistics?season=${year}&seasontype=2`);
  // Non-2xx → transient ESPN error. Callers must not cache this.
  if (!res.ok) return null;
  const data = await res.json();
  const cats = data.results?.stats?.categories;
  // ESPN 200 but no stats categories — confirmed empty (e.g. team had no games that season).
  if (!cats) return { noData: true };
  const off = cats.find(c => c.name === 'offensive');
  const def = cats.find(c => c.name === 'defensive');
  const g = (cat, name) => cat?.stats.find(s => s.name === name)?.value ?? null;
  return {
    fgaPg:   g(off, 'avgFieldGoalsAttempted'),
    fgmPg:   g(off, 'avgFieldGoalsMade'),
    fgPct:   g(off, 'fieldGoalPct'),
    fg3mPg:  g(off, 'avgThreePointFieldGoalsMade'),
    fg3Pct:  g(off, 'threePointPct'),
    ftaPg:   g(off, 'avgFreeThrowsAttempted'),
    ftmPg:   g(off, 'avgFreeThrowsMade'),
    ftPct:   g(off, 'freeThrowPct'),
    ptsPg:   g(off, 'avgPoints'),
    orbPg:   g(off, 'avgOffensiveRebounds'),
    drbPg:   g(def, 'avgDefensiveRebounds'),
    tovPg:   g(off, 'avgTurnovers'),
    astPg:   g(off, 'avgAssists'),
  };
}

function fetchTeamStats(teamId, year) {
  return withCache(teamSeasonStatsCache, `${teamId}-${year}`, () => fetchTeamStatsRaw(teamId, year));
}

// Raw points-allowed fetch — no in-process cache wrapper. Same rationale as fetchTeamStatsRaw:
// past-season callers route through teamSeasonCache (MongoDB) instead.
async function fetchTeamPtsAllowedRaw(teamId, year) {
  const res = await fetch(`${ESPN}/teams/${teamId}/schedule?season=${year}`);
  if (!res.ok) return null;
  const data = await res.json();
  let sum = 0, count = 0;
  for (const event of data.events ?? []) {
    // ESPN schedule uses either event.seasonType or event.season for the type field
    const stType = event.seasonType?.type ?? event.season?.type;
    const stId   = event.seasonType?.id   ?? event.season?.id   ?? String(stType);
    if (stType !== 2 && stId !== '2') continue;
    const comps = event.competitions?.[0]?.competitors ?? [];
    const tm  = comps.find(c => String(c.team?.id) === String(teamId));
    const opp = comps.find(c => String(c.team?.id) !== String(teamId));
    if (tm && opp && opp.score != null) {
      const pts = parseFloat(opp.score?.value ?? opp.score);
      if (!isNaN(pts) && pts > 0) { sum += pts; count++; }
    }
  }
  return count > 0 ? sum / count : null;
}

// Returns average points allowed per regular-season game (full team schedule, not player gamelog).
function fetchTeamPtsAllowed(teamId, year) {
  return withCache(teamPtsAllowedCache, `${teamId}-${year}`, () => fetchTeamPtsAllowedRaw(teamId, year));
}

// Fetches and normalizes a team's schedule for a given season and season type.
// seasontype: 2 = regular season, 3 = playoffs.
//
// Return values:
//   null  — ESPN returned a non-2xx response or a network/parse error occurred (transient, not cacheable).
//   []    — ESPN returned 200 with zero events (confirmed-empty, safe to cache permanently for past seasons).
//   [...] — Normalized event objects.
//
// Callers that treat any falsy result as "no games" (e.g. historyAggregator) handle null the same
// as [] with `events ?? []` or a length check, so the null return is backwards-compatible.
//
// Each event includes roundLabel (populated only for seasontype=3 when ESPN provides competition.type.text).
//
// Pagination note: verified on 2024 Connecticut Sun regular season — ESPN returns all 40 games
// in a single response. No pagination keys appear in the response envelope. Accepted for v1.
async function fetchTeamSchedule(teamId, season, seasontype = 2) {
  try {
    const res = await fetch(`${ESPN}/teams/${teamId}/schedule?season=${season}&seasontype=${seasontype}`);
    // Non-2xx → transient ESPN error. Return null so callers can distinguish from a legitimate empty schedule.
    if (!res.ok) return null;
    const data = await res.json();
    return (data.events ?? []).map(event => {
      const comp  = event.competitions?.[0] ?? {};
      const comps = comp.competitors ?? [];
      const tm    = comps.find(c => String(c.team?.id) === String(teamId));
      const opp   = comps.find(c => String(c.team?.id) !== String(teamId));
      return {
        id:         event.id,
        date:       comp.date ?? event.date ?? null,
        opponent:   opp  ? { id: String(opp.team?.id), abbreviation: opp.team?.abbreviation, logo: opp.team?.logos?.[0]?.href ?? null } : null,
        atVs:       tm?.homeAway === 'home' ? 'vs' : '@',
        result:     tm?.winner === true ? 'W' : (tm?.winner === false ? 'L' : null),
        teamScore:  tm?.score?.value  ?? null,
        oppScore:   opp?.score?.value ?? null,
        winner:     tm?.winner ?? null,
        // roundLabel populated only for playoff games where ESPN provides competition.type.text
        roundLabel: seasontype === 3 ? (comp.type?.text ?? null) : undefined,
      };
    });
  } catch (err) {
    console.error(`fetchTeamSchedule teamId=${teamId} season=${season} seasontype=${seasontype}:`, err.message);
    // Network or parse error → treat same as non-2xx (transient, not cacheable).
    return null;
  }
}

// Convenience wrapper: fetches only the playoff schedule (seasontype=3) for a given team/year.
// Used by historyAggregator to derive playoffResult. Non-fatal — returns [] on error.
function fetchPlayoffSchedule(teamId, season) {
  return fetchTeamSchedule(teamId, season, 3);
}

async function fetchHistoricalRoster(teamId, season) {
  const res = await fetch(`${ESPN}/teams/${teamId}/roster?season=${season}`);
  if (!res.ok) return [];
  const data = await res.json();
  const raw = data.athletes || [];
  // ESPN returns two formats: flat [{ id, position }] or grouped [{ items: [...] }]
  if (raw.length > 0 && Array.isArray(raw[0].items)) {
    return raw.flatMap(group =>
      (group.items || []).map(p => ({ id: String(p.id), position: p.position?.abbreviation || '' }))
    );
  }
  return raw.map(p => ({ id: String(p.id), position: p.position?.abbreviation || '' }));
}

// Fetches a historical season roster from the ESPN Web API using the richer /common/v3/ endpoint.
// The site.api.espn.com roster endpoint returns empty athletes[] for all historical seasons;
// site.web.api.espn.com returns full player metadata under positionGroups[].athletes[].
//
// ESPN API limitation (verified 2026-05-11): the ?season= parameter is silently ignored by
// ESPN's WNBA team roster endpoint — it always returns the current active roster regardless of
// the season you request. There is no known ESPN endpoint that returns the actual players who
// were on a team in a past season. This function returns what ESPN provides with the season
// field in the response set to the requested year so the client can identify what was requested.
//
// Returns the same shape as fetchRoster() so the /api/teams/:id/roster route handler can use
// one mapping path for both current and historical seasons. Fields missing from the ESPN response
// serialize as null (not omitted) so client null-checks behave consistently.
//
// Non-fatal: returns [] if ESPN is unreachable, returns a non-200, or the body is malformed.
async function fetchSeasonRoster(teamId, season, teamName) {
  try {
    const res = await fetch(`${ESPN_WEB}/teams/${teamId}/roster?season=${season}`);
    if (!res.ok) return [];
    const data = await res.json();
    // positionGroups is the container; pick the "all" group or flatten all groups.
    const groups = data.positionGroups ?? [];
    const allGroup = groups.find(g => g.type === 'all') ?? groups[0];
    const athletes = allGroup?.athletes ?? groups.flatMap(g => g.athletes ?? []);
    return athletes.map(p => ({
      id:           String(p.id),
      name:         p.fullName || p.displayName || null,
      position:     p.position?.abbreviation || '',
      positionName: p.position?.displayName  || '',
      jersey:       p.jersey   ?? null,
      headshot:     p.headshot?.href         ?? null,
      height:       p.displayHeight          ?? null,
      weight:       p.displayWeight          ?? null,
      age:          p.age                    ?? null,
      college:      p.college?.name          ?? null,
      birthPlace:   p.birthPlace
        ? [p.birthPlace.city, p.birthPlace.state, p.birthPlace.country].filter(Boolean).join(', ')
        : null,
      experience:   p.experience?.years      ?? null,
      teamId,
      teamName: teamName ?? null,
    }));
  } catch (err) {
    console.error(`fetchSeasonRoster teamId=${teamId} season=${season}:`, err.message);
    return [];
  }
}

async function fetchGameSummary(eventId) {
  const db = getDb();
  if (db) {
    const doc = await db.collection('gameSummaries').findOne({ _id: eventId });
    if (doc) return doc.data;
  }
  try {
    const res = await fetch(`${ESPN}/summary?event=${eventId}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (db) db.collection('gameSummaries')
      .replaceOne({ _id: eventId }, { _id: eventId, data }, { upsert: true })
      .catch(err => console.error('mongo write gameSummaries:', err.message));
    return data;
  } catch {
    return null;
  }
}

// Prefetch all teams and rosters on startup so first requests are fast
getTeams()
  .then(teams => Promise.all(
    teams.map(t => getRoster(t.id, t.name).catch(err => console.error(`Roster failed ${t.name}:`, err.message)))
  ))
  .catch(err => console.error('Startup prefetch failed:', err.message));

module.exports = {
  ESPN, ESPN_WEB, STANDINGS, withCache,
  getTeams, getRoster, fetchHistoricalRoster, fetchSeasonRoster,
  fetchTeamStats, fetchTeamStatsRaw, fetchTeamPtsAllowed, fetchTeamPtsAllowedRaw,
  fetchGameSummary,
  fetchTeamSchedule, fetchPlayoffSchedule,
  formatSeedLabel,
  rosterData, playerById, teamSeasonStatsCache,
};
