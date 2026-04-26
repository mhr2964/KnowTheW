const { ESPN_WEB, playerById } = require('./espnClient');
const { parseStatMap } = require('./statsParser');

const ESPN_CORE = 'https://sports.core.api.espn.com/v2/sports/basketball/leagues/wnba';

const PERCENTILE_MIN_GP  = 10;
const PERCENTILE_MIN_MPG = 10;

const PERCENTILE_STATS = ['PTS', 'REB', 'AST', 'STL', 'BLK', 'FG_PCT', 'FG3_PCT', 'FT_PCT', 'TOV', 'PF', 'OREB', 'DREB'];
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
    TOV:     m.avgTurnovers           ?? null,
    PF:      m.avgFouls               ?? null,
    OREB:    m.avgOffensiveRebounds   ?? null,
    DREB:    m.avgDefensiveRebounds   ?? null,
  };
}

// Returns all athlete IDs who appear in ESPN's records for a given season.
// Retired players are included because this queries the Core API season roster,
// not the current team roster endpoint (which ignores ?season= for WNBA).
async function fetchSeasonPlayerIds(season) {
  const res = await fetch(`${ESPN_CORE}/seasons/${season}/athletes?limit=1000`);
  if (!res.ok) return null;
  const data = await res.json();
  return (data.items || [])
    .map(item => {
      const m = item.$ref?.match(/\/athletes\/(\d+)/);
      return m ? m[1] : null;
    })
    .filter(Boolean);
}

// Returns { G: { PTS: [...sorted], ... }, F: {...}, C: {...}, all: {...} }
// Uses ESPN Core API season athlete list so retired players are included.
async function buildLeagueDistribution(season) {
  const playerIds = await fetchSeasonPlayerIds(season);
  console.log(`[perc] season ${season}: ${playerIds === null ? 'null' : playerIds.length} athlete IDs`);
  if (!playerIds?.length) return null;

  const allEntries = await Promise.all(
    playerIds.map(async id => {
      // Current players have a known position; retired players fall into 'all'
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
  console.log(`[perc] season ${season}: ${qualified.length} qualified players`);

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

  const result = {};
  for (const season of seasons) {
    // Build sequentially to avoid ESPN rate-limiting from simultaneous distribution builds.
    // Only cache successful results so transient failures can be retried.
    if (!distributionCache[season]) {
      const dist = await buildLeagueDistribution(season);
      if (dist) distributionCache[season] = dist;
    }
    const fullDist = distributionCache[season];
    if (!fullDist) continue;

    const dist = fullDist[playerPos] ?? fullDist['all'];
    if (!dist) continue;
    console.log(`[perc] player ${playerId} season ${season}: pool=${fullDist.all?.PTS?.length ?? 0} (pos ${playerPos}: ${dist?.PTS?.length ?? 0})`);

    const playerStats = extractSeasonAvg(data, season);
    if (!playerStats) { console.log(`[perc] player ${playerId} season ${season}: no qualifying stats`); continue; }

    result[season] = {};
    for (const stat of PERCENTILE_STATS) {
      result[season][stat] = computePercentile(dist[stat], playerStats[stat], INVERTED_STATS.has(stat));
    }
  }

  return Object.keys(result).length ? result : null;
}

module.exports = { getPlayerPercentiles, PERCENTILE_STATS };
