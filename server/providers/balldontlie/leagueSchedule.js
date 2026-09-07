// League-wide schedule/scores for a season -- a real gap the Basketball-Reference nav comparison
// surfaced (2026-09-07): the site had per-team schedules and a Notable-Games highlight reel, but no
// plain "every game this season, with final scores" list.
//
// BDL-only (see schedule.js's header comment: BDL's postseason games carry no round-label field --
// that's why TEAM schedules stay on ESPN for playoffs). This deliberately doesn't attempt round
// labels either; it's a flat, date-ordered slate for the whole season, same shape for regular
// season and playoffs, which needs nothing beyond each game's own postseason boolean.
const { isRealFranchise } = require('./idMap');
const { buildOpponentLookup } = require('./schedule');
const { fetchAllPagesBdl } = require('./leagueStats');
const espn = require('../espn');
const { makeSeasonCache } = require('../cache');

const scheduleCache = makeSeasonCache();

// Pure: raw /games rows + the ESPN abbreviation->{id,logo} lookup -> a date-ordered league
// schedule, real franchises only. Split out so the shape logic is unit-testable without a network
// call, same pattern as leagueOdds.js's buildUpcomingSlate.
function buildLeagueSchedule(gamesRows, opponentLookup) {
  return (gamesRows ?? [])
    .filter(g => isRealFranchise(g.home_team) && isRealFranchise(g.visitor_team))
    .map(g => {
      const home = opponentLookup.get(String(g.home_team?.abbreviation).toUpperCase());
      const away = opponentLookup.get(String(g.visitor_team?.abbreviation).toUpperCase());
      return {
        gameId: g.id,
        date: g.date ?? null,
        postseason: !!g.postseason,
        final: g.status_state === 'final',
        home: { id: home?.id ?? null, abbreviation: g.home_team?.abbreviation ?? null, score: g.home_score ?? null },
        away: { id: away?.id ?? null, abbreviation: g.visitor_team?.abbreviation ?? null, score: g.away_score ?? null },
      };
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

async function fetchLeagueScheduleRawBdl(season) {
  const [gamesRows, espnTeams] = await Promise.all([
    fetchAllPagesBdl('/games', { 'seasons[]': [season] }),
    espn.getTeams(),
  ]);
  return buildLeagueSchedule(gamesRows, buildOpponentLookup(espnTeams));
}

function getLeagueScheduleBdl(season) {
  return scheduleCache.get(season, 'schedule', () => fetchLeagueScheduleRawBdl(season));
}

module.exports = { getLeagueScheduleBdl, buildLeagueSchedule };
