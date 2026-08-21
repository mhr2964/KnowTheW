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
// traffic past BDL's real account-wide 600/min ceiling. Default here (80/min) leaves real headroom.
// Override via BDL_RATE_LIMIT_PER_MIN=<n> node scripts/warm-pbp-cache.js for a faster/slower run.
//
// Safe to interrupt and re-run: already-cached (player, season) pairs re-check the Mongo cache in
// milliseconds and move on, so a re-run only does new work, not a full re-fetch. No checkpoint file
// needed for that reason.

process.env.BDL_RATE_LIMIT_PER_MIN = process.env.BDL_RATE_LIMIT_PER_MIN || '200';

require('dotenv').config();
const { whenConnected } = require('../server/db');
const { getProvider } = require('../server/providers');
const { isPastSeason } = require('../server/lib/seasonWindow');

// A real hang here (a promise that never settles -- not just a rejection, which .catch() already
// handles) would stall the ENTIRE run on one player forever, with no live HTTP request or Heroku
// router to time it out the way routes/playerAnalysis.js's withSeasonTimeout does. This wraps every
// provider call in a hard per-call budget so one bad player/season can only ever cost this much
// time, never the whole run. Calibrated to the throttle above, not copied from the 20s live-route
// budget: a full season can need ~120 BDL requests (see gamePbpCache.js's header comment), which at
// this script's own BDL_RATE_LIMIT_PER_MIN takes real time to clear even when nothing's wrong --
// confirmed live: a 30s budget at an earlier, more conservative 80/min throttle caused every
// multi-season real player to falsely "time out" well before finishing, not because anything hung.
const CALL_TIMEOUT_MS = 60000;
function withTimeout(promise, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`timed out after ${CALL_TIMEOUT_MS}ms: ${label}`)), CALL_TIMEOUT_MS)),
  ]);
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
