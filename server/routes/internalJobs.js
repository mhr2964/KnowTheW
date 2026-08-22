// routes/internalJobs.js — internal, infrastructure-triggered endpoints (currently just the
// Heroku Scheduler job that polls for due pre-game notifications), not called by browsers or the
// app's own client. Mounted at /internal/jobs in server/index.js, deliberately outside /api and
// its rate limiter — the shared-secret gate in requireSchedulerAuth (server/lib/schedulerAuth.js)
// is the actual access control here, consistent with how other admin-token-gated internal
// surfaces in this app work.
const express = require('express');
const router  = express.Router();

const { getDb } = require('../db');
const { getProvider } = require('../providers');
const { requireSchedulerAuth } = require('../lib/schedulerAuth');
const { pollAndCreateNotifications } = require('../lib/notificationsJob');
const { pollAndCreateInjuryNotifications } = require('../lib/injuryNotificationsJob');

router.post('/notifications/poll', requireSchedulerAuth, async (req, res) => {
  const db = getDb();
  if (!db) return res.status(503).json({ error: 'service unavailable' });

  try {
    const summary = await pollAndCreateNotifications({ db, provider: getProvider() });
    // Report a real failure count via HTTP status too, not just in the JSON body — an internal-
    // only endpoint scraped by Heroku Scheduler is only actionable if a bad run's own run history
    // shows non-200, otherwise a failed poll (e.g. a sustained Mongo hiccup — see
    // lib/notificationsJob.js's insertMany error handling) looks identical to a clean one.
    res.status(summary.errors > 0 ? 500 : 200).json(summary);
  } catch (err) {
    console.error('internal/jobs/notifications/poll:', err.message);
    res.status(500).json({ error: 'poll failed' });
  }
});

// Same shared-secret gate and pattern as /notifications/poll above -- separate route (not folded
// into the same poll) so either job can be scheduled on its own cadence and one's failure/run
// history doesn't get conflated with the other's in Heroku Scheduler's UI.
router.post('/notifications/injuries/poll', requireSchedulerAuth, async (req, res) => {
  const db = getDb();
  if (!db) return res.status(503).json({ error: 'service unavailable' });

  try {
    const summary = await pollAndCreateInjuryNotifications({ db, provider: getProvider() });
    res.status(summary.errors > 0 ? 500 : 200).json(summary);
  } catch (err) {
    console.error('internal/jobs/notifications/injuries/poll:', err.message);
    res.status(500).json({ error: 'poll failed' });
  }
});

module.exports = router;
