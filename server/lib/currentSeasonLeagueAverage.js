// Live-computed league-average stats for the in-progress WNBA season -- the one season WNBA_LG
// (server/constants/leagueAverages.js) can never have a permanent entry for, since it's still being
// played. Every other WNBA_LG entry is a one-time snapshot of a season that's already over.
//
// Computed by averaging every real team's getProvider().getTeamStats() across the league (same
// provider-agnostic contract every other consumer uses -- this is not BDL- or ESPN-specific code),
// cached in-process with a multi-hour TTL. See leagueAverages.js's getLeagueAverage() for the
// synchronous accessor that reads this cache without forcing every caller to become async.

const { getProvider } = require('../providers');
const { withTtlCache } = require('../providers/cache');
const { mapWithConcurrency } = require('./concurrency');
const { isPastSeason } = require('./seasonWindow');

const TTL_MS = 4 * 60 * 60 * 1000; // 4h -- a live season's average doesn't need per-request freshness
const MIN_TEAMS_FOR_REAL_AVERAGE = 8; // below this (e.g. very early preseason), prefer null over a noisy average
const TEAM_STATS_CONCURRENCY = 6;

const cache = {};

// The normalized TeamStats contract (server/providers/schemas.js, what getProvider().getTeamStats()
// actually returns for EITHER provider) carries fgaPg/fgmPg/fgPct/fg3mPg/fg3Pct/ftaPg/ftmPg/ftPct/
// ptsPg/orbPg/drbPg/tovPg/astPg -- no fg3a, no trb, and critically no stl/blk/pf at all. (BDL's own
// *raw* /team_season_stats response does carry fg3a/reb/stl/blk, confirmed live -- but this module
// deliberately goes through the shared provider-agnostic contract, not BDL's raw shape, so it works
// under ESPN too and doesn't create a second, parallel team-stats fetch path.)
//
// fg3a and trb are safe to derive (fg3a from fg3m/fg3Pct per team; trb = orb+drb) since the inputs
// ARE real per-team per-game averages. stl, blk, and pf have no live source at all through this
// contract for either provider, and building one (summing every team's every game just to backfill
// 3 season-aggregate fields) isn't worth it -- these three years-over-year barely move for the WNBA
// (team fouls/game has sat in a ~17.2-17.9 band every season since 2020, and stl/blk are similarly
// stable). All three carry forward from the most recent COMPLETED season's real WNBA_LG entry.
function averageTeamStats(rows, previous) {
  const n = rows.length;
  const sum = (key) => rows.reduce((s, r) => s + (r[key] ?? 0), 0);

  const fgmPg = sum('fgmPg') / n;
  const fgaPg = sum('fgaPg') / n;
  const fg3mPg = sum('fg3mPg') / n;
  const ftmPg = sum('ftmPg') / n;
  const ftaPg = sum('ftaPg') / n;
  const orbPg = sum('orbPg') / n;
  const drbPg = sum('drbPg') / n;
  const astPg = sum('astPg') / n;
  const tovPg = sum('tovPg') / n;
  const ptsPg = sum('ptsPg') / n;

  // fg3a derived from fg3m / fg3Pct per team, then averaged -- more accurate than deriving from the
  // already-averaged fg3mPg/fg3Pct, since fg3Pct varies team to team.
  const fg3aPerTeam = rows.map(r => (r.fg3Pct > 0 ? r.fg3mPg / (r.fg3Pct / 100) : 0));
  const fg3a = fg3aPerTeam.reduce((s, v) => s + v, 0) / n;

  return {
    pts: ptsPg, fgm: fgmPg, fga: fgaPg, fg3m: fg3mPg, fg3a,
    ftm: ftmPg, fta: ftaPg, orb: orbPg, drb: drbPg, trb: orbPg + drbPg,
    ast: astPg, tov: tovPg,
    stl: previous?.stl ?? null, blk: previous?.blk ?? null, pf: previous?.pf ?? null,
  };
}

async function computeLiveLeagueAverageUncached(year) {
  const teams = await getProvider().getTeams();
  if (!teams?.length) return null;

  const rows = await mapWithConcurrency(teams, TEAM_STATS_CONCURRENCY, async (t) => {
    try {
      const stats = await getProvider().getTeamStats(t.id, year);
      return stats && !stats.noData && !stats.empty ? stats : null;
    } catch {
      return null;
    }
  });
  const realRows = rows.filter(Boolean);
  if (realRows.length < MIN_TEAMS_FOR_REAL_AVERAGE) return null;

  const previous = require('../constants/leagueAverages').WNBA_LG[String(Number(year) - 1)] ?? null;
  return averageTeamStats(realRows, previous);
}

async function getCurrentSeasonLeagueAverage(year) {
  return withTtlCache(cache, String(year), TTL_MS, () => computeLiveLeagueAverageUncached(year));
}

// Synchronous read of whatever's already in the TTL cache -- never triggers a fetch. Returns null
// if the cache hasn't been populated yet (cold start before the first refresh completes) or the
// year isn't the current season at all.
function peekCurrentSeasonLeagueAverage(year) {
  if (isPastSeason(year)) return null;
  return cache[String(year)]?.value ?? null;
}

// Kicks off the first live compute + a periodic refresh so the synchronous accessor almost always
// has a real value by the time real traffic arrives. Mirrors espn/client.js's own startup-prefetch
// guard exactly -- skipped under NODE_ENV=test so the test harness never hits the network on import.
function startRefreshLoop(year = new Date().getFullYear()) {
  getCurrentSeasonLeagueAverage(year).catch(err => console.error('currentSeasonLeagueAverage startup refresh failed:', err.message));
  setInterval(() => {
    getCurrentSeasonLeagueAverage(new Date().getFullYear()).catch(err => console.error('currentSeasonLeagueAverage refresh failed:', err.message));
  }, TTL_MS).unref();
}

if (process.env.NODE_ENV !== 'test') {
  startRefreshLoop();
}

module.exports = {
  getCurrentSeasonLeagueAverage, peekCurrentSeasonLeagueAverage,
  // exported for unit tests:
  averageTeamStats, computeLiveLeagueAverageUncached, MIN_TEAMS_FOR_REAL_AVERAGE,
  _resetCacheForTest: () => { for (const k of Object.keys(cache)) delete cache[k]; },
};
