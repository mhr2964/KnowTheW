const { ESPN_WEB, playerById } = require('./espnClient');
const { parseStatMap } = require('./statsParser');

const ESPN_CORE = 'https://sports.core.api.espn.com/v2/sports/basketball/leagues/wnba';

const PERCENTILE_MIN_GP   = 10;
const PERCENTILE_MIN_MPG  = 10;
const DISTRIBUTION_MIN    = 30;
const POSITION_MIN_BUCKET = 20;

const PERCENTILE_STATS = ['PTS', 'REB', 'AST', 'STL', 'BLK', 'FG_PCT', 'FG3_PCT', 'FT_PCT', 'TOV', 'PF', 'OREB', 'DREB'];
const INVERTED_STATS = new Set(['TOV', 'PF']);

const distributionCache = {};

function primaryPosition(pos) {
  if (!pos) return '';
  return pos.split('/')[0].trim().toUpperCase();
}

// ── Normalized entry ────────────────────────────────────────────────────────
// Shape returned by every provider and consumed by buildLeagueDistribution:
// { pos: string, PTS, REB, AST, STL, BLK, FG_PCT, FG3_PCT, FT_PCT, TOV, PF, OREB, DREB }
// pos is the primary position abbreviation ('G', 'F', 'C', or '' if unknown).
// All stat values are per-game averages; null means unavailable.
// ───────────────────────────────────────────────────────────────────────────

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

// ── Stat providers ──────────────────────────────────────────────────────────
// A provider is: (season: string) => Promise<NormalizedEntry[]>
// Each is self-contained — owns its own ID system, fetch logic, and parsing.
// Add new sources by writing a provider function and appending it to PROVIDERS.
// Outputs are merged before building the distribution; no ID coordination needed.
// ───────────────────────────────────────────────────────────────────────────

async function espnProvider(season) {
  const res = await fetch(`${ESPN_CORE}/seasons/${season}/athletes?limit=1000`);
  if (!res.ok) return [];
  const data = await res.json();
  const playerIds = (data.items || [])
    .map(item => { const m = item.$ref?.match(/\/athletes\/(\d+)/); return m ? m[1] : null; })
    .filter(Boolean);
  if (!playerIds.length) return [];

  const entries = await Promise.all(
    playerIds.map(async id => {
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
  return entries.filter(Boolean);
}

// Add additional providers here when a new data source is available, e.g.:
// const PROVIDERS = [espnProvider, brefProvider];
const PROVIDERS = [espnProvider];

// ── Distribution builder ────────────────────────────────────────────────────

async function buildLeagueDistribution(season) {
  const providerResults = await Promise.all(PROVIDERS.map(p => p(season)));
  const qualified = providerResults.flat();

  if (qualified.length < DISTRIBUTION_MIN) return null;

  const groups = { all: qualified };
  for (const entry of qualified) {
    if (entry.pos) (groups[entry.pos] ??= []).push(entry);
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

// ── Percentile computation ──────────────────────────────────────────────────

function computePercentile(sortedAsc, value, inverted) {
  if (!sortedAsc?.length || value === null || value === undefined) return null;
  const below = inverted
    ? sortedAsc.filter(v => v > value).length
    : sortedAsc.filter(v => v < value).length;
  return Math.round((below / sortedAsc.length) * 100);
}

// Returns { "2025": { PTS: 98, ... }, "2024": { ... }, ... }
// Seasons where no provider returns enough players are omitted entirely.
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
    if (!distributionCache[season]) {
      const dist = await buildLeagueDistribution(season);
      if (dist) distributionCache[season] = dist;
    }
    const fullDist = distributionCache[season];
    if (!fullDist) continue;

    const posPool = fullDist[playerPos]?.PTS?.length ?? 0;
    const dist = posPool >= POSITION_MIN_BUCKET ? fullDist[playerPos] : fullDist['all'];
    if (!dist) continue;

    const playerStats = extractSeasonAvg(data, season);
    if (!playerStats) continue;

    result[season] = {};
    for (const stat of PERCENTILE_STATS) {
      result[season][stat] = computePercentile(dist[stat], playerStats[stat], INVERTED_STATS.has(stat));
    }
  }

  return Object.keys(result).length ? result : null;
}

module.exports = { getPlayerPercentiles, PERCENTILE_STATS };
