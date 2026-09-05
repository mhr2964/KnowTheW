// All-time / career league leaders: sums each player's season Totals (from getLeagueStatLines,
// the same per-season entries League Leaders already ranks) across every season from the ESPN
// byathlete floor (2002 -- see design.md's data-sources note; 1997-2001 lives only in the separate
// hand-curated legacy-bulk dataset, not this live API path, so career totals here are necessarily
// 2002-present) through the latest completed season. Volume counting stats only (PTS/REB/AST/STL/
// BLK) -- summing per-season shooting PERCENTAGES across seasons is not a meaningful "career total"
// the way summing counting stats is.

const CATEGORIES = [
  { key: 'PTS', label: 'Points' },
  { key: 'REB', label: 'Rebounds' },
  { key: 'AST', label: 'Assists' },
  { key: 'STL', label: 'Steals' },
  { key: 'BLK', label: 'Blocks' },
];
const TOP_N = 10;
const CAREER_LEADERS_MIN_SEASON = 2002;

// Pure: [{canonicalId, name, teamAbbr, PTS, REB, AST, STL, BLK}, ...] (one entry per player per
// season, canonicalId already resolved to this site's ESPN id by the caller, or null if
// unresolved) -> accumulated career totals, one row per distinct identity. A null canonicalId
// falls back to grouping by name -- same graceful-degradation posture as every other identity
// bridge in this codebase (an unresolved player still shows, just with no player-page link).
function accumulateCareerTotals(seasonEntries) {
  const byKey = new Map();
  for (const e of seasonEntries) {
    const key = e.canonicalId ?? `name:${e.name}`;
    let acc = byKey.get(key);
    if (!acc) {
      acc = { playerId: e.canonicalId ?? null, name: e.name, teamAbbr: e.teamAbbr ?? null, PTS: 0, REB: 0, AST: 0, STL: 0, BLK: 0, seasons: 0 };
      byKey.set(key, acc);
    }
    for (const { key: statKey } of CATEGORIES) acc[statKey] += e[statKey] ?? 0;
    acc.seasons += 1;
    acc.teamAbbr = e.teamAbbr ?? acc.teamAbbr; // most-recent season's team, last write wins
  }
  return [...byKey.values()];
}

// Pure: accumulated career rows -> top-N per category, same ranking shape as leagueLeaders.js.
// Rounded for display -- Totals mode itself is an approximation (per-game average * games_played,
// same method mapBdlLeagueStatLine/mapLeagueStatLine already use, see their own comments), so
// summing across ~15+ seasons compounds that into visible float noise (e.g. 7894.590000000001) --
// showing fake sub-point precision on a career total would be worse than rounding it.
function buildCareerLeaderboards(accumulated, { categories = CATEGORIES, topN = TOP_N } = {}) {
  return categories.map(({ key, label }) => ({
    key,
    label,
    leaders: accumulated
      .filter(r => typeof r[key] === 'number')
      .sort((a, b) => b[key] - a[key])
      .slice(0, topN)
      .map(r => ({ playerId: r.playerId, name: r.name, teamAbbr: r.teamAbbr, seasons: r.seasons, value: Math.round(r[key]) })),
  }));
}

module.exports = { accumulateCareerTotals, buildCareerLeaderboards, CATEGORIES, TOP_N, CAREER_LEADERS_MIN_SEASON };
