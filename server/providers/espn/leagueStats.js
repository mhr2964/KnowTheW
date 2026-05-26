// ESPN league-wide stat fetching for the percentile system. This module holds the single most
// fragile, fully-undocumented coupling in the app: the positional indices into ESPN's byathlete
// `categories[].values[]` arrays (see mapLeagueStatLine). Isolating it behind the provider keeps
// the percentile math (server/lib/percentileClient.js) source-agnostic — a Sportradar port only
// has to reproduce the normalized shapes these methods return.
//
// mapLeagueStatLine + the extract* functions are exported pure so the index mapping can be
// characterization-tested against a fixture without a network call.

const espn = require('../../lib/espnClient');
const { ESPN_WEB } = espn;
const { parseStatMap } = require('../../lib/statsParser');

const ESPN_BYATHLETE = 'https://site.api.espn.com/apis/common/v3/sports/basketball/wnba/statistics/byathlete';

// Qualification gates applied during extraction (min games + minutes to enter a distribution).
const PERCENTILE_MIN_GP  = 10;
const PERCENTILE_MIN_MPG = 10;

function primaryPosition(pos) {
  if (!pos) return '';
  return pos.split('/')[0].trim().toUpperCase();
}

function fetchWithTimeout(url, options = {}, ms = 12000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...options, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

// ── byathlete league stats (one paginated fetch per season, shared across modes) ──────────────
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

// THE INDICES — map one byathlete athlete entry to a normalized stat line, or null if unqualified.
// The positional reads into gen/off/def are ESPN-specific and undocumented; this is the function a
// future source swap most needs to re-implement, and the one the characterization test guards.
function mapLeagueStatLine(a, mode = 'PerGame') {
  const gen = a.categories[0]?.values ?? [];
  const off = a.categories[1]?.values ?? [];
  const def = a.categories[2]?.values ?? [];

  const pos = primaryPosition(a.athlete?.position?.abbreviation ?? '');
  const gp  = gen[0] ?? 0;
  const mpg = gen[1] ?? 0;

  if (gp < PERCENTILE_MIN_GP || mpg < PERCENTILE_MIN_MPG) return null;

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
    return { pos,
      PTS: pgPTS, REB: pgREB, AST: pgAST, STL: pgSTL, BLK: pgBLK,
      FG_PCT: fgPct, FG3_PCT: fg3Pct, FT_PCT: ftPct, TOV: pgTOV,
      PF: null, OREB: null, DREB: null,
      FGM: pgFGM, FGA: pgFGA, FG3M: pgFG3M, FG3A: pgFG3A, FTM: pgFTM, FTA: pgFTA, MIN: mpg,
    };
  }

  if (mode === 'Totals') {
    const t = v => (v !== null && v !== undefined) ? v * gp : null;
    return { pos,
      PTS: off[0] ?? null, REB: t(pgREB), AST: t(pgAST), STL: t(pgSTL), BLK: t(pgBLK),
      FG_PCT: fgPct, FG3_PCT: fg3Pct, FT_PCT: ftPct, TOV: t(pgTOV),
      PF: null, OREB: null, DREB: null,
      FGM: t(pgFGM), FGA: t(pgFGA), FG3M: t(pgFG3M), FG3A: t(pgFG3A), FTM: t(pgFTM), FTA: t(pgFTA),
      MIN: mpg > 0 ? Math.round(mpg * gp) : null,
    };
  }

  // Per36
  const scale = 36 / mpg;
  const p36 = v => (v !== null && v !== undefined) ? v * scale : null;
  return { pos,
    PTS: p36(pgPTS), REB: p36(pgREB), AST: p36(pgAST), STL: p36(pgSTL), BLK: p36(pgBLK),
    FG_PCT: fgPct, FG3_PCT: fg3Pct, FT_PCT: ftPct, TOV: p36(pgTOV),
    PF: null, OREB: null, DREB: null,
    FGM: p36(pgFGM), FGA: p36(pgFGA), FG3M: p36(pgFG3M), FG3A: p36(pgFG3A), FTM: p36(pgFTM), FTA: p36(pgFTA),
    MIN: mpg > 0 ? Math.round(mpg * gp) : null,
  };
}

/** Normalized league stat lines for a season+mode (qualified players only). */
async function getLeagueStatLines(season, mode = 'PerGame') {
  const athletes = await fetchEspnLeagueStats(season);
  return athletes.map(a => mapLeagueStatLine(a, mode)).filter(Boolean);
}

// ── Per-player OREB/DREB/PF (not in byathlete; fetched per athlete) ───────────────────────────
const espnIndividualCache    = {};
const espnIndividualInFlight = {};

/** Per-player rebound/foul averages for distribution enrichment: [{pos, gp, mpg, OREB, DREB, PF}]. */
async function getLeagueReboundFoulStats(season) {
  if (espnIndividualCache[season]) return espnIndividualCache[season];
  if (espnIndividualInFlight[season]) return espnIndividualInFlight[season];

  espnIndividualInFlight[season] = (async () => {
    const athletes = await fetchEspnLeagueStats(season);
    const posById = {};
    for (const a of athletes) {
      if (a.athlete?.id) posById[a.athlete.id] = primaryPosition(a.athlete?.position?.abbreviation ?? '');
    }
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
        return { pos: posById[id] ?? '', gp, mpg, OREB: m.avgOffensiveRebounds ?? null, DREB: m.avgDefensiveRebounds ?? null, PF: m.avgFouls ?? null };
      } catch { return null; }
    }));
    const result = entries.filter(Boolean);
    espnIndividualCache[season] = result;
    return result;
  })().finally(() => { delete espnIndividualInFlight[season]; });

  return espnIndividualInFlight[season];
}

// ── Single-player season averages by mode (for the player percentile lookup) ──────────────────
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
    MIN:     tot.MIN,
  };
}

/** A player's per-mode season averages: { pos, statsByModeBySeason: { [year]: {PerGame,Totals,Per36} } }. */
async function getPlayerSeasonAverages(playerId) {
  const pos = primaryPosition(espn.playerById[playerId]?.position || '');

  const r = await fetch(`${ESPN_WEB}/athletes/${playerId}/stats?seasontype=2`);
  if (!r.ok) return null;
  const data = await r.json();

  const avgCat = data?.categories?.find(c => c.name === 'averages');
  if (!avgCat?.statistics?.length) return null;

  const seasons = [...new Set(avgCat.statistics.map(e => String(e.season?.year)).filter(Boolean))];
  if (!seasons.length) return null;

  const statsByModeBySeason = {};
  for (const season of seasons) {
    statsByModeBySeason[season] = {
      PerGame: extractSeasonAvg(data, season),
      Totals:  extractTotalsStats(data, season),
      Per36:   extractPer36Stats(data, season),
    };
  }
  return { pos, statsByModeBySeason };
}

// ── Player search index (deduped across seasons) ──────────────────────────────────────────────
/** Deduped active+historical player index across the given seasons: [{id, name, position, headshot}]. */
async function getLeaguePlayerIndex(seasons) {
  const seen = new Set();
  const players = [];
  for (const season of seasons) {
    const athletes = await fetchEspnLeagueStats(season);
    for (const a of athletes) {
      const id = a.athlete?.id;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      players.push({
        id,
        name:     a.athlete.displayName,
        position: primaryPosition(a.athlete?.position?.abbreviation ?? ''),
        headshot: a.athlete?.headshot?.href ?? null,
      });
    }
  }
  return players;
}

module.exports = {
  getLeagueStatLines,
  getLeagueReboundFoulStats,
  getPlayerSeasonAverages,
  getLeaguePlayerIndex,
  // exported pure for characterization tests:
  mapLeagueStatLine,
  extractSeasonAvg,
  extractTotalsStats,
  extractPer36Stats,
};
