const { getDb } = require('../db');

const ESPN     = 'https://site.api.espn.com/apis/site/v2/sports/basketball/wnba';
const ESPN_WEB = 'https://site.web.api.espn.com/apis/common/v3/sports/basketball/wnba';

let teamsPromise = null;
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
  const res = await fetch(`${ESPN}/teams?limit=100`);
  if (!res.ok) throw new Error(`ESPN teams ${res.status}`);
  const data = await res.json();
  return data.sports[0].leagues[0].teams.map(({ team: t }) => ({
    id: t.id,
    name: t.displayName,
    shortName: t.shortDisplayName,
    abbreviation: t.abbreviation,
    color: t.color || '555555',
    logo: t.logos?.[0]?.href || null,
    slug: t.slug,
  }));
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

function getTeams() {
  if (!teamsPromise) teamsPromise = fetchTeams();
  return teamsPromise;
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

function fetchTeamStats(teamId, year) {
  return withCache(teamSeasonStatsCache, `${teamId}-${year}`, async () => {
    const res = await fetch(`${ESPN}/teams/${teamId}/statistics?season=${year}&seasontype=2`);
    if (!res.ok) return null;
    const data = await res.json();
    const cats = data.results?.stats?.categories;
    if (!cats) return null;
    const off = cats.find(c => c.name === 'offensive');
    const def = cats.find(c => c.name === 'defensive');
    const g = (cat, name) => cat?.stats.find(s => s.name === name)?.value ?? null;
    return {
      fgaPg:   g(off, 'avgFieldGoalsAttempted'),
      fgmPg:   g(off, 'avgFieldGoalsMade'),
      fg3mPg:  g(off, 'avgThreePointFieldGoalsMade'),
      ftaPg:   g(off, 'avgFreeThrowsAttempted'),
      ftmPg:   g(off, 'avgFreeThrowsMade'),
      ptsPg:   g(off, 'avgPoints'),
      orbPg:   g(off, 'avgOffensiveRebounds'),
      drbPg:   g(def, 'avgDefensiveRebounds'),
      tovPg:   g(off, 'avgTurnovers'),
      astPg:   g(off, 'avgAssists'),
    };
  });
}

// Returns average points allowed per regular-season game (full team schedule, not player gamelog).
function fetchTeamPtsAllowed(teamId, year) {
  return withCache(teamPtsAllowedCache, `${teamId}-${year}`, async () => {
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
  });
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
  ESPN, ESPN_WEB, withCache,
  getTeams, getRoster, fetchHistoricalRoster, fetchTeamStats, fetchTeamPtsAllowed, fetchGameSummary,
  rosterData, playerById, teamSeasonStatsCache,
};
