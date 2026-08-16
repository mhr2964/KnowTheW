// routes/users.js — logged-in user's own account resources (team-rep selection).
// Auth-protected via requireAuth (server/lib/auth.js). See server/routes/api.js for
// where this router gets mounted.
const express = require('express');
const router  = express.Router();

const { ObjectId } = require('mongodb');

const { getDb } = require('../db');
const { requireAuth } = require('../lib/auth');
const { isNumericId } = require('../lib/routeValidation');
const { findTeam } = require('../lib/teamLookup');

router.put('/users/me/team-rep', requireAuth, async (req, res) => {
  const { teamId } = req.body || {};
  if (!isNumericId(teamId)) {
    return res.status(400).json({ error: 'teamId must be a numeric string' });
  }

  try {
    // findTeam only matches getTeams() (active franchises) — legacy/defunct synthetic ids
    // ('legacy-...') fail isNumericId above, and retired-but-numeric ids simply won't be found here.
    const team = await findTeam(teamId);
    if (!team) return res.status(400).json({ error: 'unknown team' });

    const db = getDb();
    if (!db) return res.status(503).json({ error: 'service unavailable' });

    await db.collection('users').updateOne(
      { _id: new ObjectId(req.userId) },
      { $set: { teamRepId: teamId, updatedAt: new Date() } }
    );

    res.status(200).json({ teamRepId: teamId });
  } catch (err) {
    console.error('users/me/team-rep PUT:', err.message);
    res.status(502).json({ error: 'failed to set team rep' });
  }
});

router.delete('/users/me/team-rep', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'service unavailable' });

    await db.collection('users').updateOne(
      { _id: new ObjectId(req.userId) },
      { $set: { teamRepId: null, updatedAt: new Date() } }
    );

    res.status(200).json({ teamRepId: null });
  } catch (err) {
    console.error('users/me/team-rep DELETE:', err.message);
    res.status(502).json({ error: 'failed to clear team rep' });
  }
});

module.exports = router;
