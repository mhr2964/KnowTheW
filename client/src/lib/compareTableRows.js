import { pickLeader } from './compareStats';
import { HIDDEN } from './statsColumns';

function rowToMap(headers, row) {
  if (!headers || !row) return {};
  return Object.fromEntries(headers.map((h, i) => [h, row[i]]));
}

// Flatten multi-team seasons for one player's rows to a single row per season.
// Uses TOT row when present; for multiple rows without TOT, picks the highest-GP row
// (the player's primary team that season). gpIdx is the column index of GP in the raw rows.
function flattenSeasons(rows, gpIdx) {
  const bySeasonId = new Map();
  for (const row of rows) {
    const sid = String(row[0]);
    if (!bySeasonId.has(sid)) {
      bySeasonId.set(sid, []);
    }
    bySeasonId.get(sid).push(row);
  }
  const flat = new Map();
  for (const [sid, seasonRows] of bySeasonId) {
    const totRow = seasonRows.find(r => String(r[1]) === 'TOT');
    if (totRow) {
      flat.set(sid, totRow);
    } else if (seasonRows.length === 1) {
      flat.set(sid, seasonRows[0]);
    } else if (gpIdx === -1) {
      // GP column not present — unknown shape, safest default
      if (import.meta.env.DEV) {
        console.warn(`[compareTableRows] No TOT row for season ${sid} and GP column not found; using first row.`);
      }
      flat.set(sid, seasonRows[0]);
    } else {
      const best = seasonRows.reduce((a, b) => Number(b[gpIdx]) > Number(a[gpIdx]) ? b : a);
      if (import.meta.env.DEV) {
        console.warn(`[compareTableRows] No TOT row for season ${sid}, using highest-GP fallback. Team: ${best[1]}`);
      }
      flat.set(sid, best);
    }
  }
  return flat;
}

// Build a merged column list from two headers arrays.
// When one side has no headers (player lacks data), falls back to the other side.
// When both present, uses the intersection preserving headersA order.
// Emits a dev warning when they diverge.
function mergeHeaders(headersA, headersB) {
  const aHas = headersA && headersA.length > 0;
  const bHas = headersB && headersB.length > 0;
  if (!aHas && !bHas) return [];
  if (!aHas) return headersB.filter(h => !HIDDEN.has(h));
  if (!bHas) return headersA.filter(h => !HIDDEN.has(h));

  const setB = new Set(headersB);
  const missing = headersA.filter(h => !setB.has(h));
  if (import.meta.env.DEV && missing.length > 0) {
    console.warn('[compareTableRows] Headers diverge. Missing from B:', missing);
  }
  const setA = new Set(headersA);
  const missingA = headersB.filter(h => !setA.has(h));
  if (import.meta.env.DEV && missingA.length > 0) {
    console.warn('[compareTableRows] Headers diverge. Missing from A:', missingA);
  }
  // Intersection in headersA order
  return headersA.filter(h => setB.has(h) && !HIDDEN.has(h));
}

// Main builder. Returns { headers, mergedRows, mergedCareerRow }.
//
// headersA/headersB: string[]
// rowsA/rowsB: any[][] — season rows where row[0]=SEASON_ID, row[1]=TEAM_ABBREVIATION
// careerRowA/careerRowB: any[] | null
export function buildMergedRows({ headersA, rowsA, careerRowA, headersB, rowsB, careerRowB }) {
  const headers = mergeHeaders(headersA ?? [], headersB ?? []);

  const gpIdxA = headersA ? headersA.indexOf('GP') : -1;
  const gpIdxB = headersB ? headersB.indexOf('GP') : -1;
  const flatA = flattenSeasons(rowsA ?? [], gpIdxA);
  const flatB = flattenSeasons(rowsB ?? [], gpIdxB);

  // Union of season IDs, sorted descending
  const allSeasons = [...new Set([...flatA.keys(), ...flatB.keys()])]
    .sort((a, b) => b.localeCompare(a));

  const safeHeadersA = headersA && headersA.length > 0 ? headersA : null;
  const safeHeadersB = headersB && headersB.length > 0 ? headersB : null;

  const mergedRows = allSeasons.map(sid => {
    const rowA = flatA.get(sid) ?? null;
    const rowB = flatB.get(sid) ?? null;
    const mapA = (rowA && safeHeadersA) ? rowToMap(safeHeadersA, rowA) : null;
    const mapB = (rowB && safeHeadersB) ? rowToMap(safeHeadersB, rowB) : null;
    return {
      seasonId: sid,
      a: { row: mapA, present: rowA !== null && safeHeadersA !== null, team: mapA ? String(mapA['TEAM_ABBREVIATION'] ?? '') : null },
      b: { row: mapB, present: rowB !== null && safeHeadersB !== null, team: mapB ? String(mapB['TEAM_ABBREVIATION'] ?? '') : null },
    };
  });

  // Career row
  const careerMapA = (careerRowA && safeHeadersA) ? rowToMap(safeHeadersA, careerRowA) : null;
  const careerMapB = (careerRowB && safeHeadersB) ? rowToMap(safeHeadersB, careerRowB) : null;
  const mergedCareerRow = (careerMapA || careerMapB) ? {
    seasonId: 'Career',
    a: { row: careerMapA, present: careerMapA !== null, team: null },
    b: { row: careerMapB, present: careerMapB !== null, team: null },
  } : null;

  // Attach per-stat leader info to each merged row
  function attachLeaders(merged) {
    const { a, b } = merged;
    if (!a.present || !b.present) return merged;
    const leaders = {};
    for (const h of headers) {
      if (h === 'SEASON_ID' || h === 'TEAM_ABBREVIATION') continue;
      leaders[h] = pickLeader(a.row, b.row, h);
    }
    return { ...merged, leaders };
  }

  return {
    headers,
    mergedRows: mergedRows.map(attachLeaders),
    mergedCareerRow: mergedCareerRow ? attachLeaders(mergedCareerRow) : null,
  };
}
