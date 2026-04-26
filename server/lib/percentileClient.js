const { ESPN_WEB } = require('./espnClient');
const { parseStatMap } = require('./statsParser');

const ESPN_CORE = 'https://sports.core.api.espn.com/v2/sports/basketball/leagues/wnba';

const PERCENTILE_MIN_GP  = 10;
const PERCENTILE_MIN_MPG = 10;

const PERCENTILE_STATS = ['PTS', 'REB', 'AST', 'STL', 'BLK', 'FG_PCT', 'FG3_PCT', 'FT_PCT', 'TOV', 'PF', 'OREB', 'DREB'];
const INVERTED_STATS = new Set(['TOV', 'PF']);

const distributionCache = {};

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

// Returns { PTS: [...sorted], REB: [...sorted], ... } for the full league that season.
async function buildLeagueDistribution(season) {
  const playerIds = await fetchSeasonPlayerIds(season);
  console.log(`[perc] season ${season}: ${playerIds === null ? 'null' : playerIds.length} athlete IDs`);
  if (!playerIds?.length) return null;

  const allEntries = await Promise.all(
    playerIds.map(async id => {
      try {
        const r = await fetch(`${ESPN_WEB}/athletes/${id}/stats?seasontype=2`);
        if (!r.ok) return null;
        const stats = extractSeasonAvg(await r.json(), season);
        return stats ?? null;
      } catch {
        return null;
      }
    })
  );

  const qualified = allEntries.filter(Boolean);
  console.log(`[perc] season ${season}: ${qualified.length} qualified players`);

  const distribution = {};
  for (const stat of PERCENTILE_STATS) {
    distribution[stat] = qualified
      .filter(p => p[stat] !== null && p[stat] !== undefined)
      .map(p => p[stat])
      .sort((a, b) => a - b);
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
    if (!distributionCache[season]) {
      const dist = await buildLeagueDistribution(season);
      if (dist) distributionCache[season] = dist;
    }
    const dist = distributionCache[season];
    if (!dist) { console.log(`[perc] player ${playerId} season ${season}: no distribution`); continue; }

    const playerStats = extractSeasonAvg(data, season);
    if (!playerStats) { console.log(`[perc] player ${playerId} season ${season}: no qualifying stats`); continue; }

    console.log(`[perc] player ${playerId} season ${season}: pool=${dist.PTS?.length ?? 0}`);
    result[season] = {};
    for (const stat of PERCENTILE_STATS) {
      result[season][stat] = computePercentile(dist[stat], playerStats[stat], INVERTED_STATS.has(stat));
    }
  }

  return Object.keys(result).length ? result : null;
}

module.exports = { getPlayerPercentiles, PERCENTILE_STATS };
