// Builds a full head-to-head matrix (every team's record against every other team) from a season's
// game list (/api/league/schedule) -- bbref's "Expanded Standings" shows this as a Vs. column per
// opponent; this site had no equivalent lookup at all before. Pure so it's unit-testable without a
// fetch, same "pure transform, IO wrapped separately" split every other lib module here uses.
export function buildHeadToHeadMatrix(games, regularSeasonOnly = true) {
  const records = new Map(); // teamAbbr -> Map(oppAbbr -> {w, l})
  const bump = (teamAbbr, oppAbbr, won) => {
    if (!records.has(teamAbbr)) records.set(teamAbbr, new Map());
    const row = records.get(teamAbbr);
    if (!row.has(oppAbbr)) row.set(oppAbbr, { w: 0, l: 0 });
    const cell = row.get(oppAbbr);
    if (won) cell.w += 1; else cell.l += 1;
  };

  for (const g of games ?? []) {
    if (regularSeasonOnly && g.postseason) continue;
    if (!g.final || g.home.score == null || g.away.score == null) continue;
    const homeWon = g.home.score > g.away.score;
    bump(g.home.abbreviation, g.away.abbreviation, homeWon);
    bump(g.away.abbreviation, g.home.abbreviation, !homeWon);
  }

  return records;
}
