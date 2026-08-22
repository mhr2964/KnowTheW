// Clutch-scope box score for one player-season, straight off BDL's own player_season_advanced_stats
// endpoint (scope=clutch, measure_type=base) -- same endpoint as advancedRatings.js's Off/Def/Net
// Rating + PIE, but a different (scope, measure_type) combination and a different row shape: base
// counting stats (PTS/REB/AST/etc), not the derived rating fields.
//
// Field names/shape confirmed by live spike, 2026-08-22: BDL's `stats` object under
// measure_type=base uses lowercase abbreviations (pts, reb, ast, fg_pct...) that map 1:1 onto this
// app's existing LABELS convention in statColumns.js (PTS, REB, AST, FG_PCT...). per_mode=per_game
// requested explicitly -- BDL defaults to per_mode=totals (summed across all clutch appearances) when
// the param is omitted, which reads oddly in a stats table (e.g. "40 PTS" for a whole season of
// clutch minutes); per-game matches how every other tab on this site already presents rate stats.
const { bdlFetch } = require('./client');

function mapClutchStatsRow(stats) {
  if (!stats) return null;
  return {
    gp: stats.gp ?? null,
    min: stats.min ?? null,
    fgm: stats.fgm ?? null, fga: stats.fga ?? null, fgPct: stats.fg_pct ?? null,
    fg3m: stats.fg3_m ?? null, fg3a: stats.fg3_a ?? null, fg3Pct: stats.fg3_pct ?? null,
    ftm: stats.ftm ?? null, fta: stats.fta ?? null, ftPct: stats.ft_pct ?? null,
    oreb: stats.oreb ?? null, dreb: stats.dreb ?? null, reb: stats.reb ?? null,
    ast: stats.ast ?? null, stl: stats.stl ?? null, blk: stats.blk ?? null,
    tov: stats.tov ?? null, pf: stats.pf ?? null, pts: stats.pts ?? null,
    fantasyPts: stats.wnba_fantasy_pts ?? null,
  };
}

async function fetchPlayerSeasonClutchBdl(bdlPlayerId, season, seasontype = 2) {
  const data = await bdlFetch('/player_season_advanced_stats', {
    'player_ids[]': [bdlPlayerId],
    season,
    season_type: seasontype === 3 ? 'playoffs' : 'regular',
    scope: 'clutch',
    measure_type: 'base',
    per_mode: 'per_game',
  });
  return mapClutchStatsRow(data?.data?.[0]?.stats);
}

module.exports = { fetchPlayerSeasonClutchBdl, mapClutchStatsRow };
