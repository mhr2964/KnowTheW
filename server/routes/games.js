// routes/games.js — single-game box score, split out as its own resource file (mirrors teams.js/
// players.js's one-file-per-resource convention) rather than folded into meta.js's cross-cutting
// /league/* endpoints -- this is a specific-game lookup, not a league-wide aggregate.
const express = require('express');
const router  = express.Router();

const { getProvider }      = require('../providers');
const { requireNumericId } = require('../lib/routeValidation');

router.get('/games/:id', requireNumericId('id'), async (req, res) => {
  try {
    const boxScore = await getProvider().getGameBoxScore(req.params.id);
    if (!boxScore) return res.status(404).json({ error: 'no box score available for this game' });
    res.json(boxScore);
  } catch (err) {
    console.error(`games/${req.params.id}:`, err.message);
    res.status(502).json({ error: 'failed to load box score' });
  }
});

module.exports = router;
