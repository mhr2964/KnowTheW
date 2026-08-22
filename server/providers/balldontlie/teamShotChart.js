// Team shot chart, sourced from BallDontLie's /team_shot_locations endpoint. Same zone-aggregated
// FG% shape as the player-level /player_shot_locations (shotChart.js) -- confirmed live, 2026-08-22
// (Las Vegas Aces, BDL team id 8): identical shot_zones keys, same corner_3 = left + right redundant
// field dropped the same way, same 2022 tracking floor (SHOT_CHART_MIN_SEASON) confirmed empty at
// 2018/2021, first data at 2022.
//
// Two framings, both live-confirmed via `measure_type`: `base` (default) is the team's OWN shot
// zones (fga/fgm/fg_pct); `opponent` is opponent zone FG% while facing this team -- the defensive
// shot-location tendency framing the roadmap doc flagged as the more novel one, since nothing else
// on the site surfaces where a team's defense forces (or allows) shots from. Both fetched in
// parallel per season -- two distinct BDL calls, not one, since measure_type is a single-value
// server-side filter, not a list.
const { bdlFetch } = require('./client');
const { makeSeasonCache } = require('../cache');
const { ZONES } = require('./shotChart');

const teamShotChartCache = makeSeasonCache();

// Pure transform: one /team_shot_locations row -> the normalized {season, zones} shape. `prefix`
// selects which field family to read -- '' for the base/own framing (fga/fgm/fg_pct), 'opp_' for
// the opponent framing (opp_fga/opp_fgm/opp_fg_pct). Same all-zones-always-present defaulting as
// the player-side transform (shotChart.js), for the same not-yet-confirmed-omission reason.
function buildTeamShotChartFromRow(row, prefix) {
  const shotZones = row?.stats?.shot_zones ?? {};
  const zones = ZONES.map(({ key, label }) => {
    const z = shotZones[key];
    const fga = z?.[`${prefix}fga`] ?? 0;
    const fgm = z?.[`${prefix}fgm`] ?? 0;
    return { key, label, fga, fgm, fgPct: fga > 0 ? (z?.[`${prefix}fg_pct`] ?? (fgm / fga)) : 0 };
  });
  return { season: Number(row?.season), zones };
}

async function fetchTeamShotChartSideBdl(bdlTeamId, season, measureType, prefix) {
  const params = { 'team_ids[]': [bdlTeamId], season };
  if (measureType !== 'base') params.measure_type = measureType;
  const data = await bdlFetch('/team_shot_locations', params);
  if (!data) return null;
  const row = data.data?.[0];
  if (!row) return null; // no zone tracking for this team-season -- graceful "no chart", not an error
  return buildTeamShotChartFromRow(row, prefix);
}

async function fetchTeamShotChartRawBdl(bdlTeamId, season) {
  const [own, opponent] = await Promise.all([
    fetchTeamShotChartSideBdl(bdlTeamId, season, 'base', ''),
    fetchTeamShotChartSideBdl(bdlTeamId, season, 'opponent', 'opp_'),
  ]);
  if (!own && !opponent) return null;
  return { season: Number(season), own, opponent };
}

function fetchTeamShotChartBdl(bdlTeamId, season) {
  const key = `${bdlTeamId}-${season}`;
  return teamShotChartCache.get(season, key, () => fetchTeamShotChartRawBdl(bdlTeamId, season));
}

module.exports = {
  fetchTeamShotChartBdl, fetchTeamShotChartRawBdl,
  // exported for unit tests:
  buildTeamShotChartFromRow,
};
