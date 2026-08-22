// Per-game advanced box score for one player, straight off BDL's own player_game_advanced_stats
// endpoint. BDL-only, no ESPN equivalent -- feeds the Game Log's per-game expandable detail panel
// (client/src/components/GameAdvancedStatsPanel.jsx), not the main dense Game Log table itself.
//
// Confirmed by live spike, 2026-08-22 (Nneka Ogwumike, game 3866): unlike the season-level
// player_season_advanced_stats endpoint (advancedRatings.js/scoringDistribution.js/usageShare.js/
// teamFourFactors.js), which uses a `measure_type` param to select ONE stat bundle with short field
// names (off_rating, efg_pct, tm_tov_pct...), this per-game endpoint returns ALL FIVE bundles
// (misc/usage/scoring/advanced/four_factors) in a single response, under LONG field names
// (offensive_rating, effective_field_goal_percentage, team_turnover_percentage...). The two endpoints
// do NOT share a field-naming convention even where the underlying stat is the same one -- this
// mapper's own output keys mirror the season-level camelCase names for a consistent client
// presentation, but the extraction side must use this endpoint's own (longer) raw names.
//
// period is always requested as 0 (full game) -- period 1-4 (quarter-level) is a real, documented
// param this endpoint supports but wasn't spiked or built here; the roadmap flagged it as unspiked
// and this feature only needs the full-game row.
const { bdlFetch } = require('./client');

function mapGameAdvancedStatsRow(stats) {
  if (!stats) return null;
  const { misc, usage, scoring, advanced, four_factors: fourFactors } = stats;
  return {
    misc: misc && {
      pointsPaint: misc.points_paint ?? null,
      pointsFastBreak: misc.points_fast_break ?? null,
      pointsSecondChance: misc.points_second_chance ?? null,
      pointsOffTurnovers: misc.points_off_turnovers ?? null,
      oppPointsPaint: misc.opp_points_paint ?? null,
      oppPointsFastBreak: misc.opp_points_fast_break ?? null,
      oppPointsSecondChance: misc.opp_points_second_chance ?? null,
      oppPointsOffTurnovers: misc.opp_points_off_turnovers ?? null,
      foulsPersonal: misc.fouls_personal ?? null,
      foulsDrawn: misc.fouls_drawn ?? null,
      blocks: misc.blocks ?? null,
      blocksAgainst: misc.blocks_against ?? null,
    },
    usage: usage && {
      usagePct: usage.usage_percentage ?? null,
      pctPoints: usage.percentage_points ?? null,
      pctAssists: usage.percentage_assists ?? null,
      pctRebounds: usage.percentage_rebounds_total ?? null,
      pctSteals: usage.percentage_steals ?? null,
      pctBlocks: usage.percentage_blocks ?? null,
      pctTurnovers: usage.percentage_turnovers ?? null,
      pctFieldGoalsMade: usage.percentage_field_goals_made ?? null,
      pctFreeThrowsMade: usage.percentage_free_throws_made ?? null,
    },
    scoring: scoring && {
      pctPoints2pt: scoring.percentage_points2pt ?? null,
      pctPoints3pt: scoring.percentage_points3pt ?? null,
      pctPointsFreeThrow: scoring.percentage_points_free_throw ?? null,
      pctPointsPaint: scoring.percentage_points_paint ?? null,
      pctPointsMidrange2pt: scoring.percentage_points_midrange2pt ?? null,
      pctPointsFastBreak: scoring.percentage_points_fast_break ?? null,
      pctPointsOffTurnovers: scoring.percentage_points_off_turnovers ?? null,
      pctAssistedFgm: scoring.percentage_assisted_fgm ?? null,
      pctUnassistedFgm: scoring.percentage_unassisted_fgm ?? null,
    },
    advanced: advanced && {
      offRating: advanced.offensive_rating ?? null,
      defRating: advanced.defensive_rating ?? null,
      netRating: advanced.net_rating ?? null,
      pie: advanced.pie ?? null,
      pace: advanced.pace ?? null,
      possessions: advanced.possessions ?? null,
      usagePct: advanced.usage_percentage ?? null,
      assistPct: advanced.assist_percentage ?? null,
      reboundPct: advanced.rebound_percentage ?? null,
      offReboundPct: advanced.offensive_rebound_percentage ?? null,
      defReboundPct: advanced.defensive_rebound_percentage ?? null,
      truShootingPct: advanced.true_shooting_percentage ?? null,
      effectiveFgPct: advanced.effective_field_goal_percentage ?? null,
      assistToTurnover: advanced.assist_to_turnover ?? null,
    },
    fourFactors: fourFactors && {
      efgPct: fourFactors.effective_field_goal_percentage ?? null,
      tovPct: fourFactors.team_turnover_percentage ?? null,
      orbPct: fourFactors.offensive_rebound_percentage ?? null,
      ftRatePct: fourFactors.free_throw_attempt_rate ?? null,
      oppEfgPct: fourFactors.opp_effective_field_goal_percentage ?? null,
      oppTovPct: fourFactors.opp_team_turnover_percentage ?? null,
      oppOrbPct: fourFactors.opp_offensive_rebound_percentage ?? null,
      oppFtRatePct: fourFactors.opp_free_throw_attempt_rate ?? null,
    },
  };
}

async function fetchPlayerGameAdvancedStatsBdl(bdlPlayerId, bdlGameId) {
  const data = await bdlFetch('/player_game_advanced_stats', {
    'player_ids[]': [bdlPlayerId],
    'game_ids[]': [bdlGameId],
    period: 0,
  });
  return mapGameAdvancedStatsRow(data?.data?.[0]?.stats);
}

module.exports = { fetchPlayerGameAdvancedStatsBdl, mapGameAdvancedStatsRow };
