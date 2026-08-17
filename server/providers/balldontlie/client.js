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

const MAX_RETRIES = 3;
const RETRY_BASE_MS = 400;

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

// Raw fetch — no cache wrapper. Returns null on a non-2xx response or network/parse error
// (transient, not cacheable), matching espn/client.js's fetchTeamStatsRaw-style contract.
// `params` with an array value (e.g. `{'team_ids[]': [8]}`) is BDL's bracketed-array query
// convention — callers pass the bracketed key name directly since BDL's param names vary
// (some endpoints use `team_ids[]`, others `team_id`).
//
// Retries a 429 with backoff (honoring Retry-After when BDL sends one) -- confirmed via live
// shadow-compare testing that a burst of concurrent per-game requests (e.g. computing Win Shares
// for a whole career at once) can get rate-limited mid-fetch. Before this, a 429 was silently
// swallowed identically to any other failure -- getGamePbpStatsBdl would just report fetched:false
// for that one game with no trace of why, silently undercounting on-court stats for a live
// (uncached) request. Every failure path now warns so this is diagnosable instead of invisible.
async function bdlFetch(path, params) {
  const key = process.env.BALLDONTLIE_KEY;
  if (!key) return null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(`${BDL}${path}${buildQuery(params)}`, {
        headers: { Authorization: key },
      });
      if (res.ok) return await res.json();

      if (res.status === 429 && attempt < MAX_RETRIES) {
        const retryAfterSec = Number(res.headers.get('retry-after'));
        const delay = Number.isFinite(retryAfterSec) && retryAfterSec > 0
          ? retryAfterSec * 1000
          : RETRY_BASE_MS * 2 ** attempt;
        await sleep(delay);
        continue;
      }

      console.warn(`[balldontlie] ${path} -> ${res.status}${attempt > 0 ? ` (after ${attempt} retr${attempt === 1 ? 'y' : 'ies'})` : ''}`);
      return null;
    } catch (err) {
      console.warn(`[balldontlie] ${path} -> ${err.message}`);
      return null;
    }
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
};
