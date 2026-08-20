// Per 100 Poss: season totals scaled to what they'd be over 100 team possessions, using the same
// Dean Oliver team-pace estimate (FGA - OREB + TOV + 0.44*FTA) advancedStats.js's "approximation
// path" already relies on for Win Shares/PER when no PBP on-court data is in scope here (this
// route stays fully synchronous, no per-game provider fan-out -- see the H12-timeout fix in
// routes/playerAnalysis.js for why that fan-out is the thing to avoid reintroducing). Reuses
// `teamStatsByKey`, already fetched by routes/players.js's /detailed-stats handler for the
// existing Advanced computation -- no new provider calls.
//
// Same header shape as totals/per36 (ESPN_DETAILED_HEADERS) so this renders through the existing
// generic BrefTable branch in DetailedStats.jsx with no new client component.

const { pct, sumCareerRow, ESPN_DETAILED_HEADERS } = require('./statsParser');

function estimateTeamPossPerGame(tm) {
  if (!tm) return null;
  return (tm.fgaPg ?? 0) - (tm.orbPg ?? 0) + (tm.tovPg ?? 0) + 0.44 * (tm.ftaPg ?? 0);
}

// teamPossPerGame is that team-year's per-game pace; scaled by this row's own gp (not a full-season
// assumption) so a player who was traded mid-season is normalized against only the possessions
// their own team played while they were on the roster. null/0 pace (unmapped team, provider gap)
// renders GP/GS/MIN but every pace-dependent column falls to 0 -- same "0 not null" convention
// avgRow/totalsRow/per36Row already use for a missing denominator.
function per100Row(seasonId, teamAbbr, row, teamPossPerGame) {
  const { gp, gs, totalMinutes, totals: t } = row;
  const teamPoss = teamPossPerGame != null ? teamPossPerGame * gp : 0;
  const p100 = v => (teamPoss > 0 ? (v / teamPoss) * 100 : 0);
  return [
    seasonId, teamAbbr,
    gp, gs, gp > 0 ? totalMinutes / gp : 0,
    p100(t.fgm), p100(t.fga), pct(t.fgm, t.fga),
    p100(t.fg3m), p100(t.fg3a), pct(t.fg3m, t.fg3a),
    p100(t.ftm), p100(t.fta), pct(t.ftm, t.fta),
    p100(t.oreb), p100(t.dreb), p100(t.reb),
    p100(t.ast), p100(t.stl), p100(t.blk), p100(t.tov), p100(t.pf), p100(t.pts),
  ];
}

// seasons: raw PlayerSeasonRow[] (regSeasons/postSeasons from fetchPlayerSeasonData). teamsById:
// same lookup already used by buildSeasonTables. teamIdByYear: extractTeamIdByYear's output.
// teamStatsByKey: {`${teamId}-${year}`: TeamStats}, already fetched by the route for
// buildAdvancedSplit -- reused here, not re-fetched.
function buildPer100({ seasons, teamsById, teamIdByYear, teamStatsByKey }) {
  if (!seasons || seasons.length === 0) return { table: null, career: null };

  const rows = [];
  // Career denominator: sum of (teamPossPerGame * gp) across every season, i.e. each season's
  // actual contribution to team possessions the player's stats are being normalized against --
  // not an even average across seasons regardless of how many games each one covers.
  let careerPossWeighted = 0;
  let careerPossKnownGp = 0;
  seasons.forEach(row => {
    const teamAbbr = teamsById[row.teamId]?.abbreviation || '';
    const tid = teamIdByYear[row.year];
    const tm = tid ? (teamStatsByKey[`${tid}-${row.year}`] ?? null) : null;
    const teamPossPerGame = estimateTeamPossPerGame(tm);
    if (teamPossPerGame != null) {
      careerPossWeighted += teamPossPerGame * (row.gp ?? 0);
      careerPossKnownGp += row.gp ?? 0;
    }
    rows.push(per100Row(row.year, teamAbbr, row, teamPossPerGame));
  });

  const careerRow = sumCareerRow(seasons);
  const avgTeamPossPerGame = careerPossKnownGp > 0 ? careerPossWeighted / careerPossKnownGp : null;
  const careerLine = per100Row('Career', '', careerRow, avgTeamPossPerGame);

  return {
    table: { headers: ESPN_DETAILED_HEADERS, rows },
    career: { headers: ESPN_DETAILED_HEADERS, rows: [careerLine] },
  };
}

module.exports = { buildPer100, estimateTeamPossPerGame, per100Row };
