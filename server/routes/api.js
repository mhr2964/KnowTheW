const express = require('express');
const router = express.Router();

const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/basketball/wnba';
const ESPN_WEB = 'https://site.web.api.espn.com/apis/common/v3/sports/basketball/wnba';

let teamsPromise = null;
const rosterPromises = {};
const rosterData = {};
const playerById = {};

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

getTeams()
  .then(teams => Promise.all(
    teams.map(t => getRoster(t.id, t.name).catch(err => console.error(`Roster failed ${t.name}:`, err.message)))
  ))
  .catch(err => console.error('Startup prefetch failed:', err.message));

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

router.get('/status', (req, res) => {
  res.json({
    status: 'ok',
    app: 'KnowTheW',
    teamsLoaded: teamsPromise !== null,
    rostersCached: Object.keys(rosterData).length,
    playersCached: Object.keys(playerById).length,
  });
});

module.exports = router;
