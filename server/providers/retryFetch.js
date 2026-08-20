// Shared retry/backoff for transient upstream failures, extracted from BallDontLie's client
// (server/providers/balldontlie/client.js's bdlFetch), which already had this — ESPN's client had
// none, every fetch was a single bare attempt with no handling of a transient 429/5xx or a dropped
// connection. This exists so ESPN gets the same resilience via fetchWithRetry below.
//
// Deliberately does NOT include BDL's sliding-window rate limiter (acquireRateSlot in
// balldontlie/client.js) or its retry-on-401 defensive case — both are BDL-specific: the rate
// limiter paces against BDL's real account-level requests/minute quota (nothing ESPN has), and the
// 401 retry was added for a specific BDL incident (see balldontlie/client.js's header comment).
// bdlFetch keeps its own specialized loop; it only imports the constants below so the retry timing
// isn't duplicated as a second set of magic numbers.

const MAX_RETRIES = 6;
const RETRY_BASE_MS = 400;

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

// Retries a 429 or 5xx response, or a network-level fetch failure, with exponential backoff,
// honoring Retry-After when the upstream sends one. Returns the Response object on success or on
// final exhausted attempt (mirrors a plain fetch()'s contract — callers keep their own res.ok
// check); rethrows the last network error if every attempt failed to even get a response.
async function fetchWithRetry(url, options) {
  let lastErr;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let res;
    try {
      res = await fetch(url, options);
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_RETRIES) { await sleep(RETRY_BASE_MS * 2 ** attempt); continue; }
      throw err;
    }
    if (res.ok || (res.status !== 429 && res.status < 500)) return res;
    if (attempt < MAX_RETRIES) {
      const retryAfterSec = Number(res.headers.get('retry-after'));
      const delay = Number.isFinite(retryAfterSec) && retryAfterSec > 0
        ? retryAfterSec * 1000
        : RETRY_BASE_MS * 2 ** attempt;
      await sleep(delay);
      continue;
    }
    return res;
  }
  throw lastErr;
}

module.exports = { fetchWithRetry, MAX_RETRIES, RETRY_BASE_MS, sleep };
