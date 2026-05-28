// Pure aggregation of per-game on-court PBP accumulators into season-level shooting and
// playmaking stats. No I/O — callers supply the pbpResults array from getGamePbpStats.

'use strict';

const MIN_ON_GAMES = 5;

function r3(v) { return Math.round(v * 1000) / 1000; }
function r1(v) { return Math.round(v * 10) / 10; }

/**
 * Aggregate per-game on-court stats into season-level shooting/playmaking metrics.
 * @param {Array<{fetched:boolean, onCourt:object|null}>} pbpResults
 * @returns {{games:number, fga:number, fgm:number, fg3a:number, fg3m:number,
 *   fta:number, ftm:number, pts:number,
 *   fgPct:number|null, fg3Pct:number|null, ftPct:number|null,
 *   efgPct:number|null, tsPct:number|null, fg3aRate:number|null, ftr:number|null,
 *   astPg:number, tovPg:number, orbPg:number, drbPg:number, ptsPg:number}|null}
 */
function computePbpStats(pbpResults) {
  let fga = 0, fgm = 0, fg3a = 0, fg3m = 0, fta = 0, ftm = 0;
  let orb = 0, drb = 0, tov = 0, ast = 0, pts = 0;
  let games = 0;

  for (const r of pbpResults) {
    if (!r.fetched || !r.onCourt) continue;
    const oc = r.onCourt;
    fga  += oc.fga  ?? 0;
    fgm  += oc.fgm  ?? 0;
    fg3a += oc.fg3a ?? 0;
    fg3m += oc.fg3m ?? 0;
    fta  += oc.fta  ?? 0;
    ftm  += oc.ftm  ?? 0;
    orb  += oc.orb  ?? 0;
    drb  += oc.drb  ?? 0;
    tov  += oc.tov  ?? 0;
    ast  += oc.ast  ?? 0;
    pts  += oc.pts  ?? 0;
    games++;
  }

  if (games < MIN_ON_GAMES) return null;

  return {
    games,
    fga, fgm, fg3a, fg3m, fta, ftm, pts,
    fgPct:    fga > 0 ? r3(fgm / fga)                        : null,
    fg3Pct:   fg3a > 0 ? r3(fg3m / fg3a)                     : null,
    ftPct:    fta > 0 ? r3(ftm / fta)                        : null,
    efgPct:   fga > 0 ? r3((fgm + 0.5 * fg3m) / fga)        : null,
    tsPct:    (fga + 0.44 * fta) > 0
                ? r3(pts / (2 * (fga + 0.44 * fta)))          : null,
    fg3aRate: fga > 0 ? r3(fg3a / fga)                       : null,
    ftr:      fga > 0 ? r3(fta / fga)                        : null,
    astPg:  r1(ast / games),
    tovPg:  r1(tov / games),
    orbPg:  r1(orb / games),
    drbPg:  r1(drb / games),
    ptsPg:  r1(pts / games),
  };
}

module.exports = { computePbpStats, MIN_ON_GAMES };
