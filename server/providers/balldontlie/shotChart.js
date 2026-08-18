// Player shot chart, sourced from BallDontLie's /player_shot_locations endpoint. No ESPN
// equivalent exists at all -- this is new data, not a migration (see index.js's header comment).
//
// Confirmed by spike: the endpoint returns ZONE-AGGREGATED FG stats (fga/fgm/fg_pct per named
// court zone), not per-shot x/y coordinates -- a scatter/dot chart isn't buildable from this data.
// The 7 real (non-overlapping) zones are: restricted_area, in_the_paint_non_ra, mid_range,
// left_corner_3, right_corner_3, above_the_break_3, backcourt. BDL also returns a `corner_3` field,
// but it's just left_corner_3 + right_corner_3 summed (confirmed live: 4 = 1 + 3 in a real sample) --
// dropped here so a "zones sum to season total" check downstream doesn't double-count.
//
// Zone tracking only goes back to 2022 (SHOT_CHART_MIN_SEASON, ./client.js) -- much newer than
// BDL_MIN_SEASON's 2008 floor for the rest of this provider's data.

const { bdlFetch, withCache, withTtlCache } = require('./client');
const { isPastSeason } = require('../../lib/seasonWindow');

const CURRENT_SEASON_TTL_MS = 15 * 60 * 1000;
const bdlPastShotChartCache = {};
const bdlCurrentShotChartCache = {};

// Fixed display order -- rim outward, then backcourt last (near-always zero, kept for honesty
// rather than silently dropped).
const ZONES = [
  { key: 'restricted_area', label: 'Restricted Area' },
  { key: 'in_the_paint_non_ra', label: 'Paint (Non-RA)' },
  { key: 'mid_range', label: 'Mid-Range' },
  { key: 'left_corner_3', label: 'Left Corner 3' },
  { key: 'right_corner_3', label: 'Right Corner 3' },
  { key: 'above_the_break_3', label: 'Above the Break 3' },
  { key: 'backcourt', label: 'Backcourt' },
];

// Pure transform: one /player_shot_locations row -> the normalized {season, zones} shape.
// Every zone in ZONES is always present in the output, defaulted to {fga:0, fgm:0, fgPct:0} if BDL
// omits it -- not yet confirmed whether BDL ever omits a zero-value zone rather than including it
// with zeros (every live sample so far included all zones), so this stays defensive.
function buildShotChartFromRow(row) {
  const shotZones = row?.stats?.shot_zones ?? {};
  const zones = ZONES.map(({ key, label }) => {
    const z = shotZones[key];
    const fga = z?.fga ?? 0;
    const fgm = z?.fgm ?? 0;
    return { key, label, fga, fgm, fgPct: fga > 0 ? (z?.fg_pct ?? (fgm / fga)) : 0 };
  });
  return { season: Number(row?.season), zones };
}

async function fetchPlayerShotChartRawBdl(bdlPlayerId, season) {
  const data = await bdlFetch('/player_shot_locations', {
    'player_ids[]': [bdlPlayerId],
    season,
  });
  if (!data) return null;
  const row = data.data?.[0];
  if (!row) return null; // no tracking data for this player-season -- graceful "no chart", not an error
  return buildShotChartFromRow(row);
}

function fetchPlayerShotChartBdl(bdlPlayerId, season) {
  const key = `${bdlPlayerId}-${season}`;
  if (isPastSeason(season)) {
    return withCache(bdlPastShotChartCache, key, () => fetchPlayerShotChartRawBdl(bdlPlayerId, season));
  }
  return withTtlCache(bdlCurrentShotChartCache, key, CURRENT_SEASON_TTL_MS, () => fetchPlayerShotChartRawBdl(bdlPlayerId, season));
}

module.exports = {
  fetchPlayerShotChartBdl, fetchPlayerShotChartRawBdl,
  // exported for unit tests:
  buildShotChartFromRow, ZONES,
};
