// Pure aggregation for the BBRef-style PBP season table.
// computePbpTableRow  — one season row from pbpResults + season metadata
// computeCareerRow    — career aggregation across season rows
// No I/O; callers supply the data.

'use strict';

const { computeOnOff } = require('./onOff');

const PBP_TABLE_HEADERS = [
  'SEASON_ID', 'TEAM_ABBREVIATION', 'AGE', 'GP', 'MIN',
  'ON_COURT', 'ON_OFF',
  'BAD_PASS', 'LOST_BALL',
  'FOUL_COMMIT_SHOOT', 'FOUL_COMMIT_OFF',
  'FOUL_DRAWN_SHOOT', 'FOUL_DRAWN_OFF',
  'PGA', 'AND1', 'BLKD',
];

// VOL_COLS: always-number volume columns (provider always supplies a value, never null).
const VOL_COLS = ['BAD_PASS', 'LOST_BALL', 'FOUL_COMMIT_SHOOT', 'FOUL_COMMIT_OFF',
                  'FOUL_DRAWN_SHOOT', 'PGA', 'AND1'];
// NULLABLE_VOL_COLS: columns a provider may not support (null = not available from this source).
// Accumulate only when non-null so the season total stays null if no games provide a value.
const NULLABLE_VOL_COLS = ['FOUL_DRAWN_OFF', 'BLKD'];
const H_IDX = Object.fromEntries(PBP_TABLE_HEADERS.map((h, i) => [h, i]));

function r1(v) { return v != null ? Math.round(v * 10) / 10 : null; }

/**
 * Build one table row from a season's pbpResults + metadata.
 * @param {Array} pbpResults
 * @param {{season:string|number, team:string, age:number|null, gp:number, minutes:number}} meta
 * @returns {Array|null}  Row aligned to PBP_TABLE_HEADERS, or null if no usable games.
 */
function computePbpTableRow(pbpResults, meta) {
  const onoff = computeOnOff(pbpResults);
  if (!onoff) return null;

  let badPassTov = 0, lostBallTov = 0;
  let foulCommitShoot = 0, foulCommitOff = 0, foulDrawnShoot = 0;
  let pga = 0, and1 = 0;
  let foulDrawnOff = null, blkd = null; // nullable: null if provider cannot supply

  for (const r of pbpResults) {
    if (!r.fetched || !r.onCourt) continue;
    const oc = r.onCourt;
    badPassTov      += oc.badPassTov      ?? 0;
    lostBallTov     += oc.lostBallTov     ?? 0;
    foulCommitShoot += oc.foulCommitShoot ?? 0;
    foulCommitOff   += oc.foulCommitOff   ?? 0;
    foulDrawnShoot  += oc.foulDrawnShoot  ?? 0;
    pga             += oc.pga             ?? 0;
    and1            += oc.and1            ?? 0;
    // Nullable fields: only accumulate when the provider supplies a real value
    if (oc.foulDrawnOff != null) foulDrawnOff = (foulDrawnOff ?? 0) + oc.foulDrawnOff;
    if (oc.blkd         != null) blkd         = (blkd         ?? 0) + oc.blkd;
  }

  const row = new Array(PBP_TABLE_HEADERS.length).fill(null);
  row[H_IDX.SEASON_ID]          = meta.season;
  row[H_IDX.TEAM_ABBREVIATION]  = meta.team;
  row[H_IDX.AGE]                = meta.age;
  row[H_IDX.GP]                 = meta.gp;
  row[H_IDX.MIN]                = meta.minutes;
  row[H_IDX.ON_COURT]           = r1(onoff.on.net);
  row[H_IDX.ON_OFF]             = r1(onoff.delta);
  row[H_IDX.BAD_PASS]           = badPassTov;
  row[H_IDX.LOST_BALL]          = lostBallTov;
  row[H_IDX.FOUL_COMMIT_SHOOT]  = foulCommitShoot;
  row[H_IDX.FOUL_COMMIT_OFF]    = foulCommitOff;
  row[H_IDX.FOUL_DRAWN_SHOOT]   = foulDrawnShoot;
  row[H_IDX.FOUL_DRAWN_OFF]     = foulDrawnOff;
  row[H_IDX.PGA]                = pga;
  row[H_IDX.AND1]               = and1;
  row[H_IDX.BLKD]               = blkd;
  return row;
}

/**
 * Aggregate season rows into a career summary row.
 * Volume columns are summed; ON_COURT and ON_OFF are games-weighted averages.
 * @param {Array[]} rows  Season rows aligned to PBP_TABLE_HEADERS (no nulls in the array).
 * @returns {Array|null}
 */
function computeCareerRow(rows) {
  if (!rows.length) return null;

  const careerRow = new Array(PBP_TABLE_HEADERS.length).fill(null);
  careerRow[H_IDX.SEASON_ID]         = 'Career';
  careerRow[H_IDX.TEAM_ABBREVIATION] = null;
  careerRow[H_IDX.AGE]               = null;

  let totalGp = 0, totalMin = 0;
  let weightedOnCourt = 0, weightedOnOff = 0, weightGames = 0;

  for (const r of rows) {
    const gp  = r[H_IDX.GP]  ?? 0;
    const min = r[H_IDX.MIN] ?? 0;
    totalGp  += gp;
    totalMin += min;
    const oc  = r[H_IDX.ON_COURT];
    const oo  = r[H_IDX.ON_OFF];
    if (oc != null && oo != null) {
      weightedOnCourt += oc * gp;
      weightedOnOff   += oo * gp;
      weightGames     += gp;
    }
    for (const col of VOL_COLS) {
      careerRow[H_IDX[col]] = (careerRow[H_IDX[col]] ?? 0) + (r[H_IDX[col]] ?? 0);
    }
    for (const col of NULLABLE_VOL_COLS) {
      const v = r[H_IDX[col]];
      if (v != null) careerRow[H_IDX[col]] = (careerRow[H_IDX[col]] ?? 0) + v;
    }
  }

  careerRow[H_IDX.GP]       = totalGp;
  careerRow[H_IDX.MIN]      = totalMin;
  careerRow[H_IDX.ON_COURT] = weightGames > 0 ? r1(weightedOnCourt / weightGames) : null;
  careerRow[H_IDX.ON_OFF]   = weightGames > 0 ? r1(weightedOnOff   / weightGames) : null;
  return careerRow;
}

module.exports = { computePbpTableRow, computeCareerRow, PBP_TABLE_HEADERS };
