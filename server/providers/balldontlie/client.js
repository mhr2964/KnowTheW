// BallDontLie provider's low-level HTTP layer: base URL, auth, fetch+cache helpers. Mirrors
// server/providers/espn/client.js's shape so the two provider modules stay easy to compare, but
// this one has no startup prefetch — the hybrid facade (./index.js) delegates teams/rosters/active
// players to the ESPN module, whose own prefetch already warms that pool.
//
// Confirmed API host: api.balldontlie.io/wnba/v1 (NOT wnba.balldontlie.io, which is a docs page).
// Auth: `Authorization: <raw key>` header, no "Bearer" prefix.
// BALLDONTLIE_KEY is read lazily (inside bdlFetch), not at module load, so requiring this module
// never throws even if the env var isn't set yet in a given process.

const { withCache, withTtlCache } = require('../espn/client');

const BDL = 'https://api.balldontlie.io/wnba/v1';

// season >= this uses BallDontLie; earlier seasons delegate to ESPN (BDL has no WNBA data before
// ~2008, confirmed by spike; this site's own league-average table goes back to 1998).
const BDL_MIN_SEASON = 2008;

function buildQuery(params) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      for (const v of value) qs.append(key, v);
    } else {
      qs.set(key, value);
    }
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

const MAX_RETRIES = 6;
const RETRY_BASE_MS = 400;

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

// Global rate limiter (sliding window) on outbound BDL requests, across every caller in this
// process. Nothing upstream of bdlFetch bounds request RATE -- a single long career's
// computeAdvancedPbpAll fires every season in parallel, and within each season every game in
// parallel, each game issuing ~3 requests -- an 8-season career can generate 500-1000+ requests with
// nothing pacing them. Confirmed live (2026-08-17), in order:
//   1. A concurrency-only cap (20 simultaneous in-flight requests) did NOT fix sustained 401s on
//      /players under a real multi-player warm run, even though synthetic bursts of dozens of
//      concurrent requests (including 25 concurrent /players calls) never reproduced a single
//      failure. Concurrency alone was the wrong lever.
//   2. Direct response-body diagnostics on a real 4-player concurrent warm showed the real signal:
//      /player_stats, /plays, and /team_stats all hit genuine 429s that even 3 retries with backoff
//      couldn't ride out -- confirming this is REQUEST RATE (requests/minute) exhausting the
//      account's real quota (GOAT tier: 600 req/min per the docs), not a burst/concurrency ceiling.
//      20 fast-completing concurrent requests can easily exceed 600/min on their own; capping
//      concurrency doesn't cap throughput.
// Paced to ~500/min (under the 600/min ceiling, leaving margin for other concurrent traffic e.g.
// live user requests sharing the same key) via a sliding 60s window -- a new request waits until an
// old one ages out of the window rather than being capped by how many are simultaneously in flight.
let rateLimitPerWindow = 500;
let rateWindowMs = 60000;
const requestTimestamps = [];

async function acquireRateSlot() {
  for (;;) {
    const now = Date.now();
    while (requestTimestamps.length && now - requestTimestamps[0] > rateWindowMs) requestTimestamps.shift();
    if (requestTimestamps.length < rateLimitPerWindow) {
      requestTimestamps.push(now);
      return;
    }
    await sleep(rateWindowMs - (now - requestTimestamps[0]) + 10);
  }
}

// Test-only: shrink the window so rate-limiting behavior is observable without a real 60s wait.
function _setRateLimitForTest(limit, windowMs) {
  rateLimitPerWindow = limit;
  rateWindowMs = windowMs;
  requestTimestamps.length = 0;
}
function _resetRateLimitForTest() {
  rateLimitPerWindow = 500;
  rateWindowMs = 60000;
  requestTimestamps.length = 0;
}

// Raw fetch — no cache wrapper. Returns null on a non-2xx response or network/parse error
// (transient, not cacheable), matching espn/client.js's fetchTeamStatsRaw-style contract.
// `params` with an array value (e.g. `{'team_ids[]': [8]}`) is BDL's bracketed-array query
// convention — callers pass the bracketed key name directly since BDL's param names vary
// (some endpoints use `team_ids[]`, others `team_id`).
//
// Retries a 429 (and, empirically, 401 -- see below) with backoff, honoring Retry-After when BDL
// sends one. Before any of this, a failure was silently swallowed identically regardless of cause --
// getGamePbpStatsBdl would just report fetched:false with no trace of why. Every failure path now
// warns so this is diagnosable instead of invisible. acquireRateSlot() paces the request itself;
// retries re-acquire a slot too, so a retried request still counts against the same window.
//
// 401 is retried alongside 429 as a defensive measure for a genuine transient auth blip (some APIs
// briefly 401 during their own internal token/session churn). It was NOT the fix for the /players
// mystery chased at length on 2026-08-17: sustained 401s on that one endpoint under a real
// multi-player warm run survived even 6 retries with backoff, while every isolated reproduction
// (sequential, 6- and 25-way concurrent, an 80-request mixed-endpoint burst) succeeded cleanly. The
// real cause turned out to be mundane -- the local .env's BALLDONTLIE_KEY was a dead/stale key
// (401s on literally every endpoint, confirmed directly), while every manual repro in this
// investigation happened to hardcode the real working key instead of loading it from .env. Fixed by
// correcting .env; retrying 401 here costs nothing on a real dead-key case (it was already going to
// fail) and may help on an actual transient blip, so it stays as a cheap defensive measure.
async function bdlFetch(path, params) {
  const key = process.env.BALLDONTLIE_KEY;
  if (!key) return null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    await acquireRateSlot();
    let res;
    try {
      res = await fetch(`${BDL}${path}${buildQuery(params)}`, {
        headers: { Authorization: key },
      });
    } catch (err) {
      console.warn(`[balldontlie] ${path} -> ${err.message}`);
      return null;
    }

    if (res.ok) return await res.json();

    if ((res.status === 429 || res.status === 401) && attempt < MAX_RETRIES) {
      const retryAfterSec = Number(res.headers.get('retry-after'));
      const delay = Number.isFinite(retryAfterSec) && retryAfterSec > 0
        ? retryAfterSec * 1000
        : RETRY_BASE_MS * 2 ** attempt;
      await sleep(delay);
      continue;
    }

    console.warn(`[balldontlie] ${path} -> ${res.status}${attempt > 0 ? ` (after ${attempt} retr${attempt === 1 ? 'y' : 'ies'})` : ''}`);
    return null;
  }
  return null;
}

// Own in-process cache objects — separate from ESPN's, so no in-process key collision is even
// possible (the collision risk this codebase actually has is Mongo-only, see teamSeasonCache.js
// call sites, fixed by provider-prefixing those keys).
const bdlTeamSeasonStatsCache = {};
const bdlTeamPtsAllowedCache  = {};
const bdlTeamsCache           = {};

module.exports = {
  BDL, BDL_MIN_SEASON,
  bdlFetch, withCache, withTtlCache,
  bdlTeamSeasonStatsCache, bdlTeamPtsAllowedCache, bdlTeamsCache,
  _setRateLimitForTest, _resetRateLimitForTest,
};
