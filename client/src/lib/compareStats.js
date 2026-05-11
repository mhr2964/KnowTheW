export const LOWER_BETTER = new Set(['TOV', 'TOV_PCT', 'PF']);

// rowA, rowB are objects keyed by raw header name.
// statKey is the raw header key (e.g. 'PTS', 'FG_PCT', 'TOV_PCT').
// Returns 'a' | 'b' | null (null when equal, either missing, or non-numeric).
export function pickLeader(rowA, rowB, statKey) {
  const vA = rowA?.[statKey];
  const vB = rowB?.[statKey];
  if (typeof vA !== 'number' || typeof vB !== 'number') return null;
  if (vA === vB) return null;
  const lowerBetter = LOWER_BETTER.has(statKey);
  if (lowerBetter) return vA < vB ? 'a' : 'b';
  return vA > vB ? 'a' : 'b';
}
