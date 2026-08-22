// Scoring-distribution box score for one player-season, straight off BDL's own
// player_season_advanced_stats endpoint -- same endpoint as advancedRatings.js and clutchSplits.js,
// but measure_type=scoring instead of base/advanced. This measure_type returns a percentage-of-total
// breakdown (where points came from, not raw counts), so it's shaped into three grouped percentage
// buckets here rather than a BrefTable numeric row -- see client/src/components/
// ScoringDistributionTab.jsx for the bar-chart presentation this feeds.
//
// Field names confirmed by live spike, 2026-08-22: pct_pts_2_pt + pct_pts_3_pt + pct_pts_ft sums to
// 1.0 (every point is a 2, a 3, or a free throw); pct_ast_2_pm/pct_uast_2_pm (and the 3pm/overall
// equivalents) each sum to 1.0. pct_pts_paint/pct_pts_2_pt_mr/pct_pts_fb/pct_pts_off_tov are
// overlapping subsets of those points (e.g. a fastbreak make is still either a 2 or a 3), not a
// fourth mutually-exclusive bucket, so they're kept in a separate group rather than forced into the
// same stacked total. per_mode doesn't affect these values (they're ratios already) but is passed
// explicitly for parity with the other BDL fetches in this provider.
const { bdlFetch } = require('./client');

function mapScoringStatsRow(stats) {
  if (!stats || !stats.gp) return null;
  return {
    gp: stats.gp,
    pointsBreakdown: {
      twoPt: stats.pct_pts_2_pt ?? null,
      threePt: stats.pct_pts_3_pt ?? null,
      ft: stats.pct_pts_ft ?? null,
    },
    whereItHappens: {
      paint: stats.pct_pts_paint ?? null,
      midRange: stats.pct_pts_2_pt_mr ?? null,
      fastbreak: stats.pct_pts_fb ?? null,
      offTurnovers: stats.pct_pts_off_tov ?? null,
    },
    assistedVsUnassisted: {
      overall: { assisted: stats.pct_ast_fgm ?? null, unassisted: stats.pct_uast_fgm ?? null },
      twoPm: { assisted: stats.pct_ast_2_pm ?? null, unassisted: stats.pct_uast_2_pm ?? null },
      threePm: { assisted: stats.pct_ast_3_pm ?? null, unassisted: stats.pct_uast_3_pm ?? null },
    },
  };
}

async function fetchPlayerSeasonScoringBdl(bdlPlayerId, season, seasontype = 2) {
  const data = await bdlFetch('/player_season_advanced_stats', {
    'player_ids[]': [bdlPlayerId],
    season,
    season_type: seasontype === 3 ? 'playoffs' : 'regular',
    measure_type: 'scoring',
    per_mode: 'per_game',
  });
  return mapScoringStatsRow(data?.data?.[0]?.stats);
}

module.exports = { fetchPlayerSeasonScoringBdl, mapScoringStatsRow };
