// routes/meta.js — small cross-cutting endpoints (search, status) that aren't specific
// to the teams or players resource, split out of the former monolithic routes/api.js.
// See routes/api.js for the aggregator that mounts this alongside teams.js and players.js.
const express = require('express');
const router  = express.Router();

const { getDb }                = require('../db');
const { searchBulkLegacyPlayers } = require('../constants/legacyPlayerBulk');
const { getProvider }          = require('../providers');

router.get('/search', async (req, res) => {
  const q = (req.query.q || '').toLowerCase().trim();
  if (!q) return res.json({ teams: [], players: [] });
  try {
    const allTeams = await getProvider().getTeams();
    const matchedTeams = allTeams.filter(
      t => t.name.toLowerCase().includes(q) || t.abbreviation.toLowerCase().includes(q)
    );

    const activePlayers = getProvider().getActivePlayers()
      .filter(p => p.name.toLowerCase().includes(q));
    const activeIds = new Set(activePlayers.map(p => p.id));

    let retiredPlayers = [];
    const db = getDb();
    if (db) {
      const docs = await db.collection('playerIndex')
        .find({ name: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } })
        .limit(20)
        .toArray();
      retiredPlayers = docs
        .filter(d => !activeIds.has(d.id))
        .map(d => ({ id: d.id, name: d.name, position: d.position, headshot: d.headshot, retired: true }));
    }

    // Pre-2002 legends are stored alongside the bulk-legacy dataset (single source of truth).
    // Eight hand-curated greats have per-game stats inline; the rest are advanced-only.
    const bulkLegacyMatches = searchBulkLegacyPlayers(q);

    const matchedPlayers = [...activePlayers, ...retiredPlayers, ...bulkLegacyMatches].slice(0, 30);
    res.json({ teams: matchedTeams, players: matchedPlayers });
  } catch (err) {
    console.error('search:', err.message);
    res.status(502).json({ error: 'search failed' });
  }
});

router.get('/status', (req, res) => {
  const activePlayers = getProvider().getActivePlayers();
  res.json({
    status: 'ok',
    app: 'KnowTheW',
    teamsLoaded: true,
    rostersCached: new Set(activePlayers.map(p => p.teamId)).size,
    playersCached: activePlayers.length,
  });
});

module.exports = router;
