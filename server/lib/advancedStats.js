const { GAME_MINUTES, getLeagueAverage } = require('../constants/leagueAverages');
const { getProvider } = require('../providers');
// Source access via the active provider; thin locals keep call sites below unchanged.
const fetchTeamStats      = (...a) => getProvider().getTeamStats(...a);
const fetchTeamPtsAllowed = (...a) => getProvider().getTeamPointsAllowed(...a);
const { computeBasicRatioStats, computePER, computeWinShares } = require('./statFormulas');
const { getCached, writeCache } = require('./teamSeasonCache');
const { ESPN_DETAILED_HEADERS, buildSeasonTables, extractTeamIdByYear } = require('./statsParser');
const { isPastSeason } = require('./seasonWindow');
const { getDb } = require('../db');
const { columnsFor } = require('./statColumns');
const { fetchPlayerSeasonData } = require('./playerSeasonData');

// Per-game/totals tables passed into buildAdvancedSplit/buildAdvancedCareer always use this exact
// header set (ESPN_DETAILED_HEADERS) — index off the constant directly rather than reading
// `.headers` off the passed-in table, so this module doesn't care whether that table is still
// carrying a `headers` field or has moved to `columns` for its own HTTP response.
const PG_I = Object.fromEntries(ESPN_DETAILED_HEADERS.map((h, i) => [h, i]));

const ADV_HEADERS_SRV = [
  'SEASON_ID', 'TEAM_ABBREVIATION', 'GP',
  'TS_PCT', 'EFG_PCT', 'TPAr', 'FTr', 'TOV_PCT',
  'USG_PCT', 'AST_PCT',
  'ORB_PCT', 'DRB_PCT', 'TRB_PCT',
  'STL_PCT', 'BLK_PCT',
  'PER',
  'OWS', 'DWS', 'WS', 'WS_PER48',
  'OFF_RATING', 'DEF_RATING', 'NET_RATING', 'PIE',
];

const ADV_I = Object.fromEntries(ADV_HEADERS_SRV.map((h, idx) => [h, idx]));

function advancedRow(row, I, tm, lg, totRow, officialTm = null) {
  const fga = row[I.FGA] ?? 0,  fgm = row[I.FGM] ?? 0;
  const fg3m = row[I.FG3M] ?? 0;
  const fta = row[I.FTA] ?? 0,  ftm = row[I.FTM] ?? 0;
  const orb = row[I.OREB] ?? 0, drb = row[I.DREB] ?? 0, trb = row[I.REB] ?? 0;
  const ast = row[I.AST] ?? 0,  stl = row[I.STL] ?? 0, blk = row[I.BLK] ?? 0;
  const tov = row[I.TOV] ?? 0,  pf  = row[I.PF]  ?? 0;
  const mp  = row[I.MIN] ?? 0;

  // Use integer totals for ratio stats — matches BRef which computes from exact counts.
  // Fall back to per-game averages if totals not available.
  const t    = totRow ?? row;
  const tFga = t[I.FGA] ?? 0, tFgm = t[I.FGM] ?? 0;
  const tFg3m = t[I.FG3M] ?? 0, tFg3a = t[I.FG3A] ?? 0;
  const tFta  = t[I.FTA] ?? 0, tTov = t[I.TOV] ?? 0, tPts = t[I.PTS] ?? 0;

  const { ts, efg, tpar, ftr, tovPct } = computeBasicRatioStats(tFga, tFgm, tFg3m, tFg3a, tFta, tPts, tTov);

  let usgPct=null, astPct=null, orbPct=null, drbPct=null, trbPct=null;
  let stlPct=null, blkPct=null, per=null;

  if (tm && lg && mp > 0) {
    // tm.oFgaPg is set only when PBP on-court data is available.
    // On-court stats are already scaled to the player's playing time, so the GAME_MINUTES/mp
    // factor that appears in approximation formulas cancels out.
    const hasPBP = tm.oFgaPg !== undefined;

    if (hasPBP) {
      // ── PBP-exact path ───────────────────────────────────────────────────────
      // USG%, AST%, PER: use official season-average team stats (officialTm) when available.
      // On-court PBP understates team possessions/pace in older seasons where non-scoring
      // plays are incompletely recorded, inflating these three stats. ORB/DRB/TRB/STL/BLK
      // use ratios immune to this issue and stay on PBP on-court data.

      const effTmPoss = officialTm
        ? (officialTm.fgaPg ?? 0) + 0.44*(officialTm.ftaPg ?? 0) + (officialTm.tovPg ?? 0)
        : tm.fgaPg + 0.44*tm.ftaPg + tm.tovPg;
      if (effTmPoss > 0) usgPct = (fga + 0.44*fta + tov) * GAME_MINUTES / (mp * effTmPoss);

      const effOnFloorFgm = officialTm
        ? (mp / GAME_MINUTES) * (officialTm.fgmPg ?? 0)
        : tm.fgmPg;
      if (effOnFloorFgm > fgm) astPct = ast / (effOnFloorFgm - fgm);

      // ORB%/DRB%/TRB%: mirror BRef's season-average minutes-scaled formula.
      // Structure is symmetric: team rebound total + league-avg opponent rebound total.
      // Not using missed-FGA as denominator — unreboundable misses (blocked OOB, etc.)
      // make it larger than actual (Tm_ORB + Opp_DRB), causing systematic underestimate.
      const effTmOrb = officialTm ? (officialTm.orbPg ?? 0) : tm.orbPg;
      const effTmDrb = officialTm ? (officialTm.drbPg ?? 0) : tm.drbPg;
      const orbDenom = effTmOrb + lg.drb;
      const drbDenom = effTmDrb + lg.orb;
      const trbDenom = effTmOrb + effTmDrb + lg.trb;
      if (orbDenom > 0) orbPct = orb * GAME_MINUTES / (mp * orbDenom);
      if (drbDenom > 0) drbPct = drb * GAME_MINUTES / (mp * drbDenom);
      if (trbDenom > 0) trbPct = trb * GAME_MINUTES / (mp * trbDenom);

      const oppPoss = tm.oFgaPg + 0.44*tm.oFtaPg + tm.oTovPg - tm.oOrbPg;
      if (oppPoss > 0) stlPct = stl / oppPoss;

      const opp2PA = tm.oFgaPg - tm.oFg3aPg;
      if (opp2PA > 0) blkPct = blk / opp2PA;

      // PER: use official team stats for both pace and AST/FGM ratio.
      // On-court ratio differs from season-level (interior players suppress team AST% when on court).
      const tmRatio = (officialTm && (officialTm.fgmPg ?? 0) > 0)
        ? (officialTm.astPg ?? 0) / officialTm.fgmPg
        : (tm.fgmPg > 0 ? tm.astPg / tm.fgmPg : 0);
      const effTmPace = officialTm
        ? (officialTm.fgaPg ?? 0) - (officialTm.orbPg ?? 0) + (officialTm.tovPg ?? 0) + 0.44*(officialTm.ftaPg ?? 0)
        : (tm.fgaPg - tm.orbPg + tm.tovPg + 0.44*tm.ftaPg) * (GAME_MINUTES / mp);
      per = computePER(mp, fga, fgm, fg3m, fta, ftm, orb, trb, stl, blk, tov, ast, pf, tmRatio, effTmPace, lg);

    } else {
      // ── Approximation path (season-average team stats) ───────────────────────
      const tmPoss = tm.fgaPg + 0.44*tm.ftaPg + tm.tovPg;
      if (tmPoss > 0) usgPct = (fga + 0.44*fta + tov) * GAME_MINUTES / (mp * tmPoss);

      const onFloorFgm = (mp / GAME_MINUTES) * tm.fgmPg;
      if (onFloorFgm > fgm) astPct = ast / (onFloorFgm - fgm);

      const tmMissed = tm.fgaPg - tm.fgmPg;
      if (tmMissed > 0) orbPct = orb * GAME_MINUTES / (mp * tmMissed);

      const drbD = tm.drbPg + lg.orb;
      if (drbD > 0) drbPct = drb * GAME_MINUTES / (mp * drbD);

      const trbD = tmMissed + (lg.fga - lg.fgm);
      if (trbD > 0) trbPct = trb * GAME_MINUTES / (mp * trbD);

      const lgPoss = lg.fga + 0.44*lg.fta + lg.tov - lg.orb;
      if (lgPoss > 0) stlPct = stl * GAME_MINUTES / (mp * lgPoss);

      const lg2PA = lg.fga - lg.fg3a;
      if (lg2PA > 0) blkPct = blk * GAME_MINUTES / (mp * lg2PA);

      const tmRatio = (tm.fgmPg ?? 0) > 0 ? (tm.astPg ?? 0) / tm.fgmPg : 0;
      const tmPace  = (tm.fgaPg ?? 0) - (tm.orbPg ?? 0) + (tm.tovPg ?? 0) + 0.44*(tm.ftaPg ?? 0);
      per = computePER(mp, fga, fgm, fg3m, fta, ftm, orb, trb, stl, blk, tov, ast, pf, tmRatio, tmPace, lg);
    }
  }

  return [
    row[I.SEASON_ID], row[I.TEAM_ABBREVIATION], row[I.GP],
    ts, efg, tpar, ftr, tovPct,
    usgPct, astPct, orbPct, drbPct, trbPct, stlPct, blkPct, per,
    null, null, null, null, // OWS, DWS, WS, WS_PER48 — only populated in advanced-pbp-all
    null, null, null, null, // OFF_RATING, DEF_RATING, NET_RATING, PIE — same, see computeSeasonPBPUncached
  ];
}

function buildAdvancedSplit(src, teamIdByYear, cache, totSrc) {
  if (!src?.rows) return null;
  const I = PG_I;
  const totByYear = {};
  if (totSrc?.rows) {
    for (const r of totSrc.rows) totByYear[String(r[I.SEASON_ID])] = r;
  }
  const rows = src.rows.map(row => {
    const year = String(row[I.SEASON_ID]);
    const tid  = teamIdByYear[year];
    const tm   = tid ? (cache[`${tid}-${year}`] ?? null) : null;
    const lg   = getLeagueAverage(year) ?? null;
    return advancedRow(row, I, tm, lg, totByYear[year] ?? null);
  });
  return { headers: ADV_HEADERS_SRV, rows };
}

function buildAdvancedCareer(pgSrc, totSrc) {
  if (!pgSrc?.rows?.[0]) return null;
  const I = PG_I;
  const row = pgSrc.rows[0];
  const t   = totSrc?.rows?.[0] ?? row;
  const fga = t[I.FGA] ?? 0, fgm = t[I.FGM] ?? 0;
  const fg3m = t[I.FG3M] ?? 0, fg3a = t[I.FG3A] ?? 0;
  const fta = t[I.FTA] ?? 0, pts = t[I.PTS] ?? 0, tov = t[I.TOV] ?? 0;
  const { ts, efg, tpar, ftr, tovPct } = computeBasicRatioStats(fga, fgm, fg3m, fg3a, fta, pts, tov);
  return { headers: ADV_HEADERS_SRV, rows: [
    [row[I.SEASON_ID], row[I.TEAM_ABBREVIATION], row[I.GP],
     ts, efg, tpar, ftr, tovPct,
     null, null, null, null, null, null, null, null,
     null, null, null, null,
     null, null, null, null],
  ]};
}

// Pure: swaps BDL's def_ws in for the homegrown-computed DWS (wsVals[1]) and recomputes WS/
// WS_PER48 from it, so they stay internally consistent (WS = OWS + DWS) rather than mixing an old
// WS with a new DWS. User decision, 2026-08-22, resolving the discrepancy this override used to
// flag as unresolved: BDL's def_ws (season total -- see defenseStats.js's header comment on the
// per_mode fix that makes it one) vs. this formula's own DWS diverged materially for the same
// player-season (6.01 vs. 1.71, A'ja Wilson 2025).
//
// Only overrides when OWS itself computed successfully (wsVals[0] != null) -- a bare DWS with no
// OWS would make WS misleading (just DWS, not a real "wins from offense + defense" total).
// Pre-2022 seasons (BDL has no measure_type=defense data that far back) and ESPN-provider
// environments both pass bdlDefense === null here and simply keep the homegrown DWS/WS/WS_PER48
// unchanged -- same graceful-degradation posture as every other BDL-only field in this codebase.
function overrideDwsWithBdl(wsVals, bdlDefense, totalMin) {
  if (bdlDefense?.bdlDefWs == null || wsVals[0] == null) return wsVals;
  const [ows] = wsVals;
  const dws = bdlDefense.bdlDefWs;
  const ws = ows + dws;
  const wsPer48 = totalMin > 0 ? ws / (totalMin / 48) : null;
  return [ows, dws, ws, wsPer48];
}

// Inner implementation — no caching. Returns { row, pbpGames, complete } where complete is true
// only when every eventId returned a non-null summary (no ESPN failures mid-fetch). Partial
// results are still returned to the caller for display but must not be persisted to the cache.
async function computeSeasonPBPUncached(playerId, season, playerRow, I, teamId, totRow, seasontype = 2) {
  const summary = await getProvider().getSeasonPBPSummary(playerId, season, seasontype);
  if (!summary) return null;
  const { tmOC, tmForWS, pbpGames, complete } = summary;

  const lg = getLeagueAverage(season) ?? null;

  // Fetch official team stats before advancedRow — used there for USG%, AST%, PER
  // (PBP undercounts team possessions/pace in older seasons).
  // Also needed for Win Shares (officialPace for DWS, ptsAllowedPg).
  // Ratings (Off/Def/Net/PIE) come straight off the source's own season-level endpoint, unrelated
  // to the box-score reconstruction above -- fetched alongside rather than sequentially after.
  // bdlDefense is fetched the same way, purely for its def_ws -- see the DWS override below.
  const [[tmOfficial, ptsAllowedPg], ratings, bdlDefense] = await Promise.all([
    teamId
      ? Promise.all([fetchTeamStats(teamId, season), fetchTeamPtsAllowed(teamId, season)])
      : Promise.resolve([null, null]),
    getProvider().getPlayerSeasonRatings(playerId, season, seasontype),
    getProvider().getPlayerSeasonDefense(playerId, season, seasontype),
  ]);

  const advRow = advancedRow(playerRow, I, tmOC, lg, totRow, tmOfficial);

  const officialPace = tmOfficial
    ? (tmOfficial.fgaPg ?? 0) - (tmOfficial.orbPg ?? 0) + (tmOfficial.tovPg ?? 0) + 0.44*(tmOfficial.ftaPg ?? 0)
    : null;
  // Use official team stats for OWS — more consistent across seasons than boxscore-derived stats.
  // Boxscore approach is conceptually correct (player-game restriction) but doesn't improve
  // accuracy because the root issue is ESPN vs BRef source data divergence, not sampling.
  const tmForOWS = tmOfficial ?? tmForWS;
  let wsVals = (tmForOWS && lg && ptsAllowedPg != null)
    ? computeWinShares(playerRow, I, tmForOWS, lg, ptsAllowedPg, officialPace)
    : [null, null, null, null];

  // BDL's def_ws is this site's AUTHORITATIVE Win Shares number as of 2026-08-22 (user decision,
  // resolving the discrepancy this override used to flag as unresolved) -- see
  // overrideDwsWithBdl's own comment for the full reasoning.
  const totalMin = (playerRow[I.MIN] ?? 0) * (playerRow[I.GP] ?? 0);
  wsVals = overrideDwsWithBdl(wsVals, bdlDefense, totalMin);

  const ratingVals = ratings
    ? [ratings.offRating, ratings.defRating, ratings.netRating, ratings.pie]
    : [null, null, null, null];
  const row = [...advRow.slice(0, 16), ...wsVals, ...ratingVals];

  // complete comes from the provider summary — false means an ESPN fetch failed mid-game-loop.
  // Partial fetches must not be cached — they would bake in understated stats permanently.
  // The row is still returned to the caller for this request.
  return { row, pbpGames, complete };
}

// Cache-aside wrapper. Past seasons (season < currentYear) are read from and written to the
// playerSeasonPbp Mongo collection. Current season bypasses Mongo entirely — same posture as
// teamSeasonCache.js for live data. Write is gated on complete === true so partial ESPN fetches
// (ESPN flaking on a subset of games) are never persisted; they return live to the caller but
// leave the cache slot open for a future complete fetch.
async function computeSeasonPBP(playerId, season, playerRow, I, teamId, totRow, seasontype = 2) {
  if (isPastSeason(season)) {
    // Provider-scoped so toggling STATS_PROVIDER can't read back the other source's cached PBP
    // reconstruction for the same player/season. `-v3` suffix: this collection has no version-field
    // wrapper like advancedStats.js's own `v` guard on the `advancedStats` collection below -- bumping
    // the KEY itself is teamSeasonCache.js's own documented invalidation mechanism. Bumped v1->v2 when
    // OFF_RATING/DEF_RATING/NET_RATING/PIE were added to the row shape (confirmed live, 2026-08-21: an
    // unbumped key kept serving the old 20-element row for every already-cached past season forever).
    // Bumped v2->v3, 2026-08-22: DWS/WS/WS_PER48 now source from BDL's def_ws when available (see
    // computeSeasonPBPUncached above) -- same shape, different VALUES, so a v2-cached row would
    // silently keep serving the old homegrown-only DWS forever without this bump.
    const cacheKey = `${getProvider().name}-${playerId}-${season}-${seasontype}-v3`;

    // Check cache first — one findOne, no ESPN traffic on hit.
    const cached = await getCached('playerSeasonPbp', cacheKey);
    if (cached !== null) return cached;

    // Cache miss — compute from ESPN.
    const result = await computeSeasonPBPUncached(playerId, season, playerRow, I, teamId, totRow, seasontype);
    if (!result) return null;

    // Only persist when every eventId returned a non-null summary. Partial results indicate
    // transient ESPN failures; caching them would permanently under-count on-court stats.
    if (result.complete) {
      writeCache('playerSeasonPbp', cacheKey, { row: result.row, pbpGames: result.pbpGames });
    }

    return { row: result.row, pbpGames: result.pbpGames };
  }

  // Current season: live compute, no Mongo.
  const result = await computeSeasonPBPUncached(playerId, season, playerRow, I, teamId, totRow, seasontype);
  if (!result) return null;
  return { row: result.row, pbpGames: result.pbpGames };
}

function buildPbpSplit(valid, pgRows, rowI) {
  const seasonMins = Object.fromEntries(
    (pgRows ?? []).map(r => [String(r[rowI.SEASON_ID]), (r[rowI.MIN] ?? 0) * (r[rowI.GP] ?? 0)])
  );
  const careerOWS  = valid.reduce((s, r) => s + (r.row[ADV_I.OWS] ?? 0), 0);
  const careerDWS  = valid.reduce((s, r) => s + (r.row[ADV_I.DWS] ?? 0), 0);
  const careerWS   = careerOWS + careerDWS;
  const careerGP   = valid.reduce((s, r) => s + (r.row[ADV_I.GP]  ?? 0), 0);
  const careerMin  = valid.reduce((s, r) => s + (seasonMins[r.season] ?? 0), 0);
  const careerWS48 = careerMin > 0 ? careerWS / (careerMin / 48) : null;
  // Ratings are per-100-possession rates, not summable like OWS/DWS -- career value is a
  // minutes-weighted average across seasons (there's no lower-level possession count available
  // from the source to recompute an exact career rate from, unlike TS%/eFG% which derive from
  // summed raw totals in buildAdvancedCareer above).
  function weightedCareerAvg(field) {
    let wSum = 0, mSum = 0;
    for (const r of valid) {
      const v = r.row[ADV_I[field]];
      const m = seasonMins[r.season] ?? 0;
      if (v != null && m > 0) { wSum += v * m; mSum += m; }
    }
    return mSum > 0 ? wSum / mSum : null;
  }
  const careerRow  = ADV_HEADERS_SRV.map(h => {
    if (h === 'SEASON_ID') return 'Career';
    if (h === 'TEAM_ABBREVIATION') return '';
    if (h === 'GP')       return careerGP;
    if (h === 'OWS')      return careerOWS;
    if (h === 'DWS')      return careerDWS;
    if (h === 'WS')       return careerWS;
    if (h === 'WS_PER48') return careerWS48;
    if (h === 'OFF_RATING' || h === 'DEF_RATING' || h === 'NET_RATING' || h === 'PIE') {
      return weightedCareerAvg(h);
    }
    return null;
  });
  return { rows: valid.map(r => r.row), careerRow };
}

// Shared setup: parsed per-game/totals tables (regular + playoffs) plus the team-id and totals
// lookups computeSeasonPBP needs. Pulled out of computeAdvancedPbpAll so the single-season route
// (computeSeasonAdvancedRow) can call the SAME provider-facing lookups -- fetchPlayerSeasonData's
// result is TTL-cached per player, so repeated calls (one per season, from the progressive client
// fetch) cost one real provider round-trip, not one per season.
async function loadAdvPgTables(playerId) {
  const { regSeasons: rawRegSeasons, postSeasons: rawPostSeasons, teamsById } = await fetchPlayerSeasonData(playerId);
  const regParsed  = buildSeasonTables(rawRegSeasons,  teamsById);
  const postParsed = buildSeasonTables(rawPostSeasons, teamsById);
  const pgTable = regParsed?.pg?.table;
  if (!pgTable) return null;
  const I = Object.fromEntries(pgTable.headers.map((h, i) => [h, i]));

  const pgPostTable = postParsed?.pg?.table;
  const IPost = pgPostTable
    ? Object.fromEntries(pgPostTable.headers.map((h, i) => [h, i]))
    : I;

  const totByYear = {};
  const totTable = regParsed?.tot?.table;
  if (totTable?.rows) for (const r of totTable.rows) totByYear[String(r[I.SEASON_ID])] = r;

  const totPostByYear = {};
  const totPostTable = postParsed?.tot?.table;
  if (totPostTable?.rows) for (const r of totPostTable.rows) totPostByYear[String(r[IPost.SEASON_ID])] = r;

  return {
    rawRegSeasons, rawPostSeasons,
    pgTable, I, pgPostTable, IPost,
    totByYear, totPostByYear,
    regTidByYear:  extractTeamIdByYear(rawRegSeasons),
    postTidByYear: extractTeamIdByYear(rawPostSeasons),
  };
}

// Single-season advanced row -- the fast path a client hits per-season so a career's worth of
// seasons can load progressively instead of one all-seasons request. Reuses computeSeasonPBP's
// existing per-season Mongo cache (playerSeasonPbp) unchanged, so calling this once per past season
// ALSO warms the cache computeAdvancedPbpAll reads from -- by the time every season has been fetched
// this way, the whole-career call below is nearly all cache hits regardless of career length.
async function computeSeasonAdvancedRow(playerId, season, seasontype = 2) {
  // Same eligibility gate computeAdvancedPbpAll applies to regSeasons/postSeasons below -- a
  // season with no league-average entry yet (e.g. the in-progress season before WNBA_LG is
  // seeded) is one the whole-career result excludes entirely, not one it includes with null
  // advanced columns. Without this check, this route would compute (and briefly show) a row the
  // final authoritative call then makes disappear.
  if (!getLeagueAverage(season)) return null;

  const loaded = await loadAdvPgTables(playerId);
  if (!loaded) return null;
  const { pgTable, I, pgPostTable, IPost, totByYear, totPostByYear, regTidByYear, postTidByYear } = loaded;

  if (seasontype === 3) {
    if (!pgPostTable) return null;
    const playerRow = pgPostTable.rows.find(r => String(r[IPost.SEASON_ID]) === season);
    if (!playerRow) return null;
    // WS computation needs regular-season team stats; prefer regTidByYear so the team ID is
    // always valid even if ESPN/BDL omits teamId from playoff stat entries.
    const wsTeamId = regTidByYear[season] ?? postTidByYear[season] ?? null;
    const result = await computeSeasonPBP(playerId, season, playerRow, IPost, wsTeamId, totPostByYear[season] ?? null, 3);
    return result ? { columns: columnsFor(ADV_HEADERS_SRV), row: result.row } : null;
  }

  const playerRow = pgTable.rows.find(r => String(r[I.SEASON_ID]) === season);
  if (!playerRow) return null;
  const result = await computeSeasonPBP(playerId, season, playerRow, I, regTidByYear[season] ?? null, totByYear[season] ?? null, 2);
  return result ? { columns: columnsFor(ADV_HEADERS_SRV), row: result.row } : null;
}

// Whole-career advanced-stats computation (PBP-exact: USG%/AST%/PER/Win-Shares per season, career
// totals) for one player, Mongo-cached. Extracted from routes/playerAnalysis.js's
// /players/:id/advanced-pbp-all handler so scripts/seed-balldontlie-cache.js can populate the exact
// same cache entries a live request would -- there's no separate "warm path" that could drift from
// what users actually see; a cache hit here IS what the route returns.
//
// Returns the advResult object on success, or null when the player has no stats at all (caller maps
// this to 404). Throws on genuine upstream failures (caller maps to 502) -- same contract the route
// had inline before this extraction, no behavior change.
async function computeAdvancedPbpAll(playerId) {
  const loaded = await loadAdvPgTables(playerId);
  if (!loaded) return null;
  const {
    pgTable, I, pgPostTable, IPost,
    totByYear, totPostByYear, regTidByYear, postTidByYear,
  } = loaded;

  // Cache: invalidate when regular or playoff GP changes, or when format is old (no .regular key)
  const regGP  = pgTable.rows.reduce((s, r) => s + (r[I.GP] ?? 0), 0);
  const postGP = (pgPostTable?.rows ?? []).reduce((s, r) => s + (r[IPost.GP] ?? 0), 0);
  const currentGP = regGP + postGP;
  const db = getDb();
  // Provider-scoped _id so toggling STATS_PROVIDER can't read back the other source's cached
  // advanced-stats response for the same player.
  const advCacheId = `${getProvider().name}-${playerId}`;

  // regSeasons/postSeasons: the filtered list of season-id strings worth computing PBP for,
  // distinct from rawRegSeasons/rawPostSeasons (the raw provider rows used by extractTeamIdByYear
  // inside loadAdvPgTables above).
  const regSeasons  = [...new Set(pgTable.rows.map(r => String(r[I.SEASON_ID])))].filter(s => getLeagueAverage(s));
  const postSeasons = pgPostTable
    ? [...new Set(pgPostTable.rows.map(r => String(r[IPost.SEASON_ID])))].filter(s => getLeagueAverage(s))
    : [];
  const hadSeasonsToTry = regSeasons.length > 0 || postSeasons.length > 0;

  if (db) {
    const advCached = await db.collection('advancedStats').findOne({ _id: advCacheId });
    // A cached doc whose `regular.rows` is empty despite there being real seasons to compute is a
    // poisoned entry from a past systemic failure (see the write-side guard below for how new ones
    // are prevented) -- bypass it and recompute instead of serving it forever.
    const looksPoisoned = hadSeasonsToTry && advCached?.data?.regular?.rows?.length === 0;
    if (advCached?.gp === currentGP && advCached.v === 30 && advCached.data?.regular != null && !looksPoisoned) {
      return advCached.data;
    }
  }

  const [regResults, postResults] = await Promise.all([
    Promise.all(regSeasons.map(async season => {
      const playerRow = pgTable.rows.find(r => String(r[I.SEASON_ID]) === season);
      if (!playerRow) return null;
      const result = await computeSeasonPBP(playerId, season, playerRow, I, regTidByYear[season] ?? null, totByYear[season] ?? null, 2);
      return result ? { season, row: result.row, pbpGames: result.pbpGames } : null;
    })),
    Promise.all(postSeasons.map(async season => {
      const playerRow = pgPostTable.rows.find(r => String(r[IPost.SEASON_ID]) === season);
      if (!playerRow) return null;
      // WS computation needs regular-season team stats; prefer regTidByYear so the team ID
      // is always valid even if ESPN omits teamId from playoff stat entries.
      const wsTeamId = regTidByYear[season] ?? postTidByYear[season] ?? null;
      const result = await computeSeasonPBP(playerId, season, playerRow, IPost, wsTeamId, totPostByYear[season] ?? null, 3);
      return result ? { season, row: result.row, pbpGames: result.pbpGames } : null;
    })),
  ]);

  const validReg  = regResults.filter(Boolean);
  const validPost = postResults.filter(Boolean);

  const advResult = {
    columns:  columnsFor(ADV_HEADERS_SRV),
    regular:  buildPbpSplit(validReg,  pgTable.rows,      I),
    playoffs: validPost.length ? buildPbpSplit(validPost, pgPostTable?.rows ?? [], IPost) : null,
    pbpGamesBySeason: Object.fromEntries([
      ...validReg.map(r => [r.season, r.pbpGames]),
      ...validPost.map(r => [`post-${r.season}`, r.pbpGames]),
    ]),
  };

  // Don't cache a fully-empty result when there WERE seasons to compute -- that's a systemic
  // failure (dead API key, provider down, etc.), not "this player genuinely has no data", and
  // caching it would permanently poison the response until the player's GP changes (confirmed
  // live, 2026-08-17: a run against a dead BALLDONTLIE_KEY wrote empty results that then served as
  // valid cache hits indefinitely, masking that the underlying computation never actually worked).
  // A player who legitimately has zero qualifying seasons (e.g. no games yet this career) still
  // gets cached correctly, since hadSeasonsToTry would itself be false in that case.
  const looksLikeSystemicFailure = hadSeasonsToTry && validReg.length === 0 && validPost.length === 0;

  // v bumped 25->26: response shape changed from `headers` (bare strings) to `columns`
  // ({key,label,kind}) — force a rebuild of any Mongo-cached v25 documents.
  // v bumped 26->27: getLeagueAverage() now covers the in-progress season -- force a rebuild of any
  // v26 doc that was cached as legitimately-empty only because the current season had no WNBA_LG
  // entry yet (a 2026-only rookie's advanced stats, for example). Self-heals with no manual cleanup.
  // v bumped 27->28->29: added OFF_RATING/DEF_RATING/NET_RATING/PIE columns -- without a bump, every
  // already-cached player keeps serving the old 20-column shape forever. 28 was itself burned during
  // this same rollout: a dev-server test run wrote a v28 doc for a real player BEFORE the underlying
  // per-season playerSeasonPbp cache key was ALSO bumped (see computeSeasonPBP below) -- that
  // still-stale row got baked into the v28 doc and re-served identically on every hit since the
  // outer v-guard alone can't tell a "genuinely v28-shaped" doc from a "poisoned during rollout" one.
  // v bumped 29->30, 2026-08-22: DWS/WS/WS_PER48 now source from BDL's def_ws when available (same
  // shape, different values) -- the underlying playerSeasonPbp cache key was ALSO bumped this same
  // pass (v2->v3, see computeSeasonPBP below), applying the exact lesson v28's own poisoning taught.
  if (db && !looksLikeSystemicFailure) db.collection('advancedStats')
    .replaceOne({ _id: advCacheId }, { _id: advCacheId, gp: currentGP, v: 30, data: advResult }, { upsert: true })
    .catch(err => console.error('mongo write advancedStats:', err.message));

  return advResult;
}

module.exports = {
  ADV_HEADERS_SRV, ADV_I,
  advancedRow, buildAdvancedSplit, buildAdvancedCareer, computeSeasonPBP, buildPbpSplit,
  computeAdvancedPbpAll, computeSeasonAdvancedRow, loadAdvPgTables, overrideDwsWithBdl,
};
