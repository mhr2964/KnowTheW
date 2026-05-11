export const SUMMARY_STATS = ['GP', 'PTS', 'AST', 'REB', 'FG%', '3P%', 'FT%'];
export const LOWER_BETTER = new Set(['TOV']);

// Map from SUMMARY_STATS display key → raw API header key
export const SUMMARY_KEY_MAP = {
  GP:   'GP',
  PTS:  'PTS',
  AST:  'AST',
  REB:  'REB',
  'FG%': 'FG_PCT',
  '3P%': 'FG3_PCT',
  'FT%': 'FT_PCT',
};

// Build a { headerKey: rawValue } map from a career row + its headers array.
// Handles the array-indexed format BrefTable uses.
export function buildCareerMap(careerData) {
  if (!careerData?.rows?.[0] || !careerData?.headers) return null;
  const row = careerData.rows[0];
  return Object.fromEntries(careerData.headers.map((h, i) => [h, row[i]]));
}

// rowA, rowB are objects keyed by raw header name (from buildCareerMap).
// statDisplayKey is one of SUMMARY_STATS (e.g. 'FG%', 'PTS').
// Returns 'a' | 'b' | null (null when equal, either missing, or non-numeric).
export function pickLeader(rowA, rowB, statDisplayKey) {
  const rawKey = SUMMARY_KEY_MAP[statDisplayKey];
  if (!rawKey) return null;
  const vA = rowA?.[rawKey];
  const vB = rowB?.[rawKey];
  if (typeof vA !== 'number' || typeof vB !== 'number') return null;
  if (vA === vB) return null;
  const lowerBetter = LOWER_BETTER.has(rawKey);
  if (lowerBetter) return vA < vB ? 'a' : 'b';
  return vA > vB ? 'a' : 'b';
}
