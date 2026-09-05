// League-wide upcoming-games + odds, for the Odds hub. Reuses odds.js's existing fetchOddsForGamesBdl
// (already takes an explicit bdlGameIds list and returns one representative vendor line per game) --
// the only new fetch here is the upcoming-slate pull itself, since TeamSchedulePage.jsx's existing
// odds attach only ever knows one team's own upcoming games, never the full league's.
//
// Window is 7 days (today through +7), matching odds.js's own header comment on how far out books
// actually post lines (5 upcoming games seen over a 5-day spike window).
const { bdlFetch } = require('./client');
const { isRealFranchise } = require('./idMap');
const { buildOpponentLookup } = require('./schedule');
const espn = require('../espn');
const { fetchOddsForGamesBdl } = require('./odds');
const { withTtlCache, CURRENT_SEASON_TTL_MS } = require('../cache');

const ODDS_HUB_WINDOW_DAYS = 7;
// Unlike every other BDL fetch in this provider, this one has no per-season cache to piggyback on
// (the "current season" cache pair assumes a season-scoped key, which an upcoming-slate query
// isn't) -- without its own cache, every visitor to the Odds hub pays a fresh /games + /odds round
// trip (confirmed live: ~15-20s cold). Same short TTL as the rest of this provider's current-season
// data (CURRENT_SEASON_TTL_MS) -- the slate/lines genuinely change during the day, so this can't be
// cached forever like a past-season fetch.
const oddsHubCache = {};

function toDateStr(d) {
  return d.toISOString().slice(0, 10);
}

async function fetchUpcomingGamesRawBdl(windowDays) {
  const start = new Date();
  const end = new Date(start.getTime() + windowDays * 24 * 60 * 60 * 1000);
  const params = { start_date: toDateStr(start), end_date: toDateStr(end), per_page: 100 };

  const rows = [];
  let cursor;
  for (;;) {
    const data = await bdlFetch('/games', cursor ? { ...params, cursor } : params);
    rows.push(...(data?.data ?? []));
    cursor = data?.meta?.next_cursor;
    if (!cursor) break;
  }
  return rows;
}

// Pure: raw /games rows + the ESPN abbreviation->{id,logo} lookup -> upcoming-slate entries, real
// franchises only, regular season only (playoffs never have odds -- see odds.js/schedule.js), sorted
// chronologically. Split out so the shape logic is unit-testable without a network call.
function buildUpcomingSlate(gamesRows, opponentLookup) {
  const now = Date.now();
  return gamesRows
    .filter(g => isRealFranchise(g.home_team) && isRealFranchise(g.visitor_team) && !g.postseason)
    .filter(g => new Date(g.date).getTime() > now)
    .map(g => {
      const home = opponentLookup.get(String(g.home_team?.abbreviation).toUpperCase());
      const away = opponentLookup.get(String(g.visitor_team?.abbreviation).toUpperCase());
      return {
        gameId: g.id,
        date: g.date ?? null,
        home: { id: home?.id ?? null, abbreviation: g.home_team?.abbreviation ?? null },
        away: { id: away?.id ?? null, abbreviation: g.visitor_team?.abbreviation ?? null },
      };
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

async function fetchLeagueOddsRawBdl() {
  const [gamesRows, espnTeams] = await Promise.all([
    fetchUpcomingGamesRawBdl(ODDS_HUB_WINDOW_DAYS),
    espn.getTeams(),
  ]);
  const slate = buildUpcomingSlate(gamesRows, buildOpponentLookup(espnTeams));
  if (!slate.length) return [];

  const oddsByGame = await fetchOddsForGamesBdl(slate.map(g => g.gameId));
  return slate.map(g => ({ ...g, odds: oddsByGame.get(g.gameId) ?? null }));
}

function getLeagueOddsBdl() {
  return withTtlCache(oddsHubCache, 'slate', CURRENT_SEASON_TTL_MS, fetchLeagueOddsRawBdl);
}

module.exports = {
  getLeagueOddsBdl, buildUpcomingSlate, fetchUpcomingGamesRawBdl, ODDS_HUB_WINDOW_DAYS,
};
