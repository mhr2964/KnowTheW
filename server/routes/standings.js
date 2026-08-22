// routes/standings.js — league-wide current standings. Split out as its own resource file (not
// folded into teams.js) since it's not team-scoped -- one call returns every team at once. See
// routes/api.js for the aggregator that mounts this.
const express = require('express');
const router  = express.Router();

const { getProvider } = require('../providers');

router.get('/standings', async (req, res) => {
  try {
    const season = req.query.season ? Number(req.query.season) : undefined;
    const standings = await getProvider().getStandings(season);
    if (!standings) return res.status(502).json({ error: 'failed to load standings' });
    res.json(standings);
  } catch (err) {
    console.error('standings:', err.message);
    res.status(502).json({ error: 'failed to load standings' });
  }
});

module.exports = router;
