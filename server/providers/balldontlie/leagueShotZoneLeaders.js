// League shot-zone leaderboards -- reuses leagueShotZones.js's existing bulk /player_shot_locations
// pull (every player's zone-aggregated FG stats for a season), which today only ever gets collapsed
// into a single league-wide average per zone. This module keeps the per-player rows instead, ranking
// each zone by FG% among players who cleared a minimum-attempts floor in that zone.
//
// MIN_ZONE_FGA=20 is a volume floor to keep a 1-of-1 flukey 100% shooter off the board -- chosen as
// a round number comfortably below a real rotation player's season attempts in any zone a team
// actually runs offense through, not derived from a league-wide qualification stat (this endpoint
// carries no games_played/minutes field to gate on, unlike player_season_stats).
const MIN_ZONE_FGA = 20;
const TOP_N = 15;

const { ZONES } = require('./shotChart');
const { fetchAllShotZoneRows } = require('./leagueShotZones');
const { makeSeasonCache } = require('../cache');

const leadersCache = makeSeasonCache();

// Pure: every player's shot-zone rows for a season -> [{key, label, leaders: [{bdlPlayerId, name,
// teamAbbr, fga, fgm, fgPct}, ...]}] -- same fixed zone order and {key,label} shape as
// shotChart.js/teamShotChart.js's own `zones` arrays, so the client reuses one zone-label
// convention everywhere. Each zone's leaders are sorted by FG% desc (ties broken by FGA desc, more
// attempts at the same clip is the more impressive number), capped at TOP_N.
function buildZoneLeaderboards(rows, { minFga = MIN_ZONE_FGA, topN = TOP_N } = {}) {
  return ZONES.map(({ key, label }) => {
    const candidates = [];
    for (const row of rows) {
      const player = row?.player;
      if (player?.id == null) continue;
      const z = row?.stats?.shot_zones?.[key];
      const fga = z?.fga ?? 0;
      if (fga < minFga) continue;
      const fgm = z?.fgm ?? 0;
      candidates.push({
        bdlPlayerId: player.id,
        name: `${player.first_name} ${player.last_name}`.trim(),
        teamAbbr: player.team?.abbreviation ?? null,
        fga, fgm,
        fgPct: z?.fg_pct ?? (fga > 0 ? fgm / fga : 0),
      });
    }
    candidates.sort((a, b) => b.fgPct - a.fgPct || b.fga - a.fga);
    return { key, label, leaders: candidates.slice(0, topN) };
  });
}

async function fetchLeagueShotZoneLeadersRawBdl(season, postseason) {
  const rows = await fetchAllShotZoneRows(season, postseason);
  if (!rows) return null;
  return { season: Number(season), zones: buildZoneLeaderboards(rows) };
}

// Matches leagueShotZones.js's own regular/playoffs split -- ranking a playoffs zone against
// leaders drawn from a season that mixed in regular-season volume would be internally inconsistent.
function fetchLeagueShotZoneLeadersBdl(season, postseason) {
  const key = `zone-leaders-${season}-${postseason ? 'po' : 'reg'}`;
  return leadersCache.get(season, key, () => fetchLeagueShotZoneLeadersRawBdl(season, postseason));
}

module.exports = {
  fetchLeagueShotZoneLeadersBdl, fetchLeagueShotZoneLeadersRawBdl,
  // exported for unit tests:
  buildZoneLeaderboards, MIN_ZONE_FGA, TOP_N,
};
