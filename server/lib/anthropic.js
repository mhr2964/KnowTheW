// anthropic.js — single shared Anthropic SDK access layer.
//
// Both AI features (graded reports, franchise narratives) hit the same API behind the same
// ANTHROPIC_API_KEY, so the client is initialised once here (Singleton) rather than once per
// feature module. The transient-retry helper lives here too because both callers used a verbatim
// copy of it. Feature modules import getClient()/callWithRetry()/enabled instead of re-implementing.
//
// Defensive init: missing key sets enabled = false (route handlers check it and return 503);
// an SDK load failure is logged and also leaves enabled = false. enabled is a getter so callers
// always read the live value.

'use strict';

let anthropic = null;
let enabled   = false;

(function initClient() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    console.warn('[anthropic] ANTHROPIC_API_KEY is not set — AI routes (graded-report, narrative) will return 503');
    return;
  }
  try {
    const Anthropic = require('@anthropic-ai/sdk');
    anthropic = new Anthropic({ apiKey: key });
    enabled   = true;
  } catch (err) {
    console.error('[anthropic] failed to initialise Anthropic SDK:', err.message);
  }
}());

/**
 * Call an async fn, retrying once on transient errors (5xx, ETIMEDOUT, ECONNRESET, /timeout/).
 * 4xx errors are not retried — they won't improve and the user should see them immediately.
 */
async function callWithRetry(fn, { retries = 1, delayMs = 1500 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const transient = err.status >= 500 || err.code === 'ETIMEDOUT' || err.code === 'ECONNRESET' || /timeout/i.test(err.message ?? '');
      if (!transient || attempt === retries) throw err;
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
}

module.exports = {
  callWithRetry,
  getClient() { return anthropic; },
  get enabled() { return enabled; },
};
