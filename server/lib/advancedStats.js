const { GAME_MINUTES, WNBA_LG } = require('../constants/leagueAverages');
const { ESPN_WEB, fetchGameSummary, fetchTeamStats } = require('./espnClient');

const ADV_HEADERS_SRV = [
  'SEASON_ID', 'TEAM_ABBREVIATION', 'GP',
  'TS_PCT', 'EFG_PCT', 'TPAr', 'FTr', 'TOV_PCT',
  'USG_PCT', 'AST_PCT',
  'ORB_PCT', 'DRB_PCT', 'TRB_PCT',
  'STL_PCT', 'BLK_PCT',
  'PER',
  'OWS', 'DWS', 'WS', 'WS_PER48',
];

const PBP_OC_KEYS = ['fga','fgm','fg3a','fta','ftm','orb','drb','tov','ast',
                     'oFga','oFgm','oFg3a','oFta','oOrb','oDrb','oTov'];

// BRef Win Shares (Oliver methodology).
// tm must be season-average team stats (from fetchTeamStats, including ptsPg/fg3mPg/ftmPg).
// ptsAllowedPg is the team's average opponent score for regular-season games.
function computeWinShares(playerRow, I, tm, lg, ptsAllowedPg) {
  const fga = playerRow[I.FGA] ?? 0, fgm = playerRow[I.FGM] ?? 0;
  const fg3m = playerRow[I.FG3M] ?? 0;
  const fta  = playerRow[I.FTA] ?? 0, ftm = playerRow[I.FTM] ?? 0;
  const orb  = playerRow[I.OREB] ?? 0;
  const ast  = playerRow[I.AST] ?? 0;
  const tov  = playerRow[I.TOV] ?? 0;
  const pts  = playerRow[I.PTS] ?? 0, mp = playerRow[I.MIN] ?? 0;
  const gp   = playerRow[I.GP]  ?? 0;

  if (mp <= 0 || gp <= 0 || !tm || !lg || ptsAllowedPg == null) return [null, null, null, null];

  const VOP    = lg.pts / (lg.fga - lg.orb + lg.tov + 0.44*lg.fta);
  const lgPace = lg.fga - lg.orb + lg.tov + 0.44*lg.fta;
  const tmPace = (tm.fgaPg ?? 0) - (tm.orbPg ?? 0) + (tm.tovPg ?? 0) + 0.44*(tm.ftaPg ?? 0);
  const lgORtg = 100 * lg.pts / lgPace;
  if (tmPace <= 0) return [null, null, null, null];

  const ptsPerWin = 0.32 * lg.pts * (tmPace / lgPace);

  // qAST: estimated fraction of player's FGM that were assisted by a teammate
  const perMp    = mp / GAME_MINUTES;
  const denomFgm = (tm.fgmPg ?? 0) * perMp - fgm;
  let qAST = 0;
  if ((tm.fgmPg ?? 0) > 0.01) {
    const t1 = perMp * 1.14 * (((tm.astPg ?? 0) - ast) / tm.fgmPg);
    const t2 = Math.abs(denomFgm) > 0.01
      ? (((tm.astPg ?? 0) * perMp - ast) / denomFgm) * (1 - perMp) : 0;
    qAST = Math.max(0, Math.min(1, t1 + t2));
  }

  // PProd_FG: player's own field goal production (credit reduced when heavily assisted)
  const PProd_FG = fga > 0
    ? 2 * (fgm + 0.5*fg3m) * (1 - 0.5 * ((pts - ftm) / (2*fga)) * qAST)
    : 0;

  // PProd_AST: points produced via assists (BRef formula)
  const tmFGM_excl  = (tm.fgmPg  ?? 0) - fgm;
  const tmFGA_excl  = (tm.fgaPg  ?? 0) - fga;
  const tmFG3M_excl = (tm.fg3mPg ?? 0) - fg3m;
  const tmFGpts_excl = ((tm.ptsPg ?? 0) - (tm.ftmPg ?? 0)) - (pts - ftm);
  let PProd_AST = 0;
  if (tmFGM_excl > 0.01 && tmFGA_excl > 0.01) {
    PProd_AST = 2 * ((tmFGM_excl + 0.5*tmFG3M_excl) / tmFGM_excl)
      * 0.5 * (tmFGpts_excl / (2 * tmFGA_excl))
      * ast;
  }

  // PProd_ORB: value added by offensive rebounds (extend possession)
  const orbDenom = 5 * (tm.orbPg ?? 0) - orb;
  const PProd_ORB = orbDenom > 0.01
    ? orb * 0.5 * (0.5 * (((tm.orbPg ?? 0) + lg.drb) / orbDenom))
    : 0;

  // PProd_FT: free throw production (BRef: adjusted for team assist rate)
  const tmRatio = (tm.fgmPg ?? 0) > 0 ? (tm.astPg ?? 0) / tm.fgmPg : 0;
  const PProd_FT = ftm * (1 - 0.25 * tmRatio);

  const PProd = PProd_FG + PProd_AST + PProd_ORB + PProd_FT;
  const Poss  = fga + 0.44*fta + tov;
  const margOff = PProd - 0.92 * VOP * Poss;
  const ows = ptsPerWin > 0 ? (margOff * gp) / ptsPerWin : null;

  const tmDRtg  = 100 * ptsAllowedPg / tmPace;
  const margDef = (mp / (5 * GAME_MINUTES)) * tmPace * (1.08 * (lgORtg/100) - (tmDRtg/100)) * gp;
  const dws = ptsPerWin > 0 ? Math.max(0, margDef) / ptsPerWin : null;

  const ws      = (ows ?? 0) + (dws ?? 0);
  const totalMin = mp * gp;
  // BRef labels this WS/48 even for WNBA (40-min games)
  const wsPer48 = totalMin > 0 ? ws / (totalMin / 48) : null;

  return [ows, dws, ws, wsPer48];
}

function computePER(mp, fga, fgm, fg3m, fta, ftm, orb, trb, stl, blk, tov, ast, pf, tmRatio, tmPace, lg) {
  const VOP   = lg.pts / (lg.fga - lg.orb + lg.tov + 0.44*lg.fta);
  const DRBP  = lg.drb / lg.trb;
  const factor = (2/3) - (0.5 * lg.ast/lg.fgm) / (2 * lg.fgm/lg.ftm);
  const uPER = (1/mp) * (
    fg3m + (2/3)*ast + (2 - factor*tmRatio)*fgm
    + ftm * 0.5 * (1 + (1-tmRatio) + (2/3)*tmRatio)
    - VOP*tov - VOP*DRBP*(fga-fgm)
    - VOP*0.44*(0.44+0.56*DRBP)*(fta-ftm)
    + VOP*(1-DRBP)*(trb-orb) + VOP*DRBP*orb
    + VOP*stl + VOP*DRBP*blk
    - pf*(lg.ftm/lg.pf - 0.44*(lg.fta/lg.pf)*VOP)
  );
  const lgPace = lg.fga - lg.orb + lg.tov + 0.44*lg.fta;
  const aPER   = tmPace > 0 ? (lgPace / tmPace) * uPER : uPER;
  const lgTmR  = lg.ast / lg.fgm;
  const lgFact = (2/3) - (0.5*lgTmR) / (2*lg.fgm/lg.ftm);
  const s = n => n / 5;
  const lgUPER = (1/GAME_MINUTES) * (
    s(lg.fg3m) + (2/3)*s(lg.ast) + (2-lgFact*lgTmR)*s(lg.fgm)
    + s(lg.ftm)*0.5*(1+(1-lgTmR)+(2/3)*lgTmR)
    - VOP*s(lg.tov) - VOP*DRBP*(s(lg.fga)-s(lg.fgm))
    - VOP*0.44*(0.44+0.56*DRBP)*(s(lg.fta)-s(lg.ftm))
    + VOP*(1-DRBP)*s(lg.drb) + VOP*DRBP*s(lg.orb)
    + VOP*s(lg.stl) + VOP*DRBP*s(lg.blk)
    - s(lg.pf)*(lg.ftm/lg.pf - 0.44*(lg.fta/lg.pf)*VOP)
  );
  return lgUPER > 0 ? (15 / lgUPER) * aPER : null;
}

function computeBasicRatioStats(fga, fgm, fg3m, fg3a, fta, pts, tov) {
  const ts     = (fga + 0.44*fta) > 0 ? pts / (2*(fga + 0.44*fta)) : null;
  const efg    = fga > 0 ? (fgm + 0.5*fg3m) / fga : null;
  const tpar   = fga > 0 ? fg3a / fga : null;
  const ftr    = fga > 0 ? fta / fga : null;
  const poss   = fga + 0.44*fta + tov;
  const tovPct = poss > 0 ? tov / poss : null;
  return { ts, efg, tpar, ftr, tovPct };
}

// Walk ESPN PBP to accumulate team and opponent stats while target player is on court.
// Returns { fga, fgm, fg3a, ftm, fta, orb, drb, tov, ast,
//           oFga, oFgm, oFg3a, oFta, oOrb, oDrb, oTov } or null if player not found.
function computeOnCourtStats(summary, targetPlayerId) {
  const pid = String(targetPlayerId);

  let targetTeamId = null;
  for (const teamData of summary.boxscore?.players ?? []) {
    for (const sg of teamData.statistics ?? []) {
      if (sg.athletes?.some(a => String(a.athlete.id) === pid)) {
        targetTeamId = String(teamData.team.id);
        break;
      }
    }
    if (targetTeamId) break;
  }
  if (!targetTeamId) return null;

  const onCourt = {};
  for (const teamData of summary.boxscore?.players ?? []) {
    const tid = String(teamData.team.id);
    onCourt[tid] = new Set();
    for (const sg of teamData.statistics ?? []) {
      for (const athlete of sg.athletes ?? []) {
        if (athlete.starter) onCourt[tid].add(String(athlete.athlete.id));
      }
    }
  }

  const oc = {
    fga: 0, fgm: 0, fg3a: 0, fta: 0, ftm: 0, orb: 0, drb: 0, tov: 0, ast: 0,
    oFga: 0, oFgm: 0, oFg3a: 0, oFta: 0, oOrb: 0, oDrb: 0, oTov: 0,
  };

  const plays = [...(summary.plays ?? [])].sort(
    (a, b) => parseInt(a.sequenceNumber) - parseInt(b.sequenceNumber)
  );

  for (const play of plays) {
    const playTeam = String(play.team?.id ?? '');
    const parts = play.participants ?? [];

    if (play.type?.text === 'Substitution' && parts.length >= 2) {
      if (onCourt[playTeam]) {
        onCourt[playTeam].add(String(parts[0].athlete.id));
        onCourt[playTeam].delete(String(parts[1].athlete.id));
      }
      continue;
    }

    if (!onCourt[targetTeamId]?.has(pid)) continue;

    // WNBA PBP: field goals use shootingPlay+scoreValue; pointsAttempted=1 only for FTs
    const isFT  = play.pointsAttempted === 1;
    const isFGA = play.shootingPlay && !isFT;
    const made  = play.scoringPlay;
    const sv    = play.scoreValue ?? 0;
    const is3   = isFGA && (sv === 3 || play.text?.toLowerCase().includes('three point'));

    // Team rebounds (no participants = deadball, shot-clock, OOB) are not
    // contested by individuals — exclude them from all rebound tallies.
    const isPlayerRebound = parts.length > 0;

    if (playTeam === targetTeamId) {
      if (isFGA) { oc.fga++; if (is3) oc.fg3a++; if (made) oc.fgm++; }
      else if (isFT) { oc.fta++; if (made) oc.ftm++; }
      if (isPlayerRebound) {
        if (play.type?.text === 'Offensive Rebound')      oc.orb++;
        else if (play.type?.text === 'Defensive Rebound') oc.drb++;
      }
      if (play.type?.text?.includes('Turnover'))          oc.tov++;
      if (isFGA && made && parts.length >= 2)             oc.ast++;
    } else {
      if (isFGA) { oc.oFga++; if (is3) oc.oFg3a++; if (made) oc.oFgm++; }
      else if (isFT) oc.oFta++;
      if (isPlayerRebound) {
        if (play.type?.text === 'Offensive Rebound')      oc.oOrb++;
        else if (play.type?.text === 'Defensive Rebound') oc.oDrb++;
      }
      if (play.type?.text?.includes('Turnover'))          oc.oTov++;
    }
  }

  return oc;
}

function advancedRow(row, I, tm, lg, totRow) {
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
      const tmPoss = tm.fgaPg + 0.44*tm.ftaPg + tm.tovPg;
      if (tmPoss > 0) usgPct = (fga + 0.44*fta + tov) / tmPoss;

      const tmFgmAdj = tm.fgmPg - fgm;
      if (tmFgmAdj > 0) astPct = ast / tmFgmAdj;

      const orbD = tm.orbPg + tm.oDrbPg;
      if (orbD > 0) orbPct = orb / orbD;

      const drbD = tm.drbPg + tm.oOrbPg;
      if (drbD > 0) drbPct = drb / drbD;

      const trbD = tm.orbPg + tm.drbPg + tm.oOrbPg + tm.oDrbPg;
      if (trbD > 0) trbPct = trb / trbD;

      const oppPoss = tm.oFgaPg + 0.44*tm.oFtaPg + tm.oTovPg - tm.oOrbPg;
      if (oppPoss > 0) stlPct = stl / oppPoss;

      const opp2PA = tm.oFgaPg - tm.oFg3aPg;
      if (opp2PA > 0) blkPct = blk / opp2PA;

      const tmRatio = tm.fgmPg > 0 ? tm.astPg / tm.fgmPg : 0;
      // Normalize on-court pace to per-40-min so it's on the same scale as lgPace
      const tmPace  = (tm.fgaPg - tm.orbPg + tm.tovPg + 0.44*tm.ftaPg) * (GAME_MINUTES / mp);
      per = computePER(mp, fga, fgm, fg3m, fta, ftm, orb, trb, stl, blk, tov, ast, pf, tmRatio, tmPace, lg);

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

async function computeSeasonPBP(playerId, season, playerRow, I, teamId, totRow) {
  const glData = await fetch(
    `${ESPN_WEB}/athletes/${playerId}/gamelog?season=${season}&seasontype=2`
  ).then(r => r.ok ? r.json() : null);
  if (!glData) return null;

  const eventIds = [];
  let ptsAllowedSum = 0, ptsAllowedCount = 0;
  (glData.seasonTypes || []).forEach(st => {
    if (!st.displayName?.includes('Regular Season')) return;
    (st.categories || []).forEach(cat => {
      (cat.events || []).forEach(evt => {
        if (evt.eventId) eventIds.push(evt.eventId);
        const meta = glData.events?.[evt.eventId];
        if (meta?.homeTeamScore != null && meta?.awayTeamScore != null) {
          const isHome = meta.atVs === 'vs';
          const opp = isHome ? parseInt(meta.awayTeamScore) : parseInt(meta.homeTeamScore);
          if (!isNaN(opp)) { ptsAllowedSum += opp; ptsAllowedCount++; }
        }
      });
    });
  });
  if (!eventIds.length) return null;

  const summaries = await Promise.all(eventIds.map(id => fetchGameSummary(id)));
  const totOC = Object.fromEntries(PBP_OC_KEYS.map(k => [k, 0]));
  let pbpGames = 0;
  for (const summary of summaries) {
    if (!summary) continue;
    const oc = computeOnCourtStats(summary, playerId);
    if (!oc) continue;
    pbpGames++;
    for (const k of PBP_OC_KEYS) totOC[k] += oc[k];
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
  const advRow = advancedRow(playerRow, I, tmOC, lg, totRow);

  // Win Shares: use season-avg team stats (not on-court) + pts allowed from gamelog
  const tmStats = teamId ? await fetchTeamStats(teamId, season) : null;
  const ptsAllowedPg = ptsAllowedCount > 0 ? ptsAllowedSum / ptsAllowedCount : null;
  const wsVals = (tmStats && ptsAllowedPg != null && lg)
    ? computeWinShares(playerRow, I, tmStats, lg, ptsAllowedPg)
    : [null, null, null, null];

  const row = [...advRow.slice(0, 16), ...wsVals];
  return { row, pbpGames };
}

module.exports = {
  ADV_HEADERS_SRV, PBP_OC_KEYS,
  computeBasicRatioStats, computePER, computeWinShares, computeOnCourtStats,
  advancedRow, buildAdvancedSplit, buildAdvancedCareer, computeSeasonPBP,
};
