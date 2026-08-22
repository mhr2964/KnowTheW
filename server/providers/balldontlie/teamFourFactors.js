// Dean Oliver's "Four Factors" (eFG%/TOV%/OREB%/FT Rate) for a team and its opponents, straight off
// BDL's team_season_advanced_stats endpoint (team-level only -- the same measure_type returned empty
// at player level, confirmed live). BDL-only, no ESPN equivalent.
//
// Field names confirmed by live spike, 2026-08-22 (Las Vegas Aces, BDL team id 8): shares the SAME
// 2022 tracking-data floor as the player-level measure_type family (scoring/usage/defense/advanced) --
// no row at all for 2010/2015/2018/2021, first data at 2022. Ratios are per_mode-invariant (confirmed
// by spike: totals vs per_game returned identical efg_pct/oreb_pct/etc), same as the player-side
// percentage fields elsewhere in this provider.
const { bdlFetch } = require('./client');

function mapFourFactorsRow(stats) {
  if (!stats || !stats.gp) return null;
  return {
    efgPct: stats.efg_pct ?? null,
    tovPct: stats.tm_tov_pct ?? null,
    orbPct: stats.oreb_pct ?? null,
    ftRatePct: stats.fta_rate ?? null,
    oppEfgPct: stats.opp_efg_pct ?? null,
    oppTovPct: stats.opp_tov_pct ?? null,
    oppOrbPct: stats.opp_oreb_pct ?? null,
    oppFtRatePct: stats.opp_fta_rate ?? null,
  };
}

async function fetchTeamFourFactorsBdl(bdlTeamId, season, seasontype = 2) {
  const data = await bdlFetch('/team_season_advanced_stats', {
    'team_ids[]': [bdlTeamId],
    season,
    season_type: seasontype === 3 ? 'playoffs' : 'regular',
    measure_type: 'four_factors',
    per_mode: 'per_game',
  });
  return mapFourFactorsRow(data?.data?.[0]?.stats);
}

module.exports = { fetchTeamFourFactorsBdl, mapFourFactorsRow };
