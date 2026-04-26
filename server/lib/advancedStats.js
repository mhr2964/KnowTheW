const { GAME_MINUTES, WNBA_LG } = require('../constants/leagueAverages');
const { ESPN_WEB, fetchGameSummary, fetchTeamStats, fetchTeamPtsAllowed, getTeams } = require('./espnClient');
const { computeBasicRatioStats, computePER, computeWinShares } = require('./statFormulas');
const { PBP_OC_KEYS, computeOnCourtStats, extractBoxscoreTeamStats } = require('./pbpExtractor');

const ADV_HEADERS_SRV = [
  'SEASON_ID', 'TEAM_ABBREVIATION', 'GP',
  'TS_PCT', 'EFG_PCT', 'TPAr', 'FTr', 'TOV_PCT',
  'USG_PCT', 'AST_PCT',
  'ORB_PCT', 'DRB_PCT', 'TRB_PCT',
  'STL_PCT', 'BLK_PCT',
  'PER',
  'OWS', 'DWS', 'WS', 'WS_PER48',
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
  ];
}

function buildAdvancedSplit(src, teamIdByYear, cache, totSrc) {
  if (!src?.rows) return null;
  const I = Object.fromEntries(src.headers.map((h, i) => [h, i]));
  const totByYear = {};
  if (totSrc?.rows) {
    for (const r of totSrc.rows) totByYear[String(r[I.SEASON_ID])] = r;
  }
  const rows = src.rows.map(row => {
    const year = String(row[I.SEASON_ID]);
    const tid  = teamIdByYear[year];
    const tm   = tid ? (cache[`${tid}-${year}`] ?? null) : null;
    const lg   = WNBA_LG[year] ?? null;
    return advancedRow(row, I, tm, lg, totByYear[year] ?? null);
  });
  return { headers: ADV_HEADERS_SRV, rows };
}

function buildAdvancedCareer(pgSrc, totSrc) {
  if (!pgSrc?.rows?.[0]) return null;
  const I = Object.fromEntries(pgSrc.headers.map((h, i) => [h, i]));
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
     null, null, null, null],
  ]};
}

async function computeSeasonPBP(playerId, season, playerRow, I, teamId, totRow, seasontype = 2) {
  const glData = await fetch(
    `${ESPN_WEB}/athletes/${playerId}/gamelog?season=${season}&seasontype=${seasontype}`
  ).then(r => r.ok ? r.json() : null);
  if (!glData) return null;

  // ESPN returns all season types regardless of the seasontype param — filter to the right one.
  // Also exclude All-Star/exhibition events: they appear under "Regular Season" but involve
  // non-franchise teams. Commissioner's Cup games have eventNote too — keep those (real games).
  // Use the live franchise list so future expansion team IDs (e.g. 129689) are not excluded.
  const stFilter = seasontype === 2 ? 'Regular Season' : 'Postseason';
  const eventMeta = glData.events || {};
  const franchiseIds = new Set((await getTeams()).map(t => String(t.id)));
  const eventIds = [];
  (glData.seasonTypes || []).forEach(st => {
    if (!st.displayName?.includes(stFilter)) return;
    (st.categories || []).forEach(cat => {
      (cat.events || []).forEach(evt => {
        if (!evt.eventId) return;
        const meta = eventMeta[evt.eventId];
        if (meta?.eventNote?.toLowerCase().includes('all-star')) return;
        const oppId = String(meta?.opponent?.id ?? '');
        if (oppId && !franchiseIds.has(oppId)) return;
        eventIds.push(evt.eventId);
      });
    });
  });
  if (!eventIds.length) return null;

  const summaries = await Promise.all(eventIds.map(id => fetchGameSummary(id)));
  const totOC = Object.fromEntries(PBP_OC_KEYS.map(k => [k, 0]));
  const totTm = { fga: 0, fgm: 0, fg3m: 0, fta: 0, ftm: 0, pts: 0, orb: 0, drb: 0, tov: 0, ast: 0 };
  let pbpGames = 0, wsGames = 0;

  for (const summary of summaries) {
    if (!summary) continue;
    const oc = computeOnCourtStats(summary, playerId);
    if (!oc) continue;
    pbpGames++;
    for (const k of PBP_OC_KEYS) totOC[k] += oc[k];

    const gs = extractBoxscoreTeamStats(summary, playerId);
    if (gs) {
      wsGames++;
      for (const k of Object.keys(totTm)) totTm[k] += gs.tm[k] ?? 0;
    }
  }
  if (!pbpGames) return null;

  const g = pbpGames;
  const tmOC = {
    fgaPg:   totOC.fga  / g, fgmPg:   totOC.fgm  / g,
    fg3aPg:  totOC.fg3a / g, ftaPg:   totOC.fta  / g, ftmPg:  totOC.ftm / g,
    orbPg:   totOC.orb  / g, drbPg:   totOC.drb  / g,
    tovPg:   totOC.tov  / g, astPg:   totOC.ast  / g,
    oFgaPg:  totOC.oFga  / g, oFgmPg: totOC.oFgm  / g,
    oFg3aPg: totOC.oFg3a / g, oFtaPg: totOC.oFta  / g,
    oOrbPg:  totOC.oOrb  / g, oDrbPg: totOC.oDrb  / g,
    oTovPg:  totOC.oTov  / g,
  };

  const lg = WNBA_LG[season] ?? null;

  // Fetch official team stats before advancedRow — used there for USG%, AST%, PER
  // (PBP undercounts team possessions/pace in older seasons).
  // Also needed for Win Shares (officialPace for DWS, ptsAllowedPg).
  const [tmOfficial, ptsAllowedPg] = teamId
    ? await Promise.all([fetchTeamStats(teamId, season), fetchTeamPtsAllowed(teamId, season)])
    : [null, null];

  const advRow = advancedRow(playerRow, I, tmOC, lg, totRow, tmOfficial);

  const tmForWS = wsGames > 0 ? {
    fgaPg:  totTm.fga  / wsGames,
    fgmPg:  totTm.fgm  / wsGames,
    fg3mPg: totTm.fg3m / wsGames,
    ftaPg:  totTm.fta  / wsGames,
    ftmPg:  totTm.ftm  / wsGames,
    ptsPg:  totTm.pts  / wsGames,
    orbPg:  totTm.orb  / wsGames,
    drbPg:  totTm.drb  / wsGames,
    tovPg:  totTm.tov  / wsGames,
    astPg:  totTm.ast  / wsGames,
  } : null;
  const officialPace = tmOfficial
    ? (tmOfficial.fgaPg ?? 0) - (tmOfficial.orbPg ?? 0) + (tmOfficial.tovPg ?? 0) + 0.44*(tmOfficial.ftaPg ?? 0)
    : null;
  // Use official team stats for OWS — more consistent across seasons than boxscore-derived stats.
  // Boxscore approach is conceptually correct (player-game restriction) but doesn't improve
  // accuracy because the root issue is ESPN vs BRef source data divergence, not sampling.
  const tmForOWS = tmOfficial ?? tmForWS;
  const wsVals = (tmForOWS && lg && ptsAllowedPg != null)
    ? computeWinShares(playerRow, I, tmForOWS, lg, ptsAllowedPg, officialPace)
    : [null, null, null, null];

  const row = [...advRow.slice(0, 16), ...wsVals];
  return { row, pbpGames };
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
  const careerRow  = ADV_HEADERS_SRV.map(h => {
    if (h === 'SEASON_ID') return 'Career';
    if (h === 'TEAM_ABBREVIATION') return '';
    if (h === 'GP')       return careerGP;
    if (h === 'OWS')      return careerOWS;
    if (h === 'DWS')      return careerDWS;
    if (h === 'WS')       return careerWS;
    if (h === 'WS_PER48') return careerWS48;
    return null;
  });
  return { rows: valid.map(r => r.row), careerRow };
}

module.exports = {
  ADV_HEADERS_SRV, ADV_I,
  advancedRow, buildAdvancedSplit, buildAdvancedCareer, computeSeasonPBP, buildPbpSplit,
};
