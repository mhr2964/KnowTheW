const { ESPN_WEB, playerById } = require('./espnClient');
const { parseStatMap } = require('./statsParser');
const { getDb } = require('../db');

const DIST_CACHE_COLLECTION = 'distributionCache';
const DIST_TTL_MS = 24 * 60 * 60 * 1000;

const WNBA_STATS = 'https://stats.wnba.com/stats';
const WNBA_HEADERS = {
  'User-Agent':          'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:72.0) Gecko/20100101 Firefox/72.0',
  'Accept':              'application/json, text/plain, */*',
  'Accept-Language':     'en-US,en;q=0.5',
  'x-nba-stats-origin':  'stats',
  'x-nba-stats-token':   'true',
  'Origin':              'https://stats.wnba.com',
  'Referer':             'https://www.wnba.com/',
  'Pragma':              'no-cache',
  'Cache-Control':       'no-cache',
};

const PERCENTILE_MIN_GP   = 10;
const PERCENTILE_MIN_MPG  = 10;
const DISTRIBUTION_MIN    = 30;
const POSITION_MIN_BUCKET = 20;

const PERCENTILE_STATS = ['PTS', 'REB', 'AST', 'STL', 'BLK', 'FG_PCT', 'FG3_PCT', 'FT_PCT', 'TOV', 'PF', 'OREB', 'DREB', 'FGM', 'FGA', 'FG3M', 'FG3A', 'FTM', 'FTA', 'MIN'];
const INVERTED_STATS = new Set(['TOV', 'PF']);

const distributionCache   = {};
const distributionInFlight = {};

async function getOrBuildDistribution(season) {
  if (distributionCache[season]) return distributionCache[season];
  if (distributionInFlight[season]) return distributionInFlight[season];

  distributionInFlight[season] = (async () => {
    const dbRead = getDb();
    if (dbRead) {
      const doc = await dbRead.collection(DIST_CACHE_COLLECTION).findOne({ season });
      if (doc) {
        const currentYear = new Date().getFullYear();
        const isRecent = Number(season) >= currentYear - 1;
        if (!isRecent || Date.now() - doc.cachedAt < DIST_TTL_MS) {
          distributionCache[season] = doc.distribution;
          return doc.distribution;
        }
      }
    }

    const dist = await buildLeagueDistribution(season);
    if (dist) {
      distributionCache[season] = dist;
      const dbWrite = getDb();
      if (dbWrite) {
        await dbWrite.collection(DIST_CACHE_COLLECTION).updateOne(
          { season },
          { $set: { distribution: dist, cachedAt: Date.now() } },
          { upsert: true }
        );
      }
    }
    return dist ?? null;
  })().finally(() => { delete distributionInFlight[season]; });

  return distributionInFlight[season];
}

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
    TOV:     m.avgTurnovers                     ?? null,
    PF:      m.avgFouls                         ?? null,
    OREB:    m.avgOffensiveRebounds             ?? null,
    DREB:    m.avgDefensiveRebounds             ?? null,
    FGM:     m.avgFieldGoalsMade                ?? null,
    FGA:     m.avgFieldGoalsAttempted           ?? null,
    FG3M:    m.avgThreePointFieldGoalsMade      ?? null,
    FG3A:    m.avgThreePointFieldGoalsAttempted ?? null,
    FTM:     m.avgFreeThrowsMade                ?? null,
    FTA:     m.avgFreeThrowsAttempted           ?? null,
    MIN:     m.avgMinutes                       ?? null,
  };
}

function fetchWithTimeout(url, options = {}, ms = 12000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...options, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

// ── Stat providers ──────────────────────────────────────────────────────────
// A provider is: (season: string) => Promise<NormalizedEntry[]>
// Each is self-contained — owns its own ID system, fetch logic, and parsing.
// Add new sources by writing a provider function and appending it to PROVIDERS.
// Outputs are merged before building the distribution; no ID coordination needed.
// ───────────────────────────────────────────────────────────────────────────

// ── WNBA Stats provider ─────────────────────────────────────────────────────
// Hits stats.wnba.com — returns ALL players who appeared in a given season,
// including retired players. One request per season covers the entire league.
// posById is loaded once via playerindex?Historical=1 and cached in memory.
// ───────────────────────────────────────────────────────────────────────────

let wnbaPosById        = null;
let wnbaPosByIdPromise = null;

async function fetchWnbaPosById() {
  if (wnbaPosById) return wnbaPosById;
  if (wnbaPosByIdPromise) return wnbaPosByIdPromise;
  wnbaPosByIdPromise = (async () => {
    try {
      const res = await fetchWithTimeout(
        `${WNBA_STATS}/playerindex?LeagueID=10&Historical=1`,
        { headers: WNBA_HEADERS }
      );
      if (!res.ok) return {};
      const data = await res.json();
      const rs = data.resultSets?.[0];
      if (!rs) return {};
      const idIdx  = rs.headers.indexOf('PERSON_ID');
      const posIdx = rs.headers.indexOf('POSITION');
      const map = {};
      for (const row of rs.rowSet) {
        map[row[idIdx]] = primaryPosition(row[posIdx] || '');
      }
      wnbaPosById = map;
      return map;
    } catch {
      return {};
    }
  })();
  return wnbaPosByIdPromise;
}

function wnbaSeasonParam(year) {
  return `${year}-${String(Number(year) + 1).slice(-2).padStart(2, '0')}`;
}

async function wnbaStatsProvider(season) {
  const posById = await fetchWnbaPosById();

  const url = new URL(`${WNBA_STATS}/leaguedashplayerstats`);
  url.searchParams.set('LeagueID', '10');
  url.searchParams.set('Season', wnbaSeasonParam(season));
  url.searchParams.set('SeasonType', 'Regular Season');
  url.searchParams.set('PerMode', 'PerGame');
  url.searchParams.set('MeasureType', 'Base');
  url.searchParams.set('LastNGames', '0');
  url.searchParams.set('Month', '0');
  url.searchParams.set('OpponentTeamID', '0');
  url.searchParams.set('PaceAdjust', 'N');
  url.searchParams.set('Period', '0');
  url.searchParams.set('PlusMinus', 'N');
  url.searchParams.set('Rank', 'N');

  try {
    const res = await fetchWithTimeout(url.toString(), { headers: WNBA_HEADERS });
    if (!res.ok) return [];
    const data = await res.json();
    const rs = data.resultSets?.[0];
    if (!rs) return [];

    const idx = Object.fromEntries(rs.headers.map((h, i) => [h, i]));

    return rs.rowSet
      .filter(row => (row[idx.GP] ?? 0) >= PERCENTILE_MIN_GP && (row[idx.MIN] ?? 0) >= PERCENTILE_MIN_MPG)
      .map(row => ({
        pos:     posById[row[idx.PLAYER_ID]] ?? '',
        PTS:     row[idx.PTS]     ?? null,
        REB:     row[idx.REB]     ?? null,
        AST:     row[idx.AST]     ?? null,
        STL:     row[idx.STL]     ?? null,
        BLK:     row[idx.BLK]     ?? null,
        FG_PCT:  row[idx.FG_PCT]  ?? null,
        FG3_PCT: row[idx.FG3_PCT] ?? null,
        FT_PCT:  row[idx.FT_PCT]  ?? null,
        TOV:     row[idx.TOV]     ?? null,
        PF:      row[idx.PF]      ?? null,
        OREB:    row[idx.OREB]    ?? null,
        DREB:    row[idx.DREB]    ?? null,
        FGM:     row[idx.FGM]     ?? null,
        FGA:     row[idx.FGA]     ?? null,
        FG3M:    row[idx.FG3M]    ?? null,
        FG3A:    row[idx.FG3A]    ?? null,
        FTM:     row[idx.FTM]     ?? null,
        FTA:     row[idx.FTA]     ?? null,
        MIN:     row[idx.MIN]     ?? null,
      }));
  } catch {
    return [];
  }
}

const PROVIDERS = [wnbaStatsProvider];

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

  await Promise.all(seasons.map(season => getOrBuildDistribution(season)));

  const result = {};
  for (const season of seasons) {
    const fullDist = distributionCache[season] ?? null;
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

async function warmDistributionCache() {
  const currentYear = new Date().getFullYear();
  const seasons = [];
  for (let y = 2011; y <= currentYear; y++) seasons.push(String(y));
  await Promise.all(seasons.map(season => getOrBuildDistribution(season).catch(() => null)));
}

module.exports = { getPlayerPercentiles, PERCENTILE_STATS, warmDistributionCache };
