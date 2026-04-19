const express = require('express');
const router = express.Router();

const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/basketball/wnba';

let cache = null;
let cacheLoading = null;

async function buildCache() {
  const res = await fetch(`${ESPN}/teams?limit=100`);
  if (!res.ok) throw new Error(`ESPN teams ${res.status}`);
  const data = await res.json();

  const teams = data.sports[0].leagues[0].teams.map(({ team: t }) => ({
    id: t.id,
    name: t.displayName,
    shortName: t.shortDisplayName,
    abbreviation: t.abbreviation,
    color: t.color || '555555',
    logo: t.logos?.[0]?.href || null,
    slug: t.slug,
  }));

  const rosterResults = await Promise.allSettled(
    teams.map(async (team) => {
      const r = await fetch(`${ESPN}/teams/${team.id}/roster`);
      if (!r.ok) return { teamId: team.id, players: [] };
      const d = await r.json();
      const players = (d.athletes || []).flatMap(group =>
        (group.items || []).map(p => ({
          id: p.id,
          name: p.fullName,
          position: p.position?.abbreviation || '',
          jersey: p.jersey || '',
          headshot: p.headshot?.href || null,
          teamId: team.id,
          teamName: team.name,
          teamAbbr: team.abbreviation,
        }))
      );
      return { teamId: team.id, players };
    })
  );

  const playersByTeam = {};
  for (const r of rosterResults) {
    if (r.status === 'fulfilled') {
      playersByTeam[r.value.teamId] = r.value.players;
    }
  }

  return { teams, playersByTeam };
}

function getCache() {
  if (cache) return Promise.resolve(cache);
  if (cacheLoading) return cacheLoading;
  cacheLoading = buildCache().then(data => {
    cache = data;
    cacheLoading = null;
    return data;
  });
  return cacheLoading;
}

getCache().catch(err => console.error('Cache build failed:', err.message));

router.get('/teams', async (req, res) => {
  try {
    const { teams } = await getCache();
    res.json(teams);
  } catch {
    res.status(500).json({ error: 'failed to load teams' });
  }
});

router.get('/teams/:id/roster', async (req, res) => {
  try {
    const { teams, playersByTeam } = await getCache();
    const team = teams.find(t => t.id === req.params.id);
    if (!team) return res.status(404).json({ error: 'team not found' });
    res.json({ team, players: playersByTeam[team.id] || [] });
  } catch {
    res.status(500).json({ error: 'failed to load roster' });
  }
});

router.get('/search', async (req, res) => {
  const q = (req.query.q || '').toLowerCase().trim();
  if (!q) return res.json({ teams: [], players: [] });
  try {
    const { teams, playersByTeam } = await getCache();
    const matchedTeams = teams.filter(
      t => t.name.toLowerCase().includes(q) || t.abbreviation.toLowerCase().includes(q)
    );
    const allPlayers = Object.values(playersByTeam).flat();
    const matchedPlayers = allPlayers
      .filter(p => p.name.toLowerCase().includes(q))
      .slice(0, 30);
    res.json({ teams: matchedTeams, players: matchedPlayers });
  } catch {
    res.status(500).json({ error: 'search failed' });
  }
});

router.get('/status', (req, res) => {
  res.json({ status: 'ok', app: 'KnowTheW', cacheReady: cache !== null });
});

module.exports = router;
