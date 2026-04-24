// Diagnoses OWS errors by printing the raw team context (tmForWS) for specific seasons.
// Compares against what BRef implies from the known OWS value.
import { WNBA_LG, GAME_MINUTES } from '../server/constants/leagueAverages.js';

const API = 'http://localhost:5000/api';

// Ogwumike seasons with big OWS error — what does the raw team context look like?
// We'll fetch the advanced-pbp-all response and then re-derive what tmForWS must be
// by working backwards from the computed OWS, then compare to what's plausible.

// Add a debug route approach: hit the ESPN stats endpoint directly and compute manually.
// For now, let's look at the BRef-implied PProd margin and see if we can identify the driver.

// BRef OWS formula: OWS = margOff * G / ptsPerWin
// margOff = PProd - 0.92 * VOP * Poss
// ptsPerWin = 0.32 * lg.pts * (tmPace / lgPace)

const BREF_OWS = {
  Ogwumike: { 2012: 4.3, 2013: 4.4, 2016: 7.0, 2017: 5.5, 2022: 3.1, 2023: 3.1, 2024: 3.7, 2025: 3.3 }
};

// Player stats from BRef totals
const PLAYER_STATS = {
  Ogwumike: {
    2012: { fga: 333, fgm: 178, fg3m: 1,  fta: 143, ftm: 105, orb: 98,  tov: 42,  ast: 40, pts: 462,  gp: 33, mp: 27.9 },
    2013: { fga: 339, fgm: 192, fg3m: 2,  fta: 132, ftm: 109, orb: 95,  tov: 66,  ast: 45, pts: 495,  gp: 34, mp: 25.8 },
    2016: { fga: 367, fgm: 244, fg3m: 16, fta: 168, ftm: 146, orb: 77,  tov: 70,  ast: 101, pts: 650, gp: 33, mp: 31.6 },
    2017: { fga: 435, fgm: 244, fg3m: 18, fta: 154, ftm: 134, orb: 61,  tov: 52,  ast: 72,  pts: 640, gp: 34, mp: 30.9 },
    2022: { fga: 458, fgm: 249, fg3m: 21, fta: 115, ftm: 95,  orb: 48,  tov: 62,  ast: 68,  pts: 614, gp: 34, mp: 31.4 },
    2023: { fga: 516, fgm: 264, fg3m: 21, fta: 161, ftm: 140, orb: 60,  tov: 80,  ast: 97,  pts: 689, gp: 36, mp: 31.1 },
    2024: { fga: 493, fgm: 252, fg3m: 30, fta: 97,  ftm: 85,  orb: 69,  tov: 49,  ast: 86,  pts: 619, gp: 37, mp: 31.8 },
    2025: { fga: 617, fgm: 320, fg3m: 66, fta: 118, ftm: 97,  orb: 59,  tov: 85,  ast: 99,  pts: 803, gp: 44, mp: 30.9 },
  }
};

function computeOWS_implied(season, player, brefOWS) {
  const s = String(season);
  const lg = WNBA_LG[s];
  if (!lg) return;
  const p = player[season];
  if (!p) return;

  const VOP    = lg.pts / (lg.fga - lg.orb + lg.tov + 0.44*lg.fta);
  const lgPace = lg.fga - lg.orb + lg.tov + 0.44*lg.fta;
  const lgORtg = 100 * lg.pts / lgPace;
  // Use a placeholder tmPace = lgPace (we don't have the exact official pace here)
  // ptsPerWin = 0.32 * lg.pts * (tmPace / lgPace) ≈ 0.32 * lg.pts when tmPace ≈ lgPace

  // Work backwards from BRef OWS to get implied margOff per game
  // OWS = margOff_total / ptsPerWin, where margOff_total = margOff_pg * gp
  // We'll estimate ptsPerWin ≈ 0.32 * lg.pts (tmPace ≈ lgPace)
  const ptsPerWinApprox = 0.32 * lg.pts;
  const impliedMargOff  = brefOWS * ptsPerWinApprox / p.gp;

  // Player possessions per game
  const fgaPg = p.fga / p.gp, fgmPg = p.fgm / p.gp;
  const fg3mPg = p.fg3m / p.gp, ftaPg = p.fta / p.gp, ftmPg = p.ftm / p.gp;
  const orbPg = p.orb / p.gp, tovPg = p.tov / p.gp, astPg = p.ast / p.gp, ptsPg = p.pts / p.gp;
  const Poss = fgaPg + 0.44*ftaPg + tovPg - orbPg;

  // Implied PProd per game = impliedMargOff + 0.92 * VOP * Poss
  const impliedPProd = impliedMargOff + 0.92 * VOP * Poss;

  // Compute our PProd with qAST=0 (simplified, to check scale)
  const eFG = (ptsPg - ftmPg) / (2 * fgaPg);
  const PProd_FG_noAST = 2 * (fgmPg + 0.5*fg3mPg);
  const PProd_FT = ftmPg;

  console.log(`\n${season}: BRef OWS=${brefOWS}`);
  console.log(`  VOP=${VOP.toFixed(3)}, lgPace=${lgPace.toFixed(1)}, ptsPerWin≈${ptsPerWinApprox.toFixed(2)}`);
  console.log(`  Poss/g=${Poss.toFixed(2)}, eFG=${eFG.toFixed(3)}`);
  console.log(`  Implied margOff/g=${impliedMargOff.toFixed(3)}`);
  console.log(`  Implied PProd/g=${impliedPProd.toFixed(3)}`);
  console.log(`  PProd_FG (qAST=0)=${PProd_FG_noAST.toFixed(3)}, PProd_FT=${PProd_FT.toFixed(3)}`);
  console.log(`  Min PProd (FG+FT, no AST/ORB)=${(PProd_FG_noAST+PProd_FT).toFixed(3)}`);
}

console.log('=== Ogwumike OWS Diagnostics ===');
for (const season of [2012, 2013, 2016, 2022, 2023, 2025]) {
  computeOWS_implied(season, PLAYER_STATS.Ogwumike, BREF_OWS.Ogwumike[season]);
}
