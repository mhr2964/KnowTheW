// Abbreviation -> team logo lookup, built from the same /api/teams list App.jsx already fetches
// once at the top level and threads down as a prop -- every page below builds its own small Map
// from it rather than each doing a separate team fetch just to get a logo URL.
export function buildTeamLogoMap(teams) {
  const map = new Map();
  for (const t of teams ?? []) {
    if (t.abbreviation) map.set(t.abbreviation.toUpperCase(), t.logo ?? null);
  }
  return map;
}
