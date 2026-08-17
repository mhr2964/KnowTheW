// routes/notifications.js — logged-in user's own pre-game notifications (in-app only; the client
// polls this endpoint, no push/email delivery). Docs are created by
// server/lib/notificationsJob.js (triggered via server/routes/internalJobs.js) and TTL-expire out
// of MongoDB a few hours after kickoff (see server/db.js's notifications.expiresAt index) — this
// route also filters expiresAt >  now server-side so a doc that's due for TTL cleanup but hasn't
// been reaped yet doesn't briefly reappear to the client.
const express = require('express');
const router  = express.Router();

const { ObjectId } = require('mongodb');

const { getDb } = require('../db');
const { requireAuth } = require('../lib/auth');

router.get('/notifications', requireAuth, async (req, res) => {
  // requireAuth already 503s if the DB was down when it needed to look up the user, but that
  // doesn't guarantee it's still up now — re-check here the same way users.js does after requireAuth.
  const db = getDb();
  if (!db) return res.status(503).json({ error: 'service unavailable' });

  try {
    // Scoped to the user's CURRENT teamRepId (req.user, populated by requireAuth from a fresh DB
    // read), not just userId — otherwise notifications created while repping a since-abandoned
    // team keep showing up in the bell until the TTL reaps them, up to 4 hours after that old
    // team's kickoff. Read-time filtering is sufficient here: the job (lib/notificationsJob.js)
    // has no way to know about a future team-rep change at write time, so there's nothing useful
    // to filter there.
    const docs = await db.collection('notifications')
      .find({
        userId: new ObjectId(req.userId),
        teamRepId: req.user.teamRepId,
        expiresAt: { $gt: new Date() },
      })
      .sort({ gameDate: 1 })
      .toArray();

    const notifications = docs.map(doc => ({
      id: String(doc._id),
      teamRepId: doc.teamRepId,
      gameId: doc.gameId,
      opponent: doc.opponent,
      atVs: doc.atVs,
      gameDate: doc.gameDate,
      expiresAt: doc.expiresAt,
    }));

    res.status(200).json({ notifications });
  } catch (err) {
    console.error('notifications GET:', err.message);
    res.status(502).json({ error: 'failed to load notifications' });
  }
});

module.exports = router;
