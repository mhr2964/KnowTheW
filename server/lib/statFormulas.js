const { GAME_MINUTES } = require('../constants/leagueAverages');

// BRef Win Shares (Oliver methodology).
// tm: team stats used for OWS (PProd, coefficients). Should be aligned to player games.
// ptsAllowedPg: average opponent pts (official, all team games) for DWS.
// officialPace: optional override for tmPace — PBP-derived pace can undercount in older seasons.
function computeWinShares(playerRow, I, tm, lg, ptsAllowedPg, officialPace = null) {
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
  const pbpPace = (tm.fgaPg ?? 0) - (tm.orbPg ?? 0) + (tm.tovPg ?? 0) + 0.44*(tm.ftaPg ?? 0);
  const tmPace  = (officialPace != null && officialPace > 0) ? officialPace : pbpPace;
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

  // PProd_AST: BRef/Oliver exact formula — 3PM-adjusted teammates' eFG% × AST
  // Source: basketball-reference.com/about/ratings.html
  const tmFGA_excl   = (tm.fgaPg  ?? 0) - fga;
  const tmFGM_excl   = (tm.fgmPg  ?? 0) - fgm;
  const tmFG3M_excl  = (tm.fg3mPg ?? 0) - fg3m;
  const tmFGpts_excl = ((tm.ptsPg ?? 0) - (tm.ftmPg ?? 0)) - (pts - ftm);
  const PProd_AST = (tmFGpts_excl > 0 && tmFGA_excl > 0.01 && tmFGM_excl > 0.01)
    ? ((tmFGM_excl + 0.5 * tmFG3M_excl) / tmFGM_excl) * (tmFGpts_excl / (2 * tmFGA_excl)) * ast
    : 0;

  // Oliver team coefficients — Team_Scoring_Poss, TePl%, TeOR%, TeORW, coeff_a
  const tmFT_pct  = (tm.ftaPg ?? 0) > 0 ? (tm.ftmPg ?? 0) / tm.ftaPg : 0;
  const tmScPoss  = (tm.fgmPg ?? 0) + (1 - (1 - tmFT_pct) ** 2) * 0.4 * (tm.ftaPg ?? 0);
  const tmTotPoss = (tm.fgaPg ?? 0) + 0.4 * (tm.ftaPg ?? 0) + (tm.tovPg ?? 0);
  const tePl      = tmTotPoss > 0 ? tmScPoss / tmTotPoss : 0;
  const tmMissed  = (tm.fgaPg ?? 0) - (tm.fgmPg ?? 0);
  const teOrPct   = tmMissed > 0 ? (tm.orbPg ?? 0) / tmMissed : 0;
  const teOrW_n   = (1 - teOrPct) * tePl;
  const teOrW_d   = teOrW_n + (1 - tePl) * teOrPct;
  const teOrW     = teOrW_d > 0 ? teOrW_n / teOrW_d : 0;
  // coeff_a applies to (PProd_FG + PProd_AST + FTM); PProd_ORB is added outside
  const coeff_a   = tmScPoss > 0 ? 1 - ((tm.orbPg ?? 0) / tmScPoss) * teOrW * tePl : 1;

  // PProd_ORB: Oliver formula (outside coeff_a)
  const tmPtsPerScPoss = tmScPoss > 0 ? (tm.ptsPg ?? 0) / tmScPoss : 0;
  const PProd_ORB = orb * teOrW * tePl * tmPtsPerScPoss;

  const PProd = coeff_a * (PProd_FG + PProd_AST + ftm) + PProd_ORB;
  const Poss  = fga + 0.44*fta + tov - orb;
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

module.exports = { computeWinShares, computePER, computeBasicRatioStats };
