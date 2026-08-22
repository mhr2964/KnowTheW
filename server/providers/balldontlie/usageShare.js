// Usage-share box score for one player-season, straight off BDL's own player_season_advanced_stats
// endpoint (same endpoint as clutchSplits.js/advancedRatings.js/scoringDistribution.js), but
// measure_type=usage -- % of the TEAM's rebounds/assists/steals/blocks/turnovers/FGA/FGM/FTA/FTM/
// fouls (drawn and committed) this player accounted for while on the floor, plus BDL's own overall
// usage rate. Prefixed TM_* rather than reusing this app's existing AST_PCT/REB_PCT/etc column keys
// (statColumns.js) -- those are a BRef-style box-score-derived formula already shown on the
// Advanced tab, a different computation from BDL's own on-floor team-share numbers, and could show
// different values for the same player-season; reusing the same key/label would misread as the
// same stat repeated.
//
// Field names confirmed by live spike, 2026-08-22: shares the SAME 2022 tracking-data floor as
// measure_type=scoring/advanced (ADVANCED_RATINGS_MIN_SEASON), not the wider 2008 BDL_MIN_SEASON
// floor Clutch splits use -- no row at all for 2015/2018/2021, first data at 2022.
const { bdlFetch } = require('./client');

function mapUsageStatsRow(stats) {
  if (!stats || !stats.gp) return null;
  return {
    gp: stats.gp,
    tmRebPct: stats.pct_reb ?? null,
    tmAstPct: stats.pct_ast ?? null,
    tmStlPct: stats.pct_stl ?? null,
    tmBlkPct: stats.pct_blk ?? null,
    tmTovPct: stats.pct_tov ?? null,
    tmFgaPct: stats.pct_fga ?? null,
    tmFgmPct: stats.pct_fgm ?? null,
    tmFtaPct: stats.pct_fta ?? null,
    tmFtmPct: stats.pct_ftm ?? null,
    tmPfPct: stats.pct_pf ?? null,
    tmPfdPct: stats.pct_pfd ?? null,
    tmUsgPct: stats.usg_pct ?? null,
  };
}

async function fetchPlayerSeasonUsageBdl(bdlPlayerId, season, seasontype = 2) {
  const data = await bdlFetch('/player_season_advanced_stats', {
    'player_ids[]': [bdlPlayerId],
    season,
    season_type: seasontype === 3 ? 'playoffs' : 'regular',
    measure_type: 'usage',
    per_mode: 'per_game',
  });
  return mapUsageStatsRow(data?.data?.[0]?.stats);
}

module.exports = { fetchPlayerSeasonUsageBdl, mapUsageStatsRow };
