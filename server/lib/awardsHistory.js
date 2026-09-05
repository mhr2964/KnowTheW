// Awards History: a year-by-year table over wnbaAccolades.js's constants (MVP, Finals MVP, DPOY,
// ROY, Sixth Player, All-WNBA First Team). That data has lived in this codebase since 2026-05-11
// (used for Compare page verdict chips and graded-report inputs) but has never had a standalone
// page -- this module is a plain read over it, not a new data source.
//
// Not provider-dependent (award winners are static historical fact, not a stats-provider concern),
// so this is a plain lib module the route calls directly, not a SportsDataProvider method.

const {
  WNBA_MVP, WNBA_FINALS_MVP, WNBA_DPOY, WNBA_ROY, WNBA_SIXTH_PLAYER, ALL_WNBA_FIRST_TEAM,
} = require('../constants/wnbaAccolades');
const { resolveEspnIdByName } = require('./playerNameIndex');

const CATEGORIES = [
  { key: 'mvp', label: 'MVP', source: WNBA_MVP },
  { key: 'finalsMvp', label: 'Finals MVP', source: WNBA_FINALS_MVP },
  { key: 'dpoy', label: 'Defensive POY', source: WNBA_DPOY },
  { key: 'roy', label: 'Rookie of the Year', source: WNBA_ROY },
  { key: 'sixth', label: 'Sixth Player', source: WNBA_SIXTH_PLAYER },
];

// name -> {name, playerId} entry, or null for a year with no award given (e.g. 2002 ROY, the
// lockout-shortened season -- see wnbaAccolades.js's own header comment).
function nameEntry(name, idByName) {
  if (!name) return null;
  return { name, playerId: idByName.get(name) ?? null };
}

// Pure: builds year-descending rows from the accolade constants + an already-resolved name->id
// map. Split from getAwardsHistory (below) so the shape logic is unit-testable without a DB/ESPN
// call -- same "pure transform, IO wrapped separately" split every other lib module here uses.
function buildAwardsRows(idByName) {
  const allYears = new Set();
  for (const { source } of CATEGORIES) for (const y of Object.keys(source)) allYears.add(Number(y));
  for (const y of Object.keys(ALL_WNBA_FIRST_TEAM)) allYears.add(Number(y));

  const years = [...allYears].sort((a, b) => b - a);
  return years.map(year => {
    const row = { year };
    for (const { key, source } of CATEGORIES) row[key] = nameEntry(source[year], idByName);
    row.allWnbaFirst = (ALL_WNBA_FIRST_TEAM[year] ?? []).map(name => nameEntry(name, idByName));
    return row;
  });
}

// Collects every distinct name across every category/year and resolves each to this site's ESPN
// id ONCE (a player can win multiple awards across multiple years) -- same once-per-unique-name
// batching leagueStatLeaders.js/getLeagueShotZoneLeaders already use for the same reason.
async function getAwardsHistory() {
  const names = new Set();
  for (const { source } of CATEGORIES) for (const name of Object.values(source)) names.add(name);
  for (const teamNames of Object.values(ALL_WNBA_FIRST_TEAM)) for (const name of teamNames) names.add(name);

  const idByName = new Map(await Promise.all(
    [...names].map(async name => [name, await resolveEspnIdByName(name)])
  ));

  return { categories: [...CATEGORIES.map(({ key, label }) => ({ key, label })), { key: 'allWnbaFirst', label: 'All-WNBA First Team' }], rows: buildAwardsRows(idByName) };
}

module.exports = { getAwardsHistory, buildAwardsRows, CATEGORIES };
