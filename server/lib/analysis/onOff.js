// On/Off-Court Impact — "how does the team do with this player on vs off the floor?"
//
// Pure math over an array of per-game getGamePbpStats results (the same array advancedStats
// already builds). No I/O — test with synthetic game objects.
//
// On-court stats come from PBP (computeOnCourtStats accumulates them while the player is on the
// floor). Off-court stats are derived by subtracting the on-court totals from the official game
// boxscore totals so the two splits always add up to the full game.
//
// Net rating formula: (pts scored − pts allowed) / possessions × 100
// Possessions: FGA − ORB + TOV + 0.44 × FTA  (the Oliver approximation used throughout the app)

'use strict';

// Reject seasons with fewer usable PBP games — too noisy to report.
const MIN_ON_GAMES = 5;
const POSS_FT = 0.44;

/** Oliver-approximation possession estimate from counting stats. */
function poss(fga, orb, tov, fta) {
  return fga - orb + tov + POSS_FT * fta;
}

function safeRating(pts, p) {
  return p > 0 ? (pts / p) * 100 : null;
}

/**
 * Compute on/off net rating from an array of per-game PBP results.
 * @param {Array<{fetched:boolean, onCourt:object|null, boxscore:object|null}>} pbpResults
 *   The same array returned by `Promise.all(eventIds.map(getGamePbpStats))`.
 * @returns {{on:{ortg,drtg,net}, off:{ortg,drtg,net}, delta:number|null, games:number}|null}
 *   null when there are fewer than MIN_ON_GAMES usable games.
 */
function computeOnOff(pbpResults) {
  let onPts = 0, onOPts = 0;
  let onFga = 0, onOrb = 0, onTov = 0, onFta = 0;
  let onOFga = 0, onOOrb = 0, onOTov = 0, onOFta = 0;
  let gamePts = 0, gameOPts = 0;
  let gameFga = 0, gameOrb = 0, gameTov = 0, gameFta = 0;
  let gameOFga = 0, gameOOrb = 0, gameOTov = 0, gameOFta = 0;
  let games = 0;

  for (const r of pbpResults) {
    if (!r.fetched || !r.onCourt || !r.boxscore) continue;
    const oc = r.onCourt;
    const bx = r.boxscore;

    onPts  += oc.pts  ?? 0;
    onOPts += oc.oPts ?? 0;
    onFga  += oc.fga; onOrb += oc.orb; onTov += oc.tov; onFta += oc.fta;
    onOFga += oc.oFga; onOOrb += oc.oOrb; onOTov += oc.oTov; onOFta += oc.oFta;

    gamePts  += bx.tm.pts  ?? 0;
    gameOPts += bx.oppPts  ?? 0;
    gameFga  += bx.tm.fga  ?? 0;
    gameOrb  += bx.tm.orb  ?? 0;
    gameTov  += bx.tm.tov  ?? 0;
    gameFta  += bx.tm.fta  ?? 0;

    // Opponent boxscore stats for accurate off-court opponent possessions.
    if (bx.opp) {
      gameOFga  += bx.opp.fga ?? 0;
      gameOOrb  += bx.opp.orb ?? 0;
      gameOTov  += bx.opp.tov ?? 0;
      gameOFta  += bx.opp.fta ?? 0;
    }

    games++;
  }

  if (games < MIN_ON_GAMES) return null;

  // On-court ratings
  const onPoss  = poss(onFga,  onOrb,  onTov,  onFta);
  const onOPoss = poss(onOFga, onOOrb, onOTov, onOFta);
  const onORTG  = safeRating(onPts,  onPoss);
  const onDRTG  = safeRating(onOPts, onOPoss);
  const onNet   = onORTG != null && onDRTG != null ? onORTG - onDRTG : null;

  // Off-court: game total minus on-court
  const offPts  = gamePts  - onPts;
  const offOPts = gameOPts - onOPts;
  const offFga  = gameFga  - onFga;
  const offOrb  = gameOrb  - onOrb;
  const offTov  = gameTov  - onTov;
  const offFta  = gameFta  - onFta;
  const offPoss = poss(offFga, offOrb, offTov, offFta);

  // Off-court opponent possessions: use opponent boxscore when available, else approximate
  // from team off-court possessions (pace parity — both teams average ~same # possessions).
  const offOFga  = gameOFga  - onOFga;
  const offOOrb  = gameOOrb  - onOOrb;
  const offOTov  = gameOTov  - onOTov;
  const offOFta  = gameOFta  - onOFta;
  const offOPoss = gameOFga > 0
    ? poss(offOFga, offOOrb, offOTov, offOFta)
    : offPoss; // fallback: pace parity approximation

  const offORTG  = safeRating(offPts,  offPoss);
  const offDRTG  = safeRating(offOPts, offOPoss);
  const offNet   = offORTG != null && offDRTG != null ? offORTG - offDRTG : null;

  const delta = onNet != null && offNet != null ? onNet - offNet : null;

  function round1(v) { return v != null ? Math.round(v * 10) / 10 : null; }

  return {
    on:  { ortg: round1(onORTG),  drtg: round1(onDRTG),  net: round1(onNet)  },
    off: { ortg: round1(offORTG), drtg: round1(offDRTG), net: round1(offNet) },
    delta: round1(delta),
    games,
  };
}

module.exports = { computeOnOff, MIN_ON_GAMES, POSS_FT };
