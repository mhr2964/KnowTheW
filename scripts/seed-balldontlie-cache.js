// One-off/re-runnable warm pass for the BallDontLie-backed advanced-stats cache. Mirrors
// scripts/seed-fingerprints.js's shape: connect to the real MongoDB, walk the active player pool at
// bounded concurrency, populate the same Mongo cache entries a live request would.
//
// Why this exists: computeAdvancedPbpAll() walks a player's ENTIRE career in one call, and BDL needs
// ~3 HTTP round trips per game vs ESPN's ~1 -- a long career's first-ever (cold) computation can
// exceed Heroku's 30s router timeout even though the backend keeps running and eventually caches the
// result anyway (confirmed live: 2026-08-17, see the plan file's "Root-cause follow-up" section).
// Running this once before flipping STATS_PROVIDER=balldontlie in production means real users never
// hit that cold path for anyone currently on an active roster.
//
// Known, accepted gap: retired/historical players who were never on an active roster aren't covered
// here, so their first-ever view could still risk the same cold-start timeout. Not fixed by this
// script -- see the plan file for why that's an intentionally deferred gap, not an oversight.
//
// Idempotent: computeAdvancedPbpAll() itself checks the cache first (by gp+version), so re-running
// this after new games have been played only recomputes what's actually stale.
require('dotenv').config();

// Must be set before any provider-layer module is first required -- getProvider() memoizes per
// process, and the whole point of this script is to warm the BDL-keyed cache entries specifically,
// not whatever STATS_PROVIDER happens to be set to in the local .env.
process.env.STATS_PROVIDER = 'balldontlie';

const { whenConnected } = require('../server/db');
const { getProvider } = require('../server/providers');
const { computeAdvancedPbpAll } = require('../server/lib/advancedStats');
const { mapWithConcurrency } = require('../server/lib/concurrency');

// Each player's own internal fan-out is already ~3 requests/game across every BDL-era season in
// their career -- stacking many players on top of that is the wrong place to add parallelism.
// bdlFetch's 429 retry-with-backoff is the safety net if this estimate turns out to be too high.
const BDL_WARM_CONCURRENCY = 2;

// getActivePlayers() reads espn/client.js's startup prefetch cache, which populates asynchronously
// on require with no exported readiness signal -- poll instead of guessing a fixed delay.
async function waitForActivePlayers(timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const players = getProvider().getActivePlayers();
    if (players?.length) return players;
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('timed out waiting for the active-player prefetch to populate');
}

(async () => {
  console.log('Waiting for MongoDB...');
  const db = await whenConnected();
  if (!db) {
    console.log('No MongoDB URI — nothing to warm against, exiting');
    process.exit(0);
  }

  console.log('Waiting for the active-player roster to load...');
  const players = await waitForActivePlayers();
  console.log(`Warming ${players.length} active players' BallDontLie advanced-stats cache (concurrency ${BDL_WARM_CONCURRENCY})...`);

  // A non-null result isn't proof of a real warm -- computeAdvancedPbpAll can legitimately return a
  // shape with empty pbpGamesBySeason (e.g. this call happened to be the one systemic-failure guard
  // trips on, so it wasn't cached but still returns a value for this one call). Logging "OK" for
  // that was the single biggest reason a dead API key went undiagnosed for hours on 2026-08-17 --
  // count and report real-vs-empty explicitly instead of trusting truthiness alone.
  let real = 0, empty = 0, skipped = 0, failed = 0;
  const started = Date.now();
  await mapWithConcurrency(players, BDL_WARM_CONCURRENCY, async (p) => {
    try {
      const result = await computeAdvancedPbpAll(p.id);
      if (!result) {
        skipped++;
        console.log(`[warm] ${p.name} (${p.id}) skipped — no stats`);
      } else if (Object.keys(result.pbpGamesBySeason ?? {}).length > 0) {
        real++;
        console.log(`[warm] ${p.name} (${p.id}) OK — ${Object.keys(result.pbpGamesBySeason).length} season(s) of real data`);
      } else {
        empty++;
        console.warn(`[warm] ${p.name} (${p.id}) EMPTY — had seasons to compute but got nothing back; not cached, will retry next run`);
      }
    } catch (err) {
      failed++;
      console.warn(`[warm] ${p.name} (${p.id}) failed:`, err.message);
    }
  });

  const elapsedMin = ((Date.now() - started) / 60000).toFixed(1);
  console.log(`Done in ${elapsedMin}m — ${real} warmed with real data, ${empty} came back empty (not cached, safe to re-run), ${failed} failed, ${skipped} skipped (no stats).`);
  if (empty > players.length * 0.2) {
    console.warn(`WARNING: ${empty} of ${players.length} players came back empty -- this usually means something systemic is wrong (bad API key, provider down), not that this many players individually lack data. Check BALLDONTLIE_KEY before re-running.`);
  }
  process.exit(0);
})();
