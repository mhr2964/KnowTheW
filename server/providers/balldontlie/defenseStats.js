// Defense box score for one player-season, straight off BDL's own player_season_advanced_stats
// endpoint (same endpoint as clutchSplits.js/scoringDistribution.js/usageShare.js), but
// measure_type=defense -- raw defensive box (blocks/steals/def rebounds), BDL's own DREB% and
// Defensive Rating and Defensive Win Shares, plus opponent-points-allowed by category while this
// player was on the floor.
//
// pct_blk/pct_stl in the raw response duplicate usageShare.js's TM_BLK_PCT/TM_STL_PCT (same
// team-share figures, confirmed identical by live spike) -- not remapped here, already covered by
// the Usage tab.
//
// BDL's def_ws diverges materially from this app's own homegrown DWS (advancedStats.js/
// statFormulas.js's computeWinShares, BRef/Oliver methodology) -- live spike, A'ja Wilson 2025
// regular season, season totals: BDL def_ws 6.01 vs homegrown DWS 1.71. Def_rating, by contrast,
// matches the homegrown DEF_RATING almost exactly (98.8 both) -- the two sources agree on
// pace-adjusted defensive rating but use very different Win Shares formulas. Surfaced here as
// BDL_DEF_WS, a distinctly-named column, NOT a replacement for the existing Advanced tab's DWS --
// this is a real accuracy question flagged for the user, not resolved by this feature.
//
// Field names confirmed by live spike, 2026-08-22: shares the SAME 2022 tracking-data floor as
// measure_type=scoring/advanced/usage (ADVANCED_RATINGS_MIN_SEASON), not the wider 2008
// BDL_MIN_SEASON floor Clutch splits use -- no row at all for 2015/2018/2021, first data at 2022.
const { bdlFetch } = require('./client');

function mapDefenseStatsRow(stats) {
  if (!stats || !stats.gp) return null;
  return {
    gp: stats.gp,
    blk: stats.blk ?? null,
    stl: stats.stl ?? null,
    dreb: stats.dreb ?? null,
    bdlDrebPct: stats.dreb_pct ?? null,
    defRating: stats.def_rating ?? null,
    bdlDefWs: stats.def_ws ?? null,
    oppPtsPaint: stats.opp_pts_paint ?? null,
    oppPtsFastbreak: stats.opp_pts_fb ?? null,
    oppPtsOffTov: stats.opp_pts_off_tov ?? null,
    oppPts2ndChance: stats.opp_pts_2_nd_chance ?? null,
  };
}

async function fetchPlayerSeasonDefenseBdl(bdlPlayerId, season, seasontype = 2) {
  const data = await bdlFetch('/player_season_advanced_stats', {
    'player_ids[]': [bdlPlayerId],
    season,
    season_type: seasontype === 3 ? 'playoffs' : 'regular',
    measure_type: 'defense',
    per_mode: 'per_game',
  });
  return mapDefenseStatsRow(data?.data?.[0]?.stats);
}

module.exports = { fetchPlayerSeasonDefenseBdl, mapDefenseStatsRow };
