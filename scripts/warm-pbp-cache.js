// One-time (then periodic) backfill: pre-warm the per-game PBP cache (gamePbpRaw, see
// server/providers/gamePbpCache.js) for every indexed player's past seasons, so no real visitor is
// ever the "first" one to pay a cold BDL/ESPN fetch for a game that's been over for months or years.
// Mirrors scripts/seed-distributions.js's own pre-warm-via-offline-script pattern, applied to PBP
// data instead of percentile distributions.
//
// NOT wired into the Heroku release phase (unlike seed-distributions.js) -- a full run touches far
// more data (every past season's games, not just league-wide per-season aggregates) and would make
// every future deploy's release phase take hours instead of ~10 minutes. Run this manually/on a
// schedule instead.
//
// Self-throttled well below the live web dyno's own ~500/min BDL pace (see client.js's
// BDL_RATE_LIMIT_PER_MIN) -- this is a SEPARATE process with its own independent rate-limiter
// instance, so running it at the same 500/min the web dyno already uses would risk pushing combined
// traffic past BDL's real account-wide 600/min ceiling. Default here (100/min) leaves real headroom.
// Override via BDL_RATE_LIMIT_PER_MIN=<n> node scripts/warm-pbp-cache.js for a faster/slower run.
//
// Safe to interrupt and re-run: already-cached (player, season) pairs re-check the Mongo cache in
// milliseconds and move on, so a re-run only does new work, not a full re-fetch. No checkpoint file
// needed for that reason.
//
// STORAGE SAFETY VALVE: the first real run of this script filled the ENTIRE 512MB free-tier Mongo
// quota after only 59 of 459 players and broke live writes site-wide (security-relevant unique
// indexes failed to (re)create; see the incident writeup in this repo's session history). Fixed the
// immediate cause (plays.js's trimPlay/trimTeamStatsRow, ~57% smaller per game now) but a per-doc
// size estimate is exactly the kind of number that's wrong until it isn't -- this checks real usage
// periodically and stops cleanly well before the quota, rather than trusting the estimate again.

process.env.BDL_RATE_LIMIT_PER_MIN = process.env.BDL_RATE_LIMIT_PER_MIN || '100';

require('dotenv').config();
const { whenConnected } = require('../server/db');
const { getProvider } = require('../server/providers');
const { isPastSeason } = require('../server/lib/seasonWindow');

// A real hang here (a promise that never settles -- not just a rejection, which .catch() already
// handles) would stall the ENTIRE run on one player forever, with no live HTTP request or Heroku
// router to time it out the way routes/playerAnalysis.js's withSeasonTimeout does. This wraps every
// provider call in a hard per-call budget so one bad player/season can only ever cost this much
// time, never the whole run. Calibrated generously, not copied from the 20s live-route budget:
// confirmed live that a genuinely-rate-limited BDL request can carry a real `Retry-After: 60` header
// (retryFetch.js/client.js honor it literally, not the ~25s pure-exponential-backoff ceiling that
// applies without one) -- a season hitting that isn't stuck, it's correctly waiting out BDL's own
// instructed cooldown. 75s leaves real margin above a single 60s Retry-After wait plus request
// overhead, so this only ever fires on an actual hang, not a season that's about to legitimately
// succeed.
const CALL_TIMEOUT_MS = 75000;
function withTimeout(promise, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`timed out after ${CALL_TIMEOUT_MS}ms: ${label}`)), CALL_TIMEOUT_MS)),
  ]);
}

// Well under whatever the real quota is (512MB on the current free tier) -- this is a hard stop,
// not a warning, so it protects against the tier changing or another collection growing too.
const STORAGE_LIMIT_MB = 400;
async function isOverStorageBudget(db) {
  const stats = await db.stats().catch(() => null);
  if (!stats) return false; // can't check -- fail open rather than block on a transient stats error
  const usedMB = stats.dataSize / 1024 / 1024;
  if (usedMB > STORAGE_LIMIT_MB) {
    console.warn(`STORAGE SAFETY VALVE: ${usedMB.toFixed(0)}MB used, over the ${STORAGE_LIMIT_MB}MB budget. Stopping.`);
    return true;
  }
  return false;
}

async function warmOnePlayer(playerId, name) {
  const { regSeasons, postSeasons } = await withTimeout(getProvider().getPlayerSeasonStats(playerId), `${name} season list`);
  const pastRegSeasons  = (regSeasons  ?? []).map(r => r.year).filter(y => isPastSeason(y));
  const pastPostSeasons = (postSeasons ?? []).map(r => r.year).filter(y => isPastSeason(y));
  const seasons = [...new Set([...pastRegSeasons, ...pastPostSeasons])];

  let gamesWarmed = 0;
  for (const season of seasons) {
    if (pastRegSeasons.includes(season)) {
      const reg = await withTimeout(getProvider().getSeasonPBPSummary(playerId, season, 2), `${name} ${season} reg`).catch(() => null);
      if (reg) gamesWarmed += reg.pbpGames;
    }
    if (pastPostSeasons.includes(season)) {
      const post = await withTimeout(getProvider().getSeasonPBPSummary(playerId, season, 3), `${name} ${season} post`).catch(() => null);
      if (post) gamesWarmed += post.pbpGames;
    }
  }
  return { seasons: seasons.length, gamesWarmed };
}

(async () => {
  console.log(`Rate limit: ${process.env.BDL_RATE_LIMIT_PER_MIN}/min`);
  console.log('Waiting for MongoDB...');
  const db = await whenConnected();
  if (!db) {
    console.log('No MongoDB URI -- nothing to warm into, exiting.');
    process.exit(0);
  }

  const players = await db.collection('playerIndex').find({}).toArray();
  console.log(`Warming PBP cache for ${players.length} indexed players...`);

  const startedAt = Date.now();
  let totalGames = 0, totalSeasons = 0, failures = 0;

  for (let i = 0; i < players.length; i++) {
    if (i % 5 === 0 && await isOverStorageBudget(db)) break;

    const p = players[i];
    try {
      const { seasons, gamesWarmed } = await warmOnePlayer(p.id, p.name);
      totalSeasons += seasons;
      totalGames += gamesWarmed;
      const elapsedMin = (Date.now() - startedAt) / 60000;
      console.log(
        `[${i + 1}/${players.length}] ${p.name}: ${seasons} season(s), ${gamesWarmed} games warmed ` +
        `(running total: ${totalGames} games, ${elapsedMin.toFixed(1)}min elapsed)`
      );
    } catch (err) {
      failures++;
      console.warn(`[${i + 1}/${players.length}] ${p.name}: FAILED -- ${err.message}`);
    }
  }

  const totalMin = (Date.now() - startedAt) / 60000;
  console.log(`Done. ${players.length} players, ${totalSeasons} player-seasons, ${totalGames} games ` +
    `warmed, ${failures} failures, ${totalMin.toFixed(1)} minutes total.`);
  process.exit(0);
})();
