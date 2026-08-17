// lib/schedulerAuth.js — requireSchedulerAuth middleware guarding the internal endpoint that
// Heroku Scheduler hits every 10 minutes (server/routes/internalJobs.js). Mirrors
// lib/adminAuth.js's fail-closed, timing-safe shared-secret pattern exactly, but against its own
// env var (SCHEDULER_TOKEN) and header (x-scheduler-token) — a distinct secret/caller from
// ADMIN_TOKEN, not folded into it.
const crypto = require('crypto');

function requireSchedulerAuth(req, res, next) {
  const schedulerToken = process.env.SCHEDULER_TOKEN;
  if (!schedulerToken) {
    console.error('requireSchedulerAuth: SCHEDULER_TOKEN is not set — refusing all requests');
    return res.status(503).json({ error: 'service unavailable' });
  }

  const headerToken = req.headers['x-scheduler-token'];
  if (!headerToken) {
    return res.status(401).json({ error: 'not authorized' });
  }

  const aBuf = Buffer.from(schedulerToken, 'utf8');
  const bBuf = Buffer.from(headerToken, 'utf8');
  // timingSafeEqual requires equal-length buffers; a length mismatch is itself a safe reject signal.
  if (aBuf.length !== bBuf.length || !crypto.timingSafeEqual(aBuf, bBuf)) {
    return res.status(401).json({ error: 'not authorized' });
  }

  next();
}

module.exports = { requireSchedulerAuth };
