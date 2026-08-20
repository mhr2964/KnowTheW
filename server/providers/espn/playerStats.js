// ESPN player-level fetches that previously lived as raw fetch() calls inside route handlers and
// gradedReportInputs. Centralizing them here is the M3 step toward a clean provider boundary.
//
// getPlayerSeasonStats returns normalized PlayerSeasonRow[] (see server/providers/types.js), not
// ESPN's raw categories JSON -- the raw-shape parsing (dash-composite stat names, positional stats
// arrays keyed by a parallel `names` array, season/team grouping) lives entirely in this file now,
// so statsParser.js and its four downstream consumers (advancedStats.js, gradedReportInputs.js,
// routes/playerAnalysis.js, routes/players.js) never touch ESPN-specific raw shape again. This is
// the normalization this file's own header comment previously flagged as deferred.

const { ESPN_WEB, withTtlCache } = require('./client');
const { fetchWithRetry: fetch } = require('../retryFetch');

// ESPN's raw per-category stat encoding: `names` is a parallel array to `stats`; a composite name
// like 'fieldGoalsMade-fieldGoalsAttempted' pairs with a "N-M" string value and gets split into two
// keys. Returns a plain {name: number|null} map keyed by ESPN's own raw name strings. No `/100`
// percentage handling here (unlike the pre-normalization version) -- normalized rows only carry raw
// counts; percentages are derived from made/attempted uniformly downstream in statsParser.js.
function parseRawStatMap(names, stats) {
  const m = {};
  (names ?? []).forEach((name, i) => {
    const val = stats?.[i];
    if (name.includes('-')) {
      const [n1, n2] = name.split('-');
      if (typeof val === 'string' && val.includes('-')) {
        const dash = val.indexOf('-');
        m[n1] = parseFloatOrNull(val.slice(0, dash));
        m[n2] = parseFloatOrNull(val.slice(dash + 1));
      } else {
        m[n1] = null; m[n2] = null;
      }
    } else {
      m[name] = parseFloatOrNull(val);
    }
  });
  return m;
}

function parseFloatOrNull(val) {
  const n = parseFloat(val);
  return Number.isNaN(n) ? null : n;
}

// ESPN's raw categories payload -> normalized PlayerSeasonRow[] (server/providers/types.js), one
// entry per year present in BOTH the 'averages' category (source of GP/GS/avg-minutes) and the
// 'totals' category (source of made/attempted counts) -- a year needs both to build a complete row.
// Returns null if the payload has no usable category data at all (non-2xx already returned null
// upstream; this also covers a 200 with an unexpected/empty shape).
function normalizeSeasonRows(data) {
  if (!data?.categories) return null;
  const avgCat = data.categories.find(c => c.name === 'averages');
  const totCat = data.categories.find(c => c.name === 'totals');
  if (!avgCat || !totCat) return null;

  const avgByYear = {};
  (avgCat.statistics ?? []).forEach(entry => {
    avgByYear[String(entry.season.year)] = {
      map: parseRawStatMap(avgCat.names, entry.stats),
      teamId: String(entry.teamId),
    };
  });
  const totByYear = {};
  (totCat.statistics ?? []).forEach(entry => {
    totByYear[String(entry.season.year)] = parseRawStatMap(totCat.names, entry.stats);
  });

  const years = Object.keys(avgByYear).filter(y => totByYear[y]).sort();
  return years.map(year => {
    const avg = avgByYear[year].map;
    const tm = totByYear[year];
    // ESPN gives no raw total-minutes field -- only a per-game average -- so total minutes is
    // itself an approximation (avgMinutes * gamesPlayed), same derivation the pre-normalization
    // code already used.
    const totalMinutes = (avg.avgMinutes || 0) * (avg.gamesPlayed || 0);
    return {
      year,
      teamId: avgByYear[year].teamId,
      gp: avg.gamesPlayed ?? 0,
      gs: avg.gamesStarted ?? null,
      totalMinutes: Math.round(totalMinutes),
      totals: {
        fgm: tm.fieldGoalsMade ?? 0, fga: tm.fieldGoalsAttempted ?? 0,
        fg3m: tm.threePointFieldGoalsMade ?? 0, fg3a: tm.threePointFieldGoalsAttempted ?? 0,
        ftm: tm.freeThrowsMade ?? 0, fta: tm.freeThrowsAttempted ?? 0,
        oreb: tm.offensiveRebounds ?? 0, dreb: tm.defensiveRebounds ?? 0, reb: tm.totalRebounds ?? 0,
        ast: tm.assists ?? 0, stl: tm.steals ?? 0, blk: tm.blocks ?? 0,
        tov: tm.turnovers ?? 0, pf: tm.fouls ?? 0, pts: tm.points ?? 0,
      },
    };
  });
}

// These three are hit on every player-page load (basics on lookup, season stats behind every
// Per Game/Totals/Per 36/Advanced tab) with no cache in front of them at all before this — every
// visitor to the same player re-triggered a fresh ESPN fetch. TTL'd rather than cached forever
// because the payload includes the in-progress current season, which changes after every game;
// 15 minutes bounds ESPN traffic to a small fraction of page views while keeping same-day
// freshness. withTtlCache serves the last-known-good value on a transient ESPN error.
const PLAYER_TTL_MS = 15 * 60 * 1000;
const basicsCache = {};
const retiredCache = {};
const seasonStatsCache = {};

// Fetch the ESPN athlete record once; both player-profile shapes below build from it. Returns the
// `athlete` object or null (non-2xx response or missing athlete).
async function fetchAthlete(playerId) {
  const r = await fetch(`${ESPN_WEB}/athletes/${playerId}`);
  if (!r.ok) return null;
  const data = await r.json();
  return data.athlete ?? null;
}

async function fetchPlayerBasicsRaw(playerId) {
  const a = await fetchAthlete(playerId);
  if (!a) return null;
  return {
    id:       String(a.id),
    name:     a.displayName ?? a.fullName ?? 'Unknown',
    position: a.position?.abbreviation ?? '',
  };
}

/** Minimal player identity used by the graded-report builder: { id, name, position } or null. */
function getPlayerBasics(playerId) {
  return withTtlCache(basicsCache, playerId, PLAYER_TTL_MS, () => fetchPlayerBasicsRaw(playerId));
}

async function fetchRetiredPlayerRaw(playerId) {
  const a = await fetchAthlete(playerId);
  if (!a) return null;
  return {
    id:           String(a.id),
    name:         a.displayName,
    position:     a.position?.abbreviation ?? '',
    positionName: a.position?.displayName  ?? '',
    jersey:       a.jersey ?? null,
    headshot:     a.headshot?.href ?? null,
    height:       a.height ?? null,
    weight:       a.weight ?? null,
    age:          a.age    ?? null,
    college:      a.college?.name ?? null,
    birthPlace:   null,
    experience:   a.experience?.years ?? null,
    teamId:       null,
    teamName:     null,
    retired:      true,
  };
}

/** Full retired-player profile (not in the active-roster cache), or null if ESPN has no record. */
function getRetiredPlayer(playerId) {
  return withTtlCache(retiredCache, playerId, PLAYER_TTL_MS, () => fetchRetiredPlayerRaw(playerId));
}

async function fetchPlayerSeasonStatsRaw(playerId) {
  const [regData, postData] = await Promise.all([
    fetch(`${ESPN_WEB}/athletes/${playerId}/stats?seasontype=2`).then(r => (r.ok ? r.json() : null)),
    fetch(`${ESPN_WEB}/athletes/${playerId}/stats?seasontype=3`).then(r => (r.ok ? r.json() : null)),
  ]);
  return {
    regSeasons: normalizeSeasonRows(regData),
    postSeasons: normalizeSeasonRows(postData),
  };
}

/** Normalized regular-season + playoff PlayerSeasonRow[] (each null on a non-2xx/unparseable response). */
function getPlayerSeasonStats(playerId) {
  return withTtlCache(seasonStatsCache, playerId, PLAYER_TTL_MS, () => fetchPlayerSeasonStatsRaw(playerId));
}

module.exports = {
  getPlayerBasics, getRetiredPlayer, getPlayerSeasonStats,
  // exported for unit tests and reuse by other providers building the same normalized shape:
  normalizeSeasonRows, parseRawStatMap,
};
