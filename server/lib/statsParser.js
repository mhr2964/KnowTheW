const ESPN_DETAILED_HEADERS = [
  'SEASON_ID', 'TEAM_ABBREVIATION', 'GP', 'GS', 'MIN',
  'FGM', 'FGA', 'FG_PCT', 'FG3M', 'FG3A', 'FG3_PCT',
  'FTM', 'FTA', 'FT_PCT', 'OREB', 'DREB', 'REB',
  'AST', 'STL', 'BLK', 'TOV', 'PF', 'PTS',
];

function parseStat(name, val) {
  const n = parseFloat(val);
  if (isNaN(n)) return null;
  return (name.endsWith('Pct') || name.endsWith('Percentage')) ? n / 100 : n;
}

function parseStatMap(names, stats) {
  const m = {};
  names.forEach((name, i) => {
    const val = stats?.[i];
    if (name.includes('-')) {
      const [n1, n2] = name.split('-');
      if (typeof val === 'string' && val.includes('-')) {
        const dash = val.indexOf('-');
        m[n1] = parseStat(n1, val.slice(0, dash));
        m[n2] = parseStat(n2, val.slice(dash + 1));
      } else {
        m[n1] = null;
        m[n2] = null;
      }
    } else {
      m[name] = parseStat(name, val);
    }
  });
  return m;
}

function avgMapToRow(seasonId, teamAbbr, m) {
  return [
    seasonId, teamAbbr,
    m.gamesPlayed, m.gamesStarted, m.avgMinutes,
    m.avgFieldGoalsMade, m.avgFieldGoalsAttempted, m.fieldGoalPct,
    m.avgThreePointFieldGoalsMade, m.avgThreePointFieldGoalsAttempted, m.threePointFieldGoalPct,
    m.avgFreeThrowsMade, m.avgFreeThrowsAttempted, m.freeThrowPct,
    m.avgOffensiveRebounds, m.avgDefensiveRebounds, m.avgRebounds,
    m.avgAssists, m.avgSteals, m.avgBlocks, m.avgTurnovers, m.avgFouls, m.avgPoints,
  ];
}

function totalsMapToRow(seasonId, teamAbbr, tm, gp, gs, totalMin) {
  return [
    seasonId, teamAbbr,
    gp, gs ?? null, totalMin !== null ? Math.round(totalMin) : null,
    tm.fieldGoalsMade, tm.fieldGoalsAttempted, tm.fieldGoalPct,
    tm.threePointFieldGoalsMade, tm.threePointFieldGoalsAttempted, tm.threePointFieldGoalPct,
    tm.freeThrowsMade, tm.freeThrowsAttempted, tm.freeThrowPct,
    tm.offensiveRebounds, tm.defensiveRebounds, tm.totalRebounds,
    tm.assists, tm.steals, tm.blocks, tm.turnovers, tm.fouls, tm.points,
  ];
}

function per36MapToRow(seasonId, teamAbbr, tm, gp, gs, totalMin) {
  const p = v => (v !== null && totalMin > 0) ? (v / totalMin) * 36 : null;
  return [
    seasonId, teamAbbr,
    gp, gs ?? null, totalMin !== null ? Math.round(totalMin) : null,
    p(tm.fieldGoalsMade), p(tm.fieldGoalsAttempted), tm.fieldGoalPct,
    p(tm.threePointFieldGoalsMade), p(tm.threePointFieldGoalsAttempted), tm.threePointFieldGoalPct,
    p(tm.freeThrowsMade), p(tm.freeThrowsAttempted), tm.freeThrowPct,
    p(tm.offensiveRebounds), p(tm.defensiveRebounds), p(tm.totalRebounds),
    p(tm.assists), p(tm.steals), p(tm.blocks), p(tm.turnovers), p(tm.fouls), p(tm.points),
  ];
}

function extractTeamIdByYear(data) {
  if (!data?.categories) return {};
  const avgCat = data.categories.find(c => c.name === 'averages');
  if (!avgCat) return {};
  const map = {};
  for (const entry of avgCat.statistics) {
    map[String(entry.season.year)] = String(entry.teamId);
  }
  return map;
}

function parseESPNSeasonData(data, teamsById) {
  if (!data?.categories) return null;
  const avgCat = data.categories.find(c => c.name === 'averages');
  const totCat = data.categories.find(c => c.name === 'totals');
  if (!avgCat || !totCat) return null;

  const avgByYear = {};
  avgCat.statistics.forEach(entry => {
    const year = String(entry.season.year);
    avgByYear[year] = {
      map: parseStatMap(avgCat.names, entry.stats),
      teamAbbr: teamsById[entry.teamId]?.abbreviation || '',
    };
  });

  const totByYear = {};
  totCat.statistics.forEach(entry => {
    const year = String(entry.season.year);
    totByYear[year] = {
      map: parseStatMap(totCat.names, entry.stats),
      teamAbbr: teamsById[entry.teamId]?.abbreviation || '',
    };
  });

  const years = [...new Set([...Object.keys(avgByYear), ...Object.keys(totByYear)])].sort();

  const pgRows = [], totRows = [], p36Rows = [];
  years.forEach(year => {
    const avg = avgByYear[year];
    const tot = totByYear[year];
    if (avg) pgRows.push(avgMapToRow(year, avg.teamAbbr, avg.map));
    if (avg && tot) {
      const totalMin = (avg.map.avgMinutes || 0) * (avg.map.gamesPlayed || 0);
      totRows.push(totalsMapToRow(year, tot.teamAbbr, tot.map, avg.map.gamesPlayed, avg.map.gamesStarted, totalMin));
      p36Rows.push(per36MapToRow(year, tot.teamAbbr, tot.map, avg.map.gamesPlayed, avg.map.gamesStarted, totalMin));
    }
  });

  const avgCareer = parseStatMap(avgCat.names, avgCat.totals);
  const totCareer = parseStatMap(totCat.names, totCat.totals);
  const careerGp = avgCareer.gamesPlayed;
  const careerTotalMin = Object.values(avgByYear).reduce(
    (s, a) => s + (a.map.avgMinutes || 0) * (a.map.gamesPlayed || 0), 0
  );

  const makeTable = rows => rows.length ? { headers: ESPN_DETAILED_HEADERS, rows } : null;
  const makeCareer = row => ({ headers: ESPN_DETAILED_HEADERS, rows: [row] });

  return {
    pg:  { table: makeTable(pgRows),  career: makeCareer(avgMapToRow('Career', '', avgCareer)) },
    tot: { table: makeTable(totRows), career: makeCareer(totalsMapToRow('Career', '', totCareer, careerGp, avgCareer.gamesStarted, careerTotalMin)) },
    p36: { table: makeTable(p36Rows), career: makeCareer(per36MapToRow('Career', '', totCareer, careerGp, avgCareer.gamesStarted, careerTotalMin)) },
  };
}

function buildDetailedStats(regData, postData, teamsById) {
  const reg = parseESPNSeasonData(regData, teamsById);
  const post = parseESPNSeasonData(postData, teamsById);
  const makeSplit = getter => ({
    regular:       reg  ? getter(reg).table  : null,
    regularCareer: reg  ? getter(reg).career : null,
    playoffs:      post ? getter(post).table  : null,
    playoffCareer: post ? getter(post).career : null,
  });
  return {
    source: 'espn',
    perGame: makeSplit(r => r.pg),
    totals:  makeSplit(r => r.tot),
    per36:   makeSplit(r => r.p36),
    per100:  null,
  };
}

module.exports = {
  ESPN_DETAILED_HEADERS,
  parseStat, parseStatMap,
  avgMapToRow, totalsMapToRow, per36MapToRow,
  extractTeamIdByYear, parseESPNSeasonData, buildDetailedStats,
};
