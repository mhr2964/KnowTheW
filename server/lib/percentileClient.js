const { ESPN_WEB, withCache, getTeams, fetchHistoricalRoster, playerById } = require('./espnClient');
const { parseStatMap } = require('./statsParser');

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

// Returns { G: { PTS: [...sorted], ... }, F: {...}, C: {...}, all: {...} }
// Uses historical rosters for the given season so retired players are included.
async function buildLeagueDistribution(season) {
  const teams = await getTeams();

  const rosterArrays = await Promise.all(
    teams.map(t => fetchHistoricalRoster(t.id, season))
  );

  // Deduplicate players (mid-season trades can put a player on two rosters)
  const playerMap = new Map();
  for (const roster of rosterArrays) {
    for (const p of roster) {
      if (!playerMap.has(p.id)) playerMap.set(p.id, p);
    }
  }

  const allEntries = await Promise.all(
    [...playerMap.values()].map(async ({ id, position }) => {
      const pos = primaryPosition(position);
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

    const dist = fullDist[playerPos] ?? fullDist['all'];
    if (!dist) return;

    const playerStats = extractSeasonAvg(data, season);
    if (!playerStats) return;

    result[season] = {};
    for (const stat of PERCENTILE_STATS) {
      result[season][stat] = computePercentile(dist[stat], playerStats[stat], INVERTED_STATS.has(stat));
    }
  });

  return Object.keys(result).length ? result : null;
}

module.exports = { getPlayerPercentiles, PERCENTILE_STATS };
