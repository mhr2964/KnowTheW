// BDL-sourced percentile system (Part 2 of the 5-part provider plan). Previously ESPN-forever —
// see docs/design/provider-architecture.md's Phase 1b note. That was correct at the time but for a
// reason the plan initially missed: percentileClient.js compares a SINGLE PLAYER's stat value
// against a LEAGUE-WIDE DISTRIBUTION for the same stat+season+mode (computeSeasonPercentiles).
// Migrating only one side (e.g. just getPlayerSeasonAverages, leaving the league distribution on
// ESPN) would silently rank a BDL-computed value against an ESPN-computed distribution — different
// rounding/formulas on each side, a systematic skew in every percentile shown. The fix is migrating
// all three percentile-system methods together, season-conditionally, so a season's player value and
// its distribution always share one source: getLeagueStatLines/getLeagueReboundFoulStats for < 2008
// stay ESPN (in balldontlie/index.js), and getPlayerSeasonAverages's per-season rows are already
// correctly source-split by seasonStats.js's existing whole-career merge (this module just reshapes
// those already-correct rows into the percentile system's flat per-mode contract).
//
// "No leaderboard endpoint" (the original plan's stated reason to leave getLeagueStatLines on ESPN)
// turned out to be about a NAMED route, not a real capability gap: `GET /player_season_stats` with
// no `player_ids` filter returns the whole league's per-game season averages in ~2-3 paginated calls
// (confirmed live, 2026-08-20 spike) — functionally a leaderboard endpoint. It has no OREB/DREB/PF
// split though (neither does player_season_advanced_stats — checked), so getLeagueReboundFoulStats
// still needs the heavier path: a bulk `/player_stats` pull (one row per player per game, ~70+ pages/
// ~7k rows for a full season) aggregated per player, cross-referenced against a bulk `/games` pull to
// drop playoff/All-Star/exhibition rows the same way seasonStats.js already does for one player.
//
// Cost note: the bulk /player_stats pull is ~12s+ on a cold cache (confirmed live). Past seasons
// cache forever once built (makeSeasonCache), so this is a one-time cost per season, not recurring —
// but the first live request for an unwarmed season would eat it inline inside players.js's route
// handler, the same timeout shape as the PBP/Advanced incident that started this whole refactor.
// scripts/warmDistributions.js pre-builds every BDL-covered season's distribution out of band so a
// live request never hits a cold cache; it needs re-running once each time a new season completes.

const { bdlFetch } = require('./client');
const { isRealFranchise } = require('./idMap');
const { getPlayerSeasonStatsBdl } = require('./seasonStats');
const espn = require('../espn');
const { PERCENTILE_MIN_GP, PERCENTILE_MIN_MPG, primaryPosition } = require('../espn/leagueStats');
const { latestCompletedSeason } = require('../../lib/seasonWindow');

// Generic cursor-paginated bulk fetch. Any page failing (bdlFetch exhausts its own retries and
// returns null) invalidates the WHOLE pull rather than returning a partial page set — a distribution
// silently built from 1/4 of the league would look valid but skew every percentile, which is worse
// than the existing null/empty "no distribution built" fallback percentileClient.js already handles.
async function fetchAllPagesBdl(path, params) {
  const rows = [];
  let cursor;
  while (true) {
    const data = await bdlFetch(path, { ...params, per_page: 100, cursor });
    if (!data) return null;
    rows.push(...(data.data ?? []));
    if (!data.meta?.next_cursor) break;
    cursor = data.meta.next_cursor;
  }
  return rows;
}

// ── getLeagueStatLines (PTS/REB/AST/STL/BLK/shooting splits) ──────────────────────────────────
// /player_season_stats already returns real per-game averages computed by BDL itself (confirmed:
// season_type is honored here, unlike /player_stats where it's silently ignored) -- no per-game
// summing needed for PerGame mode. Totals mode multiplies by games_played, same approximation ESPN's
// own mapLeagueStatLine already uses for every field except PTS (see extractTotalsStats there) --
// matching ESPN's method (not exact per-game summing) keeps this consistent with itself, which is
// all that matters now that both sides of every comparison share one source.
function mapBdlLeagueStatLine(row, mode) {
  const gp = row.games_played ?? 0;
  const mpg = Number(row.min) || 0;
  if (gp < PERCENTILE_MIN_GP || mpg < PERCENTILE_MIN_MPG) return null;

  const pos = primaryPosition(row.player?.position_abbreviation ?? row.player?.position ?? '');
  const pgPTS = row.pts ?? null, pgREB = row.reb ?? null, pgAST = row.ast ?? null;
  const pgSTL = row.stl ?? null, pgBLK = row.blk ?? null, pgTOV = row.turnover ?? null;
  const pgFGM = row.fgm ?? null, pgFGA = row.fga ?? null;
  const pgFG3M = row.fg3m ?? null, pgFG3A = row.fg3a ?? null;
  const pgFTM = row.ftm ?? null, pgFTA = row.fta ?? null;
  // BDL returns pct fields on a 0-100 scale, same convention as ESPN's raw stat map.
  const fgPct = row.fg_pct != null ? row.fg_pct / 100 : null;
  const fg3Pct = row.fg3_pct != null ? row.fg3_pct / 100 : null;
  const ftPct = row.ft_pct != null ? row.ft_pct / 100 : null;
  // OREB/DREB/PF aren't on this endpoint -- left null here, same as ESPN's own mapLeagueStatLine,
  // filled in separately by getLeagueReboundFoulStatsBdl via percentileClient's enrichment pass.
  // bdlPlayerId/name/teamAbbr are identity, not percentile inputs -- percentileClient.js's
  // PERCENTILE_STATS-driven distribution builder only ever plucks named stat keys off this object,
  // so these extra fields ride along harmlessly for the one consumer that does need identity:
  // leagueStatLeaders.js's League Leaders board (BDL rows carry no ESPN id, bridged there by name
  // via idMap.js's resolveEspnIdByName, same pattern getLeagueShotZoneLeaders already uses).
  const base = {
    pos, FG_PCT: fgPct, FG3_PCT: fg3Pct, FT_PCT: ftPct, PF: null, OREB: null, DREB: null,
    bdlPlayerId: row.player?.id ?? null,
    name: `${row.player?.first_name ?? ''} ${row.player?.last_name ?? ''}`.trim(),
    teamAbbr: row.team?.abbreviation ?? null,
  };

  if (mode === 'PerGame') {
    return { ...base,
      PTS: pgPTS, REB: pgREB, AST: pgAST, STL: pgSTL, BLK: pgBLK, TOV: pgTOV,
      FGM: pgFGM, FGA: pgFGA, FG3M: pgFG3M, FG3A: pgFG3A, FTM: pgFTM, FTA: pgFTA, MIN: mpg,
    };
  }
  if (mode === 'Totals') {
    const t = v => (v !== null && v !== undefined) ? v * gp : null;
    return { ...base,
      PTS: t(pgPTS), REB: t(pgREB), AST: t(pgAST), STL: t(pgSTL), BLK: t(pgBLK), TOV: t(pgTOV),
      FGM: t(pgFGM), FGA: t(pgFGA), FG3M: t(pgFG3M), FG3A: t(pgFG3A), FTM: t(pgFTM), FTA: t(pgFTA),
      MIN: mpg > 0 ? Math.round(mpg * gp) : null,
    };
  }
  // Per36
  const scale = 36 / mpg;
  const p36 = v => (v !== null && v !== undefined) ? v * scale : null;
  return { ...base,
    PTS: p36(pgPTS), REB: p36(pgREB), AST: p36(pgAST), STL: p36(pgSTL), BLK: p36(pgBLK), TOV: p36(pgTOV),
    FGM: p36(pgFGM), FGA: p36(pgFGA), FG3M: p36(pgFG3M), FG3A: p36(pgFG3A), FTM: p36(pgFTM), FTA: p36(pgFTA),
    MIN: mpg > 0 ? Math.round(mpg * gp) : null,
  };
}

const bdlSeasonStatsRowsCache = {};
async function fetchBdlLeagueSeasonRows(season) {
  if (season in bdlSeasonStatsRowsCache) return bdlSeasonStatsRowsCache[season];
  const rows = await fetchAllPagesBdl('/player_season_stats', { season, season_type: 2 });
  bdlSeasonStatsRowsCache[season] = rows;
  return rows;
}

/** Normalized league stat lines for a season+mode (qualified players only). [] on a fetch failure,
 *  same "empty, not thrown" contract as espn/leagueStats.js's version. */
async function getLeagueStatLinesBdl(season, mode = 'PerGame') {
  const rows = await fetchBdlLeagueSeasonRows(season);
  if (!rows) return [];
  return rows.map(r => mapBdlLeagueStatLine(r, mode)).filter(Boolean);
}

// ── getLeagueReboundFoulStats (OREB/DREB/PF) ───────────────────────────────────────────────────
// No BDL endpoint returns these pre-aggregated -- confirmed against both player_season_stats and
// player_season_advanced_stats (neither has oreb/dreb/pf; the advanced endpoint only has oreb_pct/
// dreb_pct percentages and no PF at all). Built from the same bulk /player_stats + /games
// cross-reference pattern seasonStats.js already uses for one player, just applied league-wide.

const bdlRegularSeasonGameIdsCache = {};
async function buildRegularSeasonGameIdSet(season) {
  if (season in bdlRegularSeasonGameIdsCache) return bdlRegularSeasonGameIdsCache[season];
  const rows = await fetchAllPagesBdl('/games', { 'seasons[]': [season] });
  const result = rows === null ? null : new Set(
    rows.filter(g => isRealFranchise(g.home_team) && isRealFranchise(g.visitor_team) && !g.postseason)
        .map(g => g.id)
  );
  bdlRegularSeasonGameIdsCache[season] = result;
  return result;
}

// A BDL /player_stats row exists even for a DNP game (min:"0"/null, every counting stat null) --
// same quirk gameLog.js's isDnpRow already documents and filters for one player.
function isDnpRow(row) {
  return row.min == null || row.min === '0' || row.min === '';
}

const bdlReboundFoulStatsCache = {};
/** Per-player rebound/foul averages for distribution enrichment: [{pos, gp, mpg, OREB, DREB, PF}].
 *  [] on a fetch failure, same contract as espn/leagueStats.js's version. */
async function getLeagueReboundFoulStatsBdl(season) {
  if (season in bdlReboundFoulStatsCache) return bdlReboundFoulStatsCache[season];

  const [gameIdSet, rows] = await Promise.all([
    buildRegularSeasonGameIdSet(season),
    fetchAllPagesBdl('/player_stats', { 'seasons[]': [season] }),
  ]);
  if (!gameIdSet || !rows) { bdlReboundFoulStatsCache[season] = []; return []; }

  const byPlayer = new Map();
  for (const row of rows) {
    if (!gameIdSet.has(row.game?.id) || isDnpRow(row)) continue;
    const pid = row.player?.id;
    if (pid == null) continue;
    let acc = byPlayer.get(pid);
    if (!acc) {
      acc = { pos: primaryPosition(row.player?.position_abbreviation ?? row.player?.position ?? ''), gp: 0, totalMin: 0, oreb: 0, dreb: 0, pf: 0 };
      byPlayer.set(pid, acc);
    }
    acc.gp += 1;
    acc.totalMin += Number(row.min) || 0;
    acc.oreb += row.oreb ?? 0;
    acc.dreb += row.dreb ?? 0;
    acc.pf += row.pf ?? 0;
  }

  const result = [];
  for (const acc of byPlayer.values()) {
    const mpg = acc.gp > 0 ? acc.totalMin / acc.gp : 0;
    if (acc.gp < PERCENTILE_MIN_GP || mpg < PERCENTILE_MIN_MPG) continue;
    result.push({ pos: acc.pos, gp: acc.gp, mpg, OREB: acc.oreb / acc.gp, DREB: acc.dreb / acc.gp, PF: acc.pf / acc.gp });
  }
  bdlReboundFoulStatsCache[season] = result;
  return result;
}

// ── getPlayerSeasonAverages (single player, per-mode, per-season) ─────────────────────────────
// Reuses seasonStats.js's getPlayerSeasonStatsBdl -- it already merges ESPN (< BDL_MIN_SEASON) and
// BDL (>= BDL_MIN_SEASON) rows per season correctly, so this just reshapes each already-correctly-
// sourced PlayerSeasonRow into the percentile system's flat {PerGame,Totals,Per36} contract. A
// season this produces for a BDL year is built from the identical rows getLeagueStatLinesBdl/
// getLeagueReboundFoulStatsBdl would aggregate for that same season, so the two sides never mismatch.

const TOTALS_TO_PERCENTILE_KEY = {
  pts: 'PTS', reb: 'REB', ast: 'AST', stl: 'STL', blk: 'BLK', tov: 'TOV', pf: 'PF',
  oreb: 'OREB', dreb: 'DREB', fgm: 'FGM', fga: 'FGA', fg3m: 'FG3M', fg3a: 'FG3A', ftm: 'FTM', fta: 'FTA',
};

// Pure: one PlayerSeasonRow (server/providers/types.js) -> {PerGame,Totals,Per36} in the percentile
// system's shape, or null if the season doesn't meet the qualification gate.
function toPercentileStatsFromRow(row) {
  const gp = row.gp ?? 0;
  const totalMinutes = row.totalMinutes ?? 0;
  const mpg = gp > 0 ? totalMinutes / gp : 0;
  if (gp < PERCENTILE_MIN_GP || mpg < PERCENTILE_MIN_MPG) return null;

  const t = row.totals ?? {};
  const pct = (m, a) => (a > 0 ? m / a : null);
  const base = { FG_PCT: pct(t.fgm, t.fga), FG3_PCT: pct(t.fg3m, t.fg3a), FT_PCT: pct(t.ftm, t.fta) };

  const Totals = { ...base, MIN: totalMinutes };
  const PerGame = { ...base, MIN: mpg };
  const Per36 = { ...base, MIN: totalMinutes };
  for (const [field, key] of Object.entries(TOTALS_TO_PERCENTILE_KEY)) {
    const v = t[field] ?? 0;
    Totals[key] = v;
    PerGame[key] = gp > 0 ? v / gp : null;
    Per36[key] = totalMinutes > 0 ? (v / totalMinutes) * 36 : null;
  }
  return { PerGame, Totals, Per36 };
}

// Player position for the returned envelope only -- percentileClient.js explicitly ignores this
// field in favor of a stable playerIndex lookup (prefetch-timing-dependent otherwise), so this is
// cosmetic, not load-bearing. Sourced from ESPN identity data regardless of provider, matching the
// "player identity stays ESPN-forever" constraint -- not a new BDL identity lookup.
async function resolvePos(espnPlayerId) {
  const basics = await espn.getPlayerBasics(espnPlayerId);
  if (basics?.position) return primaryPosition(basics.position);
  const retired = await espn.getRetiredPlayer(espnPlayerId);
  return primaryPosition(retired?.position ?? '');
}

/** A player's per-mode season averages: { pos, statsByModeBySeason: { [year]: {PerGame,Totals,Per36} } }. */
async function getPlayerSeasonAveragesBdl(espnPlayerId) {
  const [pos, { regSeasons }] = await Promise.all([
    resolvePos(espnPlayerId),
    getPlayerSeasonStatsBdl(espnPlayerId),
  ]);
  if (!regSeasons) return null;

  const cap = latestCompletedSeason();
  const statsByModeBySeason = {};
  for (const row of regSeasons) {
    if (Number(row.year) > cap) continue; // in-progress season excluded, same as ESPN's version
    const modes = toPercentileStatsFromRow(row);
    if (modes) statsByModeBySeason[row.year] = modes;
  }
  if (!Object.keys(statsByModeBySeason).length) return null;
  return { pos, statsByModeBySeason };
}

module.exports = {
  getLeagueStatLinesBdl,
  getLeagueReboundFoulStatsBdl,
  getPlayerSeasonAveragesBdl,
  // exported for unit tests:
  mapBdlLeagueStatLine, toPercentileStatsFromRow, isDnpRow, fetchAllPagesBdl,
};
