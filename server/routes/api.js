const express = require('express');
const router = express.Router();

const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/basketball/wnba';
const ESPN_WEB = 'https://site.web.api.espn.com/apis/common/v3/sports/basketball/wnba';
const WNBA_STATS = 'https://stats.wnba.com/stats';
const WNBA_HEADERS = {
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'x-nba-stats-origin': 'stats',
  'x-nba-stats-token': 'true',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Referer': 'https://www.wnba.com/',
  'Origin': 'https://www.wnba.com',
};

// ── ESPN caches ──────────────────────────────────────────────────────────────
let teamsPromise = null;
const rosterPromises = {};
const rosterData = {};
const playerById = {};

// ── WNBA Stats caches ────────────────────────────────────────────────────────
let wnbaMapPromise = null;
const wnbaIdByName = {};

// ── ESPN helpers ─────────────────────────────────────────────────────────────
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

async function fetchPlayerStats(playerId) {
  const res = await fetch(`${ESPN_WEB}/athletes/${playerId}/overview`);
  if (!res.ok) return null;
  const data = await res.json();
  const s = data.statistics;
  if (!s || !s.labels) return null;
  return {
    labels: s.labels,
    names: s.names,
    displayNames: s.displayNames,
    splits: s.splits,
  };
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

// ── WNBA Stats helpers ───────────────────────────────────────────────────────
function normName(s) {
  return String(s)
    .toLowerCase()
    .replace(/[\u2018\u2019\u0060\u00b4]/g, "'") // curly/backtick apostrophes → straight
    .replace(/\./g, '')                            // remove periods (Jr., Sr., etc.)
    .replace(/\s+/g, ' ')
    .trim();
}

async function buildWNBAMap() {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(
      `${WNBA_STATS}/commonallplayers?LeagueID=10&Season=2024&IsOnlyCurrentSeason=0`,
      { headers: WNBA_HEADERS, signal: ctrl.signal }
    );
    if (!res.ok) throw new Error(`commonallplayers ${res.status}`);
    const json = await res.json();
    const rs = json.resultSets[0];
    const ni = rs.headers.indexOf('DISPLAY_FIRST_LAST');
    const ii = rs.headers.indexOf('PERSON_ID');
    const map = {};
    rs.rowSet.forEach(r => {
      const raw = String(r[ni]);
      map[raw.toLowerCase()] = r[ii];   // exact lowercase
      map[normName(raw)] = r[ii];        // normalized (apostrophes, periods)
    });
    console.log(`WNBA player map loaded: ${Object.keys(map).length} entries`);
    return map;
  } finally {
    clearTimeout(timer);
  }
}

function getWNBAMap() {
  if (!wnbaMapPromise) {
    wnbaMapPromise = buildWNBAMap().catch(err => {
      console.error('WNBA map build failed:', err.message);
      wnbaMapPromise = null;
      return {};
    });
  }
  return wnbaMapPromise;
}

async function resolveWNBAId(name) {
  const key = name.toLowerCase();
  if (key in wnbaIdByName) return wnbaIdByName[key];
  const map = await getWNBAMap();
  const id = map[key] ?? map[normName(name)] ?? null;
  wnbaIdByName[key] = id;
  if (!id) console.warn(`WNBA ID not found for: "${name}" (map size: ${Object.keys(map).length})`);
  return id;
}

function toTable(rs) {
  if (!rs || !rs.rowSet?.length) return null;
  return { headers: rs.headers, rows: rs.rowSet };
}

async function wnbaFetch(path) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(`${WNBA_STATS}/${path}`, { headers: WNBA_HEADERS, signal: ctrl.signal });
    if (!res.ok) return null;
    const json = await res.json();
    const out = {};
    (json.resultSets || []).forEach(rs => { out[rs.name] = toTable(rs); });
    return out;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function shapeSplits(d) {
  if (!d) return null;
  return {
    regular: d.SeasonTotalsRegularSeason || null,
    regularCareer: d.CareerTotalsRegularSeason || null,
    playoffs: d.SeasonTotalsPostSeason || null,
    playoffCareer: d.CareerTotalsPostSeason || null,
  };
}

// ── Startup prefetch ─────────────────────────────────────────────────────────
getTeams()
  .then(teams => Promise.all(
    teams.map(t => getRoster(t.id, t.name).catch(err => console.error(`Roster failed ${t.name}:`, err.message)))
  ))
  .catch(err => console.error('Startup prefetch failed:', err.message));

getWNBAMap();

// ── Routes ───────────────────────────────────────────────────────────────────
router.get('/teams', async (req, res) => {
  try {
    res.json(await getTeams());
  } catch {
    res.status(500).json({ error: 'failed to load teams' });
  }
});

router.get('/teams/:id/roster', async (req, res) => {
  try {
    const allTeams = await getTeams();
    const team = allTeams.find(t => t.id === req.params.id);
    if (!team) return res.status(404).json({ error: 'team not found' });
    const players = await getRoster(team.id, team.name);
    res.json({ team, players });
  } catch {
    res.status(500).json({ error: 'failed to load roster' });
  }
});

router.get('/search', async (req, res) => {
  const q = (req.query.q || '').toLowerCase().trim();
  if (!q) return res.json({ teams: [], players: [] });
  try {
    const allTeams = await getTeams();
    const matchedTeams = allTeams.filter(
      t => t.name.toLowerCase().includes(q) || t.abbreviation.toLowerCase().includes(q)
    );
    const matchedPlayers = Object.values(rosterData)
      .flat()
      .filter(p => p.name.toLowerCase().includes(q))
      .slice(0, 30);
    res.json({ teams: matchedTeams, players: matchedPlayers });
  } catch {
    res.status(500).json({ error: 'search failed' });
  }
});

router.get('/players/:id', async (req, res) => {
  try {
    const player = playerById[req.params.id];
    if (!player) return res.status(404).json({ error: 'player not found — load their team roster first' });
    const stats = await fetchPlayerStats(req.params.id);
    res.json({ player, stats });
  } catch {
    res.status(500).json({ error: 'failed to load player' });
  }
});

router.get('/players/:id/detailed-stats', async (req, res) => {
  try {
    const player = playerById[req.params.id];
    if (!player) return res.status(404).json({ error: 'player not found' });

    const wnbaId = await resolveWNBAId(player.name);
    if (!wnbaId) return res.status(404).json({ error: 'not found in WNBA Stats database' });

    const [pg, tot, p36, p100] = await Promise.all([
      wnbaFetch(`playercareerstats?PlayerID=${wnbaId}&PerMode=PerGame`),
      wnbaFetch(`playercareerstats?PlayerID=${wnbaId}&PerMode=Totals`),
      wnbaFetch(`playercareerstats?PlayerID=${wnbaId}&PerMode=Per36`),
      wnbaFetch(`playercareerstats?PlayerID=${wnbaId}&PerMode=Per100Possessions`),
    ]);

    res.json({
      wnbaId,
      perGame: shapeSplits(pg),
      totals: shapeSplits(tot),
      per36: shapeSplits(p36),
      per100: shapeSplits(p100),
    });
  } catch (err) {
    console.error('detailed-stats:', err.message);
    res.status(500).json({ error: 'failed to load detailed stats' });
  }
});

router.get('/debug/wnba', async (req, res) => {
  const map = await getWNBAMap().catch(() => ({}));
  const size = Object.keys(map).length;
  const q = req.query.name;
  if (q) {
    const id = map[q.toLowerCase()] ?? map[normName(q)] ?? null;
    return res.json({ query: q, wnbaId: id, mapSize: size });
  }
  res.json({ mapSize: size, sample: Object.entries(map).slice(0, 10) });
});

router.get('/status', (req, res) => {
  res.json({
    status: 'ok',
    app: 'KnowTheW',
    teamsLoaded: teamsPromise !== null,
    rostersCached: Object.keys(rosterData).length,
    playersCached: Object.keys(playerById).length,
    wnbaMapLoaded: wnbaMapPromise !== null,
  });
});

module.exports = router;
