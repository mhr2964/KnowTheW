// Phase 1: team season stats sourced from BallDontLie, for season >= BDL_MIN_SEASON. Confirmed by
// spike: BDL's team_season_stats endpoint already returns clean per-game averages -- no
// totals-derivation needed, unlike the player-level endpoints (see docs/design/provider-architecture.md).
// Percentages come back 0-100 (e.g. fg_pct: 43.9) and are passed through unconverted -- confirmed
// live against ESPN's own getTeamStats output (also 0-100, e.g. fgPct: 41.231) that TeamStats.fgPct
// is 0-100 scale, NOT the 0-1 fractional convention player-level report fields use elsewhere in
// this codebase. Dividing by 100 here would have silently mismatched ESPN's own convention.

const { bdlFetch, withCache, bdlTeamSeasonStatsCache, bdlTeamPtsAllowedCache } = require('./client');
const { resolveBdlTeamId } = require('./idMap');

// Same three-way return contract as espn/client.js's fetchTeamStatsRaw:
//   null            -- transient error (network/non-2xx/unresolvable team id) -- do not cache.
//   { noData: true } -- confirmed empty season (BDL 200, zero rows) -- safe to cache permanently.
//   TeamStats object -- normalized per-game stats.
async function fetchTeamStatsRawBdl(espnTeamId, year) {
  const bdlTeamId = await resolveBdlTeamId(espnTeamId);
  if (bdlTeamId == null) return null;

  const data = await bdlFetch('/team_season_stats', { 'team_ids[]': [bdlTeamId], season: year });
  if (!data) return null;
  // Regular season only (season_type 2) -- a team can have both a regular-season and a
  // playoffs row for the same year.
  const row = (data.data ?? []).find(r => r.season_type === 2);
  if (!row) return { noData: true };

  return {
    fgaPg:  row.fga ?? null,
    fgmPg:  row.fgm ?? null,
    fgPct:  row.fg_pct  ?? null,
    fg3mPg: row.fg3m ?? null,
    fg3Pct: row.fg3_pct ?? null,
    ftaPg:  row.fta ?? null,
    ftmPg:  row.ftm ?? null,
    ftPct:  row.ft_pct  ?? null,
    ptsPg:  row.pts ?? null,
    orbPg:  row.oreb ?? null,
    drbPg:  row.dreb ?? null,
    tovPg:  row.turnover ?? null,
    astPg:  row.ast ?? null,
  };
}

function fetchTeamStatsBdl(espnTeamId, year) {
  return withCache(bdlTeamSeasonStatsCache, `${espnTeamId}-${year}`, () => fetchTeamStatsRawBdl(espnTeamId, year));
}

// Average opponent points allowed per regular-season game. Computed from /games rather than a
// dedicated endpoint, mirroring espn/client.js's fetchTeamPtsAllowedRaw (which derives it from the
// team schedule the same way). Filters client-side on each game's own `postseason` field -- the
// `postseason` query param is confirmed to be a silent no-op on this API (spike finding).
async function fetchTeamPtsAllowedRawBdl(espnTeamId, year) {
  const bdlTeamId = await resolveBdlTeamId(espnTeamId);
  if (bdlTeamId == null) return null;

  const data = await bdlFetch('/games', { 'team_ids[]': [bdlTeamId], 'seasons[]': [year], per_page: 100 });
  if (!data) return null;

  let sum = 0, count = 0;
  for (const g of data.data ?? []) {
    if (g.postseason) continue;
    const isHome = String(g.home_team?.id) === String(bdlTeamId);
    const oppScore = isHome ? g.away_score : g.home_score;
    if (typeof oppScore === 'number' && oppScore > 0) { sum += oppScore; count++; }
  }
  return count > 0 ? sum / count : null;
}

function fetchTeamPtsAllowedBdl(espnTeamId, year) {
  return withCache(bdlTeamPtsAllowedCache, `${espnTeamId}-${year}`, () => fetchTeamPtsAllowedRawBdl(espnTeamId, year));
}

module.exports = {
  fetchTeamStatsRawBdl, fetchTeamStatsBdl,
  fetchTeamPtsAllowedRawBdl, fetchTeamPtsAllowedBdl,
};
