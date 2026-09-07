// Groups a season's postseason games (from /api/league/schedule?postseason=true) into series by
// team pair. BDL's game rows carry no round-label field at all (see server's leagueSchedule.js /
// schedule.js header comments) -- rather than invent round names ("Semifinal") the data can't
// actually support, this only claims what's honestly derivable from the games themselves: which two
// teams played a given stretch of postseason games, in what order, and who won the series. Series
// are sorted by their first game's date, which puts them in bracket order anyway without asserting
// a round label.
export function groupIntoSeries(games) {
  const bySeriesKey = new Map();
  for (const g of games ?? []) {
    const key = [g.home.abbreviation, g.away.abbreviation].sort().join('-');
    if (!bySeriesKey.has(key)) bySeriesKey.set(key, []);
    bySeriesKey.get(key).push(g);
  }

  return [...bySeriesKey.values()]
    .map(seriesGames => {
      const sorted = [...seriesGames].sort((a, b) => new Date(a.date) - new Date(b.date));
      const wins = {};
      for (const g of sorted) {
        if (!g.final) continue;
        const winner = g.home.score > g.away.score ? g.home.abbreviation : g.away.abbreviation;
        wins[winner] = (wins[winner] ?? 0) + 1;
      }
      const teams = [...new Set(sorted.flatMap(g => [g.home.abbreviation, g.away.abbreviation]))];
      const complete = sorted.every(g => g.final);
      return { teams, wins, games: sorted, complete };
    })
    .sort((a, b) => new Date(a.games[0].date) - new Date(b.games[0].date));
}
