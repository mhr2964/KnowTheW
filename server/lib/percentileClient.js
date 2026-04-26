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

async function getOrBuildDistribution(season, mode = 'PerGame') {
  const key = `${season}:${mode}`;
  if (distributionCache[key]) return distributionCache[key];
  if (distributionInFlight[key]) return distributionInFlight[key];

  distributionInFlight[key] = (async () => {
    const dbRead = getDb();
    if (dbRead) {
      const doc = await dbRead.collection(DIST_CACHE_COLLECTION).findOne({ season, mode });
      if (doc) {
        const currentYear = new Date().getFullYear();
        const isRecent = Number(season) >= currentYear - 1;
        if (!isRecent || Date.now() - doc.cachedAt < DIST_TTL_MS) {
          distributionCache[key] = doc.distribution;
          return doc.distribution;
        }
      }
    }

    const dist = await buildLeagueDistribution(season, mode);
    if (dist) {
      distributionCache[key] = dist;
      const dbWrite = getDb();
      if (dbWrite) {
        await dbWrite.collection(DIST_CACHE_COLLECTION).updateOne(
          { season, mode },
          { $set: { distribution: dist, cachedAt: Date.now() } },
          { upsert: true }
        );
      }
    }
    return dist ?? null;
  })().finally(() => { delete distributionInFlight[key]; });

  return distributionInFlight[key];
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

function extractTotalsStats(data, targetYear) {
  if (!data?.categories) return null;
  const avgCat = data.categories.find(c => c.name === 'averages');
  const totCat = data.categories.find(c => c.name === 'totals');
  if (!avgCat || !totCat) return null;

  const avgEntry = avgCat.statistics?.find(e => String(e.season?.year) === String(targetYear));
  const totEntry = totCat.statistics?.find(e => String(e.season?.year) === String(targetYear));
  if (!avgEntry || !totEntry) return null;

  const avg = parseStatMap(avgCat.names, avgEntry.stats);
  const tot = parseStatMap(totCat.names, totEntry.stats);

  if ((avg.gamesPlayed ?? 0) < PERCENTILE_MIN_GP || (avg.avgMinutes ?? 0) < PERCENTILE_MIN_MPG) return null;

  return {
    PTS:     tot.points                          ?? null,
    REB:     tot.totalRebounds                   ?? null,
    AST:     tot.assists                         ?? null,
    STL:     tot.steals                          ?? null,
    BLK:     tot.blocks                          ?? null,
    FG_PCT:  tot.fieldGoalPct                    ?? null,
    FG3_PCT: tot.threePointFieldGoalPct          ?? null,
    FT_PCT:  tot.freeThrowPct                    ?? null,
    TOV:     tot.turnovers                       ?? null,
    PF:      tot.personalFouls                   ?? null,
    OREB:    tot.offensiveRebounds               ?? null,
    DREB:    tot.defensiveRebounds               ?? null,
    FGM:     tot.fieldGoalsMade                  ?? null,
    FGA:     tot.fieldGoalsAttempted             ?? null,
    FG3M:    tot.threePointFieldGoalsMade        ?? null,
    FG3A:    tot.threePointFieldGoalsAttempted   ?? null,
    FTM:     tot.freeThrowsMade                  ?? null,
    FTA:     tot.freeThrowsAttempted             ?? null,
    MIN:     Math.round((avg.avgMinutes ?? 0) * (avg.gamesPlayed ?? 0)) || null,
  };
}

function extractPer36Stats(data, targetYear) {
  const tot = extractTotalsStats(data, targetYear);
  if (!tot || !tot.MIN || tot.MIN <= 0) return null;
  const p = v => (v !== null && v !== undefined) ? (v / tot.MIN) * 36 : null;
  return {
    PTS:     p(tot.PTS),
    REB:     p(tot.REB),
    AST:     p(tot.AST),
    STL:     p(tot.STL),
    BLK:     p(tot.BLK),
    FG_PCT:  tot.FG_PCT,
    FG3_PCT: tot.FG3_PCT,
    FT_PCT:  tot.FT_PCT,
    TOV:     p(tot.TOV),
    PF:      p(tot.PF),
    OREB:    p(tot.OREB),
    DREB:    p(tot.DREB),
    FGM:     p(tot.FGM),
    FGA:     p(tot.FGA),
    FG3M:    p(tot.FG3M),
    FG3A:    p(tot.FG3A),
    FTM:     p(tot.FTM),
    FTA:     p(tot.FTA),
    MIN:     36,
  };
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

async function wnbaStatsProvider(season, mode = 'PerGame') {
  const posById = await fetchWnbaPosById();

  const url = new URL(`${WNBA_STATS}/leaguedashplayerstats`);
  url.searchParams.set('LeagueID', '10');
  url.searchParams.set('Season', wnbaSeasonParam(season));
  url.searchParams.set('SeasonType', 'Regular Season');
  url.searchParams.set('PerMode', mode);
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

async function buildLeagueDistribution(season, mode = 'PerGame') {
  const providerResults = await Promise.all(PROVIDERS.map(p => p(season, mode)));
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

const DIST_MODES = ['PerGame', 'Per36', 'Totals'];
const MODE_KEY   = { PerGame: 'perGame', Per36: 'per36', Totals: 'totals' };

function computeSeasonMode(data, season, mode, fullDist, playerPos) {
  if (!fullDist) return null;
  const posPool = fullDist[playerPos]?.PTS?.length ?? 0;
  const dist = posPool >= POSITION_MIN_BUCKET ? fullDist[playerPos] : fullDist['all'];
  if (!dist) return null;

  const playerStats =
    mode === 'PerGame' ? extractSeasonAvg(data, season) :
    mode === 'Totals'  ? extractTotalsStats(data, season) :
                         extractPer36Stats(data, season);
  if (!playerStats) return null;

  const out = {};
  for (const stat of PERCENTILE_STATS) {
    out[stat] = computePercentile(dist[stat], playerStats[stat], INVERTED_STATS.has(stat));
  }
  return out;
}

// Returns { "2025": { perGame: { PTS: 98, ... }, per36: { ... }, totals: { ... } }, ... }
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

  await Promise.all(
    seasons.flatMap(season => DIST_MODES.map(mode => getOrBuildDistribution(season, mode)))
  );

  const result = {};
  for (const season of seasons) {
    const seasonResult = {};
    for (const mode of DIST_MODES) {
      const fullDist = distributionCache[`${season}:${mode}`] ?? null;
      const computed = computeSeasonMode(data, season, mode, fullDist, playerPos);
      if (computed) seasonResult[MODE_KEY[mode]] = computed;
    }
    if (Object.keys(seasonResult).length) result[season] = seasonResult;
  }

  return Object.keys(result).length ? result : null;
}

async function warmDistributionCache() {
  const currentYear = new Date().getFullYear();
  const seasons = [];
  for (let y = 2011; y <= currentYear; y++) seasons.push(String(y));
  await Promise.all(
    seasons.flatMap(season => DIST_MODES.map(mode => getOrBuildDistribution(season, mode).catch(() => null)))
  );
}

module.exports = { getPlayerPercentiles, PERCENTILE_STATS, warmDistributionCache };
