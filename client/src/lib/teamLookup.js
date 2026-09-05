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

// Abbreviation -> full team name ("Las Vegas Aces"), same source as buildTeamLogoMap. Used where
// there's room for it (single-team leaderboard rows) -- StandingsPage's own team column already
// shows the full name, not just the abbreviation, so this matches that established convention
// rather than leaving every new page one notch less finished than the page it sits next to in nav.
export function buildTeamNameMap(teams) {
  const map = new Map();
  for (const t of teams ?? []) {
    if (t.abbreviation) map.set(t.abbreviation.toUpperCase(), t.name ?? null);
  }
  return map;
}
