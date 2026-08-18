// Phase 2 of the ESPN-migration plan: regular-season team schedule sourced from BallDontLie, for
// season >= BDL_MIN_SEASON. Playoffs stay on ESPN regardless of season -- see below.
//
// Why playoffs are excluded: ScheduleEvent's roundLabel field (e.g. "Semifinals") comes from
// ESPN's competition.type.text; BDL's /games has no equivalent field at all (confirmed by a live
// spike inspecting every field on a real postseason game -- id/date/season/postseason/status/
// period/time/home_team/visitor_team/scores, nothing else). Also confirmed (again): the
// `postseason` query param is a silent no-op on this API, same quirk already documented in
// idMap.js/plays.js -- filtering happens client-side on each game's own `postseason` boolean.
// getTeamSchedule(teamId, season, seasontype) is the ONE method the /teams/:id/schedule route
// uses for BOTH regular and playoff views (seasontype 2 or 3) -- so the season-conditional dispatch
// below must also check seasontype, not just season, or a playoff-schedule request would silently
// lose round labels the same way a regular-season one gains BDL sourcing. getPlayoffSchedule is a
// separate convenience method (used by historyAggregator.js) and stays an ESPN-forever passthrough
// in index.js, unchanged -- same reasoning, no code duplication needed since it never touches BDL.
//
// BDL's game `opponent` object (home_team/visitor_team) has no logo -- confirmed by spike, see
// docs/design/provider-architecture.md's Phase 3 "not pursued" verdict. Enrich with logo/color by
// joining against ESPN's getTeams() (already fetched/cached elsewhere) by abbreviation.

const { bdlFetch } = require('./client');
const { resolveBdlTeamId, isRealFranchise } = require('./idMap');
const espn = require('../espn');

// Pure: ESPN's team list -> Map<abbreviation, {id, logo}> for the opponent-enrichment join.
// Both sources use standard WNBA tricodes (confirmed matching live: ATL/CHI/CON/DAL/GS/IND/LV/LA/
// MIN/NY/PHX/SEA/WSH) -- ESPN's own abbreviation here is already the reliable derived-from-logo
// tricode (tricodeFromLogo in espn/client.js), not the raw ESPN field known to be bad for WNBA.
function buildOpponentLookup(espnTeams) {
  const map = new Map();
  for (const t of espnTeams ?? []) {
    map.set(String(t.abbreviation).toUpperCase(), { id: String(t.id), logo: t.logo ?? null });
  }
  return map;
}

// Pure: one BDL /games row -> the ScheduleEvent shape, or null if either side isn't a real
// franchise (All-Star/exhibition/national team -- see idMap.js's isRealFranchise) or the game is
// a postseason game (playoffs stay on ESPN, see file header).
function mapGameToScheduleEvent(game, bdlTeamId, opponentLookup) {
  if (game.postseason) return null;
  if (!isRealFranchise(game.home_team) || !isRealFranchise(game.visitor_team)) return null;

  const isHome = String(game.home_team?.id) === String(bdlTeamId);
  const opponentTeam = isHome ? game.visitor_team : game.home_team;
  const teamScore = isHome ? game.home_score : game.away_score;
  const oppScore = isHome ? game.away_score : game.home_score;
  const hasScores = typeof teamScore === 'number' && typeof oppScore === 'number' && game.status_state === 'final';
  const winner = hasScores ? teamScore > oppScore : null;

  const enriched = opponentLookup.get(String(opponentTeam?.abbreviation).toUpperCase());

  return {
    id: String(game.id),
    date: game.date ?? null,
    opponent: {
      id: enriched?.id ?? String(opponentTeam?.id ?? ''),
      abbreviation: opponentTeam?.abbreviation ?? null,
      logo: enriched?.logo ?? null,
    },
    atVs: isHome ? 'vs' : '@',
    result: hasScores ? (winner ? 'W' : 'L') : null,
    teamScore: hasScores ? teamScore : null,
    oppScore: hasScores ? oppScore : null,
    winner,
    // Regular season only, matching ESPN's own convention of leaving roundLabel undefined outside
    // seasontype 3 (see espn/client.js's fetchTeamSchedule).
    roundLabel: undefined,
  };
}

async function fetchTeamScheduleRawBdl(espnTeamId, season) {
  const bdlTeamId = await resolveBdlTeamId(espnTeamId);
  if (bdlTeamId == null) return null;

  const [gamesData, espnTeams] = await Promise.all([
    bdlFetch('/games', { 'team_ids[]': [bdlTeamId], 'seasons[]': [season], per_page: 100 }),
    espn.getTeams(),
  ]);
  if (!gamesData) return null;

  const opponentLookup = buildOpponentLookup(espnTeams);
  const events = (gamesData.data ?? [])
    .map(g => mapGameToScheduleEvent(g, bdlTeamId, opponentLookup))
    .filter(Boolean);

  events.sort((a, b) => new Date(a.date) - new Date(b.date));
  return events;
}

// No in-process cache here -- matches espn/client.js's fetchTeamSchedule, which is also uncached
// at this layer (caching for past seasons happens at the route layer via Mongo's teamSeasonSchedule
// cache-aside; current season is deliberately never cached, live on every request).
function fetchTeamScheduleBdl(espnTeamId, season) {
  return fetchTeamScheduleRawBdl(espnTeamId, season);
}

module.exports = {
  fetchTeamScheduleBdl, fetchTeamScheduleRawBdl,
  // exported for unit tests:
  buildOpponentLookup, mapGameToScheduleEvent,
};
