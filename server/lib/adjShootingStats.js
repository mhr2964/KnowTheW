// Adj. Shooting: TS%/eFG%/3PAr/FTr (reusing statFormulas.js's computeBasicRatioStats, the same
// function advancedStats.js's Advanced tab already uses) expressed relative to that season's
// league average -- BRef's rTS%/r3PAr/rFTr convention (100 = exactly league average, 108 = 8%
// above). League averages come from constants/leagueAverages.js (WNBA_LG / getLeagueAverage),
// already built into this codebase and used by Win Shares -- no new fetch, no new provider call,
// fully synchronous. Same reasoning as per100Stats.js for why this stays off the live-provider
// per-season-fetch pattern PBP/Advanced use (see routes/playerAnalysis.js's H12-timeout fix).
//
// Same generic BrefTable rendering path as perGame/totals/per36/per100 -- no new client component.

const { computeBasicRatioStats } = require('./statFormulas');
const { getLeagueAverage } = require('../constants/leagueAverages');
const { sumCareerRow } = require('./statsParser');

const ADJ_SHOOTING_HEADERS = [
  'SEASON_ID', 'TEAM_ABBREVIATION', 'GP',
  'TS_PCT', 'R_TS_PCT', 'EFG_PCT', 'R_EFG_PCT', 'TPAr', 'R_TPAr', 'FTr', 'R_FTr',
];

// getLeagueAverage returns per-team-per-game totals, not season totals -- but every ratio
// computeBasicRatioStats produces (made/attempted, points/possession) is scale-invariant: a
// per-game numerator and denominator scaling together yield the same ratio a full-season total
// would, so there's no need to multiply by season length first.
function leagueRatios(year) {
  const lg = getLeagueAverage(year);
  if (!lg) return null;
  return computeBasicRatioStats(lg.fga, lg.fgm, lg.fg3m, lg.fg3a, lg.fta, lg.pts, lg.tov);
}

// Player's rate stat as % of league average for that season. null when either side is missing/zero
// -- a corrupted or absent season shouldn't render as a misleading 0 (0% of league average is a
// very different claim than "no data").
function relative(playerVal, leagueVal) {
  return (playerVal != null && leagueVal != null && leagueVal > 0)
    ? Math.round((playerVal / leagueVal) * 1000) / 10
    : null;
}

function adjShootingRow(seasonId, teamAbbr, gp, totals, year) {
  const { ts, efg, tpar, ftr } = computeBasicRatioStats(
    totals.fga, totals.fgm, totals.fg3m, totals.fg3a, totals.fta, totals.pts, totals.tov,
  );
  const lg = leagueRatios(year);
  return [
    seasonId, teamAbbr, gp,
    ts, relative(ts, lg?.ts),
    efg, relative(efg, lg?.efg),
    tpar, relative(tpar, lg?.tpar),
    ftr, relative(ftr, lg?.ftr),
  ];
}

// seasons: raw PlayerSeasonRow[] (regSeasons/postSeasons). teamsById: same lookup buildSeasonTables
// already uses.
function buildAdjShooting({ seasons, teamsById }) {
  if (!seasons || seasons.length === 0) return { table: null, career: null };

  const rows = seasons.map(row => {
    const teamAbbr = teamsById[row.teamId]?.abbreviation || '';
    return adjShootingRow(row.year, teamAbbr, row.gp, row.totals, row.year);
  });

  const careerRow = sumCareerRow(seasons);
  // A career spans multiple seasons' worth of league context -- there's no single "right" season
  // to compare a whole career against, so this uses the most recent season's league average as the
  // reference point (seasons arrive sorted ascending -- see seasonStats.js's computeHybridSeasonStatsUncached).
  // Same "no season-agnostic answer" tradeoff BRef itself accepts for career rate stats.
  const latestYear = seasons[seasons.length - 1]?.year;
  const careerLine = adjShootingRow('Career', '', careerRow.gp, careerRow.totals, latestYear);

  return {
    table: { headers: ADJ_SHOOTING_HEADERS, rows },
    career: { headers: ADJ_SHOOTING_HEADERS, rows: [careerLine] },
  };
}

module.exports = { buildAdjShooting, ADJ_SHOOTING_HEADERS, relative };
