// League-wide per-zone FG% averages, for anchoring Shot Chart's color scale. Confirmed by spike
// (2026-08-21): a flat 50%-centered color scale was wrong -- it treats 50% from three (excellent --
// league average out there is ~30-35%) the same as 50% at the rim (below average -- restricted-area
// league average is ~60-65%). Each zone needs its OWN league-average anchor so hot/cold reflects how
// good a shot actually was FOR THAT ZONE, not an arbitrary flat midpoint. See client/src/components/
// ShotChart.jsx's zoneColor for where this gets used.
//
// /player_shot_locations supports the same no-player_ids-filter bulk-pull trick already used for
// /player_season_stats (leagueStats.js) -- confirmed live, cursor-paginated, same shape as the
// per-player response but for every player in a season.

const { bdlFetch } = require('./client');
const { makeSeasonCache } = require('../cache');
const { ZONES } = require('./shotChart');

const leagueShotZonesCache = makeSeasonCache();

async function fetchAllShotZoneRows(season, postseason) {
  const rows = [];
  let cursor;
  while (true) {
    const params = { season, per_page: 100, cursor };
    if (postseason) params.postseason = true;
    const data = await bdlFetch('/player_shot_locations', params);
    if (!data) return null;
    rows.push(...(data.data ?? []));
    if (!data.meta?.next_cursor) break;
    cursor = data.meta.next_cursor;
  }
  return rows;
}

// Pure: every player's shot-zone rows for a season -> {zoneKey: leagueAvgFgPct}. Sums makes/
// attempts across every player (not an average-of-percentages, which would over-weight low-volume
// shooters) then divides once per zone -- same volume-weighted approach the rest of this codebase's
// league-average tables already use.
function aggregateLeagueZones(rows) {
  const totals = Object.fromEntries(ZONES.map(z => [z.key, { fga: 0, fgm: 0 }]));
  for (const row of rows) {
    const shotZones = row?.stats?.shot_zones ?? {};
    for (const { key } of ZONES) {
      const z = shotZones[key];
      if (!z) continue;
      totals[key].fga += z.fga ?? 0;
      totals[key].fgm += z.fgm ?? 0;
    }
  }
  const result = {};
  for (const { key } of ZONES) {
    const t = totals[key];
    result[key] = t.fga > 0 ? t.fgm / t.fga : 0;
  }
  return result;
}

async function fetchLeagueShotZonesRawBdl(season, postseason) {
  const rows = await fetchAllShotZoneRows(season, postseason);
  if (!rows) return null;
  return aggregateLeagueZones(rows);
}

// Matches the player's own regular/playoffs toggle (shotChart.js) -- a playoffs zone compared
// against a league average dominated by regular-season volume would mislabel a normal playoff
// shooting night as "hot" or "cold" relative to the wrong baseline.
function fetchLeagueShotZonesBdl(season, postseason) {
  const key = `league-zones-${season}-${postseason ? 'po' : 'reg'}`;
  return leagueShotZonesCache.get(season, key, () => fetchLeagueShotZonesRawBdl(season, postseason));
}

module.exports = {
  fetchLeagueShotZonesBdl, fetchLeagueShotZonesRawBdl,
  // exported for unit tests:
  aggregateLeagueZones,
};
