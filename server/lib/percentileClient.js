const { ESPN_WEB, playerById } = require('./espnClient');
const { parseStatMap } = require('./statsParser');
const { getDb } = require('../db');

const DIST_CACHE_COLLECTION = 'distributionCache';
const DIST_TTL_MS = 24 * 60 * 60 * 1000;

const ESPN_BYATHLETE = 'https://site.api.espn.com/apis/common/v3/sports/basketball/wnba/statistics/byathlete';


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
    PF:      tot.fouls                           ?? null,
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
    MIN:     null,  // always 36 in per-36 mode — not a meaningful percentile
  };
}

// ── Stat providers ──────────────────────────────────────────────────────────
// A provider is: (season: string, mode: string) => Promise<NormalizedEntry[]>
// ───────────────────────────────────────────────────────────────────────────

// ── ESPN byathlete provider ──────────────────────────────────────────────────
// Hits ESPN's public byathlete endpoint — no auth, no rate-limiting, works from
// Heroku. Returns per-game stats; Totals/Per36 are computed from the same data.
// One fetch per season (shared across all modes via espnRawCache).
// Note: PF, OREB, DREB are not available from this endpoint (null in distribution).
// ────────────────────────────────────────────────────────────────────────────

const espnRawCache    = {};
const espnRawInFlight = {};

async function fetchEspnLeagueStats(season) {
  if (espnRawCache[season]) return espnRawCache[season];
  if (espnRawInFlight[season]) return espnRawInFlight[season];

  espnRawInFlight[season] = (async () => {
    const athletes = [];
    let page = 1;
    while (true) {
      try {
        const url = `${ESPN_BYATHLETE}?season=${season}&seasontype=2&limit=200&page=${page}`;
        const res = await fetchWithTimeout(url);
        if (!res.ok) break;
        const data = await res.json();
        athletes.push(...(data.athletes ?? []));
        if (page >= (data.pagination?.pages ?? 1)) break;
        page++;
      } catch { break; }
    }
    espnRawCache[season] = athletes;
    return athletes;
  })().finally(() => { delete espnRawInFlight[season]; });

  return espnRawInFlight[season];
}

async function espnByAthleteProvider(season, mode = 'PerGame') {
  const athletes = await fetchEspnLeagueStats(season);

  return athletes.flatMap(a => {
    const gen = a.categories[0]?.values ?? [];
    const off = a.categories[1]?.values ?? [];
    const def = a.categories[2]?.values ?? [];

    const pos = primaryPosition(a.athlete?.position?.abbreviation ?? '');
    const gp  = gen[0] ?? 0;
    const mpg = gen[1] ?? 0;

    if (gp < PERCENTILE_MIN_GP || mpg < PERCENTILE_MIN_MPG) return [];

    const pgPTS  = off[1]  ?? null;
    const pgREB  = gen[5]  ?? null;
    const pgAST  = off[11] ?? null;
    const pgSTL  = def[0]  ?? null;
    const pgBLK  = def[1]  ?? null;
    const pgTOV  = off[12] ?? null;
    const pgFGM  = off[2]  ?? null;
    const pgFGA  = off[3]  ?? null;
    const pgFG3M = off[5]  ?? null;
    const pgFG3A = off[6]  ?? null;
    const pgFTM  = off[8]  ?? null;
    const pgFTA  = off[9]  ?? null;
    const fgPct  = off[4]  != null ? off[4]  / 100 : null;
    const fg3Pct = off[7]  != null ? off[7]  / 100 : null;
    const ftPct  = off[10] != null ? off[10] / 100 : null;

    if (mode === 'PerGame') {
      return [{ pos,
        PTS: pgPTS, REB: pgREB, AST: pgAST, STL: pgSTL, BLK: pgBLK,
        FG_PCT: fgPct, FG3_PCT: fg3Pct, FT_PCT: ftPct, TOV: pgTOV,
        PF: null, OREB: null, DREB: null,
        FGM: pgFGM, FGA: pgFGA, FG3M: pgFG3M, FG3A: pgFG3A, FTM: pgFTM, FTA: pgFTA, MIN: mpg,
      }];
    }

    if (mode === 'Totals') {
      const t = v => (v !== null && v !== undefined) ? v * gp : null;
      return [{ pos,
        PTS: off[0] ?? null, REB: t(pgREB), AST: t(pgAST), STL: t(pgSTL), BLK: t(pgBLK),
        FG_PCT: fgPct, FG3_PCT: fg3Pct, FT_PCT: ftPct, TOV: t(pgTOV),
        PF: null, OREB: null, DREB: null,
        FGM: t(pgFGM), FGA: t(pgFGA), FG3M: t(pgFG3M), FG3A: t(pgFG3A), FTM: t(pgFTM), FTA: t(pgFTA),
        MIN: mpg > 0 ? Math.round(mpg * gp) : null,
      }];
    }

    // Per36
    if (mpg <= 0) return [];
    const scale = 36 / mpg;
    const p36 = v => (v !== null && v !== undefined) ? v * scale : null;
    return [{ pos,
      PTS: p36(pgPTS), REB: p36(pgREB), AST: p36(pgAST), STL: p36(pgSTL), BLK: p36(pgBLK),
      FG_PCT: fgPct, FG3_PCT: fg3Pct, FT_PCT: ftPct, TOV: p36(pgTOV),
      PF: null, OREB: null, DREB: null,
      FGM: p36(pgFGM), FGA: p36(pgFGA), FG3M: p36(pgFG3M), FG3A: p36(pgFG3A), FTM: p36(pgFTM), FTA: p36(pgFTA),
      MIN: null,  // always 36 in per-36 mode — not a meaningful percentile
    }];
  });
}

const PROVIDERS = [espnByAthleteProvider];

// ── ESPN individual stats cache — shared across all modes for the same season ─
const espnIndividualCache    = {};
const espnIndividualInFlight = {};

async function fetchEspnIndividualSeasonStats(season, athletes) {
  if (espnIndividualCache[season]) return espnIndividualCache[season];
  if (espnIndividualInFlight[season]) return espnIndividualInFlight[season];

  // Build id → position map from byathlete data
  const posById = {};
  for (const a of athletes) {
    if (a.athlete?.id) posById[a.athlete.id] = primaryPosition(a.athlete?.position?.abbreviation ?? '');
  }

  espnIndividualInFlight[season] = (async () => {
    const entries = await Promise.all(athletes.map(async a => {
      const id = a.athlete?.id;
      if (!id) return null;
      try {
        const r = await fetchWithTimeout(`${ESPN_WEB}/athletes/${id}/stats?seasontype=2`);
        if (!r.ok) return null;
        const data = await r.json();
        const avgCat = data?.categories?.find(c => c.name === 'averages');
        const entry  = avgCat?.statistics?.find(e => String(e.season?.year) === String(season));
        if (!entry) return null;
        const m   = parseStatMap(avgCat.names, entry.stats);
        const gp  = m.gamesPlayed ?? 0;
        const mpg = m.avgMinutes  ?? 0;
        if (gp < PERCENTILE_MIN_GP || mpg < PERCENTILE_MIN_MPG) return null;
        return { id, pos: posById[id] ?? '', gp, mpg, OREB: m.avgOffensiveRebounds ?? null, DREB: m.avgDefensiveRebounds ?? null, PF: m.avgFouls ?? null };
      } catch { return null; }
    }));
    const result = entries.filter(Boolean);
    espnIndividualCache[season] = result;
    return result;
  })().finally(() => { delete espnIndividualInFlight[season]; });

  return espnIndividualInFlight[season];
}

async function enrichWithIndividualStats(distribution, season, mode, athletes) {
  const entries = await fetchEspnIndividualSeasonStats(season, athletes);
  if (entries.length < DISTRIBUTION_MIN) return;

  const groups = { all: entries };
  for (const entry of entries) {
    if (entry.pos) (groups[entry.pos] ??= []).push(entry);
  }

  for (const [grp, grpEntries] of Object.entries(groups)) {
    if (!distribution[grp]) continue;
    for (const stat of ['OREB', 'DREB', 'PF']) {
      distribution[grp][stat] = grpEntries.map(e => {
        const pg = e[stat];
        if (pg === null || pg === undefined) return null;
        if (mode === 'PerGame') return pg;
        if (mode === 'Totals')  return pg * e.gp;
        return e.mpg > 0 ? (pg / e.mpg) * 36 : null;
      }).filter(v => v !== null).sort((a, b) => a - b);
    }
  }
}

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

  const athletes = await fetchEspnLeagueStats(season);
  await enrichWithIndividualStats(distribution, season, mode, athletes);

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
