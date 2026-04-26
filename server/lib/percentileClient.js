const { ESPN_WEB, withCache, getTeams, getRoster, playerById } = require('./espnClient');
const { parseStatMap } = require('./statsParser');

const PERCENTILE_MIN_GP  = 10;
const PERCENTILE_MIN_MPG = 10;

const PERCENTILE_STATS = ['PTS', 'REB', 'AST', 'STL', 'BLK', 'FG_PCT', 'FG3_PCT', 'FT_PCT'];
// Lower is better — percentile inverts so 98th = fewest (v2 when TOV/PF added to PERCENTILE_STATS)
const INVERTED_STATS = new Set(['TOV', 'PF']);

const distributionCache = {};

// Normalize multi-position strings to primary: 'G/F' → 'G', 'F/C' → 'F'
function primaryPosition(pos) {
  if (!pos) return '';
  return pos.split('/')[0].trim().toUpperCase();
}

function extractSeasonAvg(data, targetYear) {
  if (!data?.categories) return null;
  const avgCat = data.categories.find(c => c.name === 'averages');
  if (!avgCat) return null;

  const entry = avgCat.statistics?.find(e => String(e.season?.year) === String(targetYear));
  if (!entry) return null;

  const m = parseStatMap(avgCat.names, entry.stats);
  const gp  = m.gamesPlayed ?? 0;
  const mpg = m.avgMinutes  ?? 0;
  if (gp < PERCENTILE_MIN_GP || mpg < PERCENTILE_MIN_MPG) return null;

  return {
    PTS:     m.avgPoints              ?? null,
    REB:     m.avgRebounds            ?? null,
    AST:     m.avgAssists             ?? null,
    STL:     m.avgSteals              ?? null,
    BLK:     m.avgBlocks              ?? null,
    FG_PCT:  m.fieldGoalPct           ?? null,
    FG3_PCT: m.threePointFieldGoalPct ?? null,
    FT_PCT:  m.freeThrowPct           ?? null,
  };
}

// Returns { G: { PTS: [...sorted], ... }, F: {...}, C: {...}, all: {...} }
// NOTE: built from current rosters — pre-2019 seasons may have incomplete pools.
async function buildLeagueDistribution(season) {
  const teams = await getTeams();
  await Promise.all(teams.map(t => getRoster(t.id, t.name)));

  const allEntries = await Promise.all(
    Object.keys(playerById).map(async id => {
      const pos = primaryPosition(playerById[id]?.position || '');
      try {
        const r = await fetch(`${ESPN_WEB}/athletes/${id}/stats?seasontype=2`);
        if (!r.ok) return null;
        const stats = extractSeasonAvg(await r.json(), season);
        return stats ? { pos, ...stats } : null;
      } catch {
        return null;
      }
    })
  );

  const qualified = allEntries.filter(Boolean);

  // Group by primary position, plus an 'all' fallback bucket
  const groups = { all: qualified };
  for (const entry of qualified) {
    if (entry.pos) {
      (groups[entry.pos] ??= []).push(entry);
    }
  }

  const distribution = {};
  for (const [grp, players] of Object.entries(groups)) {
    distribution[grp] = {};
    for (const stat of PERCENTILE_STATS) {
      distribution[grp][stat] = players
        .filter(p => p[stat] !== null && p[stat] !== undefined)
        .map(p => p[stat])
        .sort((a, b) => a - b);
    }
  }
  return distribution;
}

function computePercentile(sortedAsc, value, inverted) {
  if (!sortedAsc?.length || value === null || value === undefined) return null;
  const below = inverted
    ? sortedAsc.filter(v => v > value).length
    : sortedAsc.filter(v => v < value).length;
  return Math.round((below / sortedAsc.length) * 100);
}

// Returns { "2025": { PTS: 98, REB: 96, ... }, "2024": { ... }, ... }
async function getPlayerPercentiles(playerId) {
  const playerPos = primaryPosition(playerById[playerId]?.position || '');

  const r = await fetch(`${ESPN_WEB}/athletes/${playerId}/stats?seasontype=2`);
  if (!r.ok) return null;
  const data = await r.json();

  const avgCat = data?.categories?.find(c => c.name === 'averages');
  if (!avgCat?.statistics?.length) return null;

  const seasons = [...new Set(
    avgCat.statistics.map(e => String(e.season?.year)).filter(Boolean)
  )];
  if (!seasons.length) return null;

  const distributions = await Promise.all(
    seasons.map(season => withCache(distributionCache, season, () => buildLeagueDistribution(season)))
  );

  const result = {};
  seasons.forEach((season, i) => {
    const fullDist = distributions[i];
    if (!fullDist) return;

    // Position-specific distribution, fall back to full league if position unknown
    const dist = fullDist[playerPos] ?? fullDist['all'];
    if (!dist) return;

    const entry = avgCat.statistics.find(e => String(e.season?.year) === season);
    if (!entry) return;

    const m   = parseStatMap(avgCat.names, entry.stats);
    const gp  = m.gamesPlayed ?? 0;
    const mpg = m.avgMinutes  ?? 0;
    if (gp < PERCENTILE_MIN_GP || mpg < PERCENTILE_MIN_MPG) return;

    const playerStats = {
      PTS: m.avgPoints, REB: m.avgRebounds, AST: m.avgAssists,
      STL: m.avgSteals, BLK: m.avgBlocks,
      FG_PCT: m.fieldGoalPct, FG3_PCT: m.threePointFieldGoalPct, FT_PCT: m.freeThrowPct,
    };

    result[season] = {};
    for (const stat of PERCENTILE_STATS) {
      result[season][stat] = computePercentile(dist[stat], playerStats[stat], INVERTED_STATS.has(stat));
    }
  });

  return Object.keys(result).length ? result : null;
}

module.exports = { getPlayerPercentiles, PERCENTILE_STATS };
