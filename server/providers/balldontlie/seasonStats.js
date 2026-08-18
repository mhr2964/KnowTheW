// Phase 1b of the ESPN-migration plan: player season stats. Unlike every other migrated method,
// getPlayerSeasonStats returns a player's WHOLE CAREER in one call -- a season-conditional dispatch
// can't just pick one provider, since a long-career player spans both pre-2008 (ESPN-only) and
// >= 2008 (BDL-available) seasons. This module instead MERGES: always fetch ESPN's real normalized
// PlayerSeasonRow[] first (it already covers every season, including pre-2008, for free), then
// replace only the rows for years >= BDL_MIN_SEASON with BDL-derived rows, built by summing the
// same per-game data gameLog.js (Phase 1a) already fetches and verifies.
//
// This became far simpler once getPlayerSeasonStats itself moved to the normalized PlayerSeasonRow
// contract (see server/lib/statsParser.js's header comment) -- there's no need to replicate ESPN's
// raw dash-composite-name JSON shape here at all; BDL-derived rows are built directly in the shared
// normalized shape.
//
// Two confirmed, permanent BDL gaps (see docs/design/provider-architecture.md):
//   - No games-started field exists on any BDL player_stats row for any season -> gs is always
//     null for BDL-derived rows, same graceful-null handling already used elsewhere this session.
//   - No BDL round-label-equivalent field exists (Phase 2's finding) -- irrelevant here, this
//     module doesn't touch schedule data, but the regular/playoff SPLIT itself (which games count
//     toward regSeasons vs postSeasons) still needs each game's postseason flag, which
//     gameLog.js's buildGameMetaMap now carries for exactly this reason.

const { bdlFetch, withTtlCache, BDL_MIN_SEASON } = require('./client');
const { resolveBdlPlayerId } = require('./idMap');
const { buildGameMetaMap, isDnpRow } = require('./gameLog');
const { buildOpponentLookup } = require('./schedule');
const espn = require('../espn');

const TOTALS_FIELDS = ['fgm', 'fga', 'fg3m', 'fg3a', 'ftm', 'fta', 'oreb', 'dreb', 'reb', 'ast', 'stl', 'blk', 'tov', 'pf', 'pts'];

// Pure: one BDL /player_stats row -> this module's internal totals-accumulator shape. `turnover`
// (BDL's field name) maps to `tov` (PlayerSeasonTotals' field name) -- everything else matches.
function addRowToTotals(totals, row) {
  totals.fgm += row.fgm ?? 0; totals.fga += row.fga ?? 0;
  totals.fg3m += row.fg3m ?? 0; totals.fg3a += row.fg3a ?? 0;
  totals.ftm += row.ftm ?? 0; totals.fta += row.fta ?? 0;
  totals.oreb += row.oreb ?? 0; totals.dreb += row.dreb ?? 0; totals.reb += row.reb ?? 0;
  totals.ast += row.ast ?? 0; totals.stl += row.stl ?? 0; totals.blk += row.blk ?? 0;
  totals.tov += row.turnover ?? 0; totals.pf += row.pf ?? 0; totals.pts += row.pts ?? 0;
}

// Pure: a list of already-DNP-filtered BDL player_stats rows for one season+split -> a
// PlayerSeasonRow (server/providers/types.js), or null if there are no rows (that split didn't
// happen for this player-season, e.g. a team that didn't make the playoffs).
function aggregateToSeasonRow(year, espnTeamId, rows) {
  if (!rows.length) return null;
  const totals = Object.fromEntries(TOTALS_FIELDS.map(k => [k, 0]));
  let totalMinutes = 0;
  for (const row of rows) {
    addRowToTotals(totals, row);
    totalMinutes += Number(row.min) || 0;
  }
  return {
    year: String(year),
    teamId: espnTeamId ?? '',
    gp: rows.length,
    gs: null, // no BDL field exists for any season -- confirmed, permanent, not a transient gap.
    totalMinutes: Math.round(totalMinutes),
    totals,
  };
}

// Fetches one player-season's real, non-DNP stat rows from BDL, joins them against /games for each
// team the rows mention (mirrors gameLog.js's fetchPlayerGameLogRawBdl exactly, but keeps the
// regular/playoff split gameLog.js's own consumer doesn't need), and buckets them into two row
// arrays by each game's postseason flag. Returns null on a transient BDL fetch failure.
async function fetchBdlSeasonSplitRows(bdlPlayerId, year) {
  const statsData = await bdlFetch('/player_stats', { 'player_ids[]': [bdlPlayerId], 'seasons[]': [year], per_page: 100 });
  if (!statsData) return null;
  const statRows = (statsData.data ?? []).filter(r => !isDnpRow(r));
  if (!statRows.length) return { regular: [], playoff: [] };

  const teamIds = [...new Set(statRows.map(r => String(r.team?.id)).filter(Boolean))];
  const gameMetaByGameId = new Map();
  for (const teamId of teamIds) {
    const gamesData = await bdlFetch('/games', { 'team_ids[]': [teamId], 'seasons[]': [year], per_page: 100 });
    for (const [id, meta] of buildGameMetaMap(gamesData?.data, teamId)) gameMetaByGameId.set(id, meta);
  }

  const regular = [], playoff = [];
  for (const row of statRows) {
    const meta = gameMetaByGameId.get(row.game?.id);
    if (!meta) continue; // all-star/exhibition, same exclusion as gameLog.js
    (meta.postseason ? playoff : regular).push(row);
  }
  return { regular, playoff };
}

// One BDL-derived {regRow, postRow} pair for a single season. espnTeamAbbrLookup is
// schedule.js's buildOpponentLookup output (Map<ABBR, {id, logo}>) -- reused here purely for its
// abbreviation -> ESPN team id join, same join Phase 2's schedule migration already needed.
async function computeBdlSeasonRow(bdlPlayerId, year, espnTeamAbbrLookup) {
  const splitRows = await fetchBdlSeasonSplitRows(bdlPlayerId, year);
  if (!splitRows) return { regRow: null, postRow: null };
  const { regular, playoff } = splitRows;

  const anyRow = regular[0] ?? playoff[0];
  const teamAbbr = anyRow?.team?.abbreviation;
  const espnTeamId = teamAbbr ? espnTeamAbbrLookup.get(String(teamAbbr).toUpperCase())?.id ?? null : null;

  return {
    regRow: aggregateToSeasonRow(year, espnTeamId, regular),
    postRow: aggregateToSeasonRow(year, espnTeamId, playoff),
  };
}

const SEASON_STATS_TTL_MS = 15 * 60 * 1000; // matches espn/playerStats.js's PLAYER_TTL_MS
const bdlSeasonStatsCache = {};

// Merges ESPN's real season rows (always fetched, covers every season including pre-2008) with
// BDL-derived rows for every year >= BDL_MIN_SEASON that ESPN's own data shows the player having.
// A year not in ESPN's data at all is never independently discovered from BDL -- same "trust ESPN's
// known season list, only replace the stats" design as Phase 1a/2, not a new limitation.
async function computeHybridSeasonStatsUncached(espnPlayerId) {
  const espnResult = await espn.getPlayerSeasonStats(espnPlayerId);
  const { regSeasons, postSeasons } = espnResult;
  // Both null -> ESPN itself failed transiently; nothing safe to merge into. Propagate the failure
  // rather than silently returning BDL-only data that would look complete but isn't.
  if (regSeasons === null && postSeasons === null) return espnResult;

  const bdlPlayerId = await resolveBdlPlayerId(espnPlayerId);
  if (bdlPlayerId == null) return espnResult; // identity unresolved -- graceful fallback to pure ESPN

  const allYears = new Set([...(regSeasons ?? []).map(r => r.year), ...(postSeasons ?? []).map(r => r.year)]);
  const bdlYears = [...allYears].filter(y => Number(y) >= BDL_MIN_SEASON);
  if (!bdlYears.length) return espnResult; // player has no BDL-era seasons at all

  const espnTeams = await espn.getTeams();
  const espnTeamAbbrLookup = buildOpponentLookup(espnTeams);

  const bdlRowsByYear = Object.fromEntries(
    await Promise.all(bdlYears.map(async y => [y, await computeBdlSeasonRow(bdlPlayerId, y, espnTeamAbbrLookup)]))
  );

  // Separate merge functions per split (not one shared closure) since each pulls a different field
  // (regRow vs postRow) off the same per-year bdlRowsByYear entries.
  const mergeReg = (source) => {
    if (source === null) return null;
    const kept = source.filter(r => !bdlYears.includes(r.year));
    const added = bdlYears.map(y => bdlRowsByYear[y].regRow).filter(Boolean);
    return kept.concat(added).sort((a, b) => a.year.localeCompare(b.year));
  };
  const mergePost = (source) => {
    if (source === null) return null;
    const kept = source.filter(r => !bdlYears.includes(r.year));
    const added = bdlYears.map(y => bdlRowsByYear[y].postRow).filter(Boolean);
    return kept.concat(added).sort((a, b) => a.year.localeCompare(b.year));
  };

  return {
    regSeasons: mergeReg(regSeasons),
    postSeasons: mergePost(postSeasons),
  };
}

function getPlayerSeasonStatsBdl(espnPlayerId) {
  return withTtlCache(bdlSeasonStatsCache, espnPlayerId, SEASON_STATS_TTL_MS, () => computeHybridSeasonStatsUncached(espnPlayerId));
}

module.exports = {
  getPlayerSeasonStatsBdl,
  // exported for unit tests:
  aggregateToSeasonRow, addRowToTotals, computeHybridSeasonStatsUncached,
};
