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
// Fetched with per_mode='totals', NOT 'per_game': def_ws is a counting stat under the hood (BDL
// divides it by gp under per_mode='per_game' exactly like blk/stl/dreb), but Win Shares is always
// a season TOTAL in basketball analytics (same convention as this site's own homegrown OWS/DWS/WS
// on the Advanced tab) -- a per-game WS number is meaningless. Confirmed by live spike, 2026-08-22
// (A'ja Wilson, 2025 season): per_mode='per_game' returned def_ws 0.15 (season total 6.01 ÷ 40
// games) -- silently wrong, this is what a prior version of this file actually shipped with. blk/
// stl/dreb/opp_pts_* are legitimately per-game on this site's Defense tab (matching every other
// per-game box-score column elsewhere), so they're derived back down by dividing the totals-mode
// response by gp here -- confirmed identical to what per_mode='per_game' itself would have
// returned for those fields (BDL's own per-game rounding matches raw-total/gp exactly).
//
// def_ws (now a real season total) is this site's AUTHORITATIVE Win Shares number as of
// 2026-08-22 (user decision, resolving the discrepancy this file used to flag as unresolved: BDL
// def_ws 6.01 vs. the homegrown formula's 1.71 for the same player-season) -- see
// advancedStats.js's computeSeasonPBPUncached, which overrides the homegrown DWS/WS/WS_PER48 with
// this value whenever it's available. def_rating is unaffected by per_mode either way (a rate
// stat, not a counting stat) and matches the homegrown DEF_RATING almost exactly (98.8 both).
//
// Field names confirmed by live spike, 2026-08-22: shares the SAME 2022 tracking-data floor as
// measure_type=scoring/advanced/usage (ADVANCED_RATINGS_MIN_SEASON), not the wider 2008
// BDL_MIN_SEASON floor Clutch splits use -- no row at all for 2015/2018/2021, first data at 2022.
const { bdlFetch } = require('./client');

function perGame(total, gp) {
  return (total != null && gp > 0) ? total / gp : null;
}

function mapDefenseStatsRow(stats) {
  if (!stats || !stats.gp) return null;
  const gp = stats.gp;
  return {
    gp,
    blk: perGame(stats.blk, gp),
    stl: perGame(stats.stl, gp),
    dreb: perGame(stats.dreb, gp),
    bdlDrebPct: stats.dreb_pct ?? null,
    defRating: stats.def_rating ?? null,
    bdlDefWs: stats.def_ws ?? null,
    oppPtsPaint: perGame(stats.opp_pts_paint, gp),
    oppPtsFastbreak: perGame(stats.opp_pts_fb, gp),
    oppPtsOffTov: perGame(stats.opp_pts_off_tov, gp),
    oppPts2ndChance: perGame(stats.opp_pts_2_nd_chance, gp),
  };
}

async function fetchPlayerSeasonDefenseBdl(bdlPlayerId, season, seasontype = 2) {
  const data = await bdlFetch('/player_season_advanced_stats', {
    'player_ids[]': [bdlPlayerId],
    season,
    season_type: seasontype === 3 ? 'playoffs' : 'regular',
    measure_type: 'defense',
    per_mode: 'totals',
  });
  return mapDefenseStatsRow(data?.data?.[0]?.stats);
}

module.exports = { fetchPlayerSeasonDefenseBdl, mapDefenseStatsRow };
