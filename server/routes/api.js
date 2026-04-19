const express = require('express');
const router = express.Router();

const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/basketball/wnba';

let teamsPromise = null;
const rosterPromises = {};
const rosterData = {};

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

async function fetchRoster(teamId) {
  const res = await fetch(`${ESPN}/teams/${teamId}/roster`);
  if (!res.ok) throw new Error(`ESPN roster ${res.status}`);
  const data = await res.json();
  return (data.athletes || []).map(p => ({
    id: p.id,
    name: p.fullName || p.displayName,
    position: p.position?.abbreviation || '',
    jersey: p.jersey || '',
    headshot: p.headshot?.href || null,
  }));
}

function getTeams() {
  if (!teamsPromise) teamsPromise = fetchTeams();
  return teamsPromise;
}

function getRoster(teamId) {
  if (!rosterPromises[teamId]) {
    rosterPromises[teamId] = fetchRoster(teamId).then(players => {
      rosterData[teamId] = players;
      return players;
    });
  }
  return rosterPromises[teamId];
}

getTeams().catch(err => console.error('Teams fetch failed:', err.message));

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
    const players = await getRoster(team.id);
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

router.get('/status', (req, res) => {
  res.json({
    status: 'ok',
    app: 'KnowTheW',
    teamsLoaded: teamsPromise !== null,
    rostersCached: Object.keys(rosterData).length,
  });
});

module.exports = router;
