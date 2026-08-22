// Phase 1a: player game log sourced from BallDontLie, for season >= BDL_MIN_SEASON. Confirmed by
// spike: BDL's /player_stats already returns one row per game with real integer box-score values
// (fgm/fga/pts/etc, not rounded), but each row's embedded `game` object is minimal ({id, date,
// season} only -- no opponent, home/away flag, score, or postseason flag). Schedule metadata comes
// from a separate /games join, same pattern getRegularSeasonEventIdsBdl (./plays.js) already uses.
//
// The `stats` object's keys/format are NOT free to choose: gameSplits.js (server/lib/gameSplits.js,
// the /splits route's aggregator) hardcodes ESPN's exact composite key strings
// ('fieldGoalsMade-fieldGoalsAttempted' etc) and parses their values as "made-attempted" strings via
// regex. This module reuses espn/gamelog.js's LABELS/PCT_KEYS/columnFor rather than duplicating those
// magic strings, so the two providers can never drift out of sync with what gameSplits.js expects.

const { bdlFetch } = require('./client');
const { LABELS, columnFor } = require('../espn/gamelog');
const { makeSeasonCache } = require('../cache');
const { isRealFranchise } = require('./idMap');

const gameLogCache = makeSeasonCache();

const COLUMN_KEYS = Object.keys(LABELS);
const COLUMNS = COLUMN_KEYS.map(columnFor);

function pct(made, att) {
  return att > 0 ? Math.round((made / att) * 1000) / 10 : 0; // 0-100 scale, one decimal -- matches ESPN's convention (see teamStats.js)
}

// Pure transform: one BDL /player_stats row -> the shared {key: value} stats bag every column above
// expects. `made ?? 0` guards BDL's confirmed null-for-zero-attempts quirk (fg3m came back null, not
// 0, on a real zero-three-point-attempt game in the spike).
function buildStatsBag(row) {
  const fgm = row.fgm ?? 0, fga = row.fga ?? 0;
  const fg3m = row.fg3m ?? 0, fg3a = row.fg3a ?? 0;
  const ftm = row.ftm ?? 0, fta = row.fta ?? 0;
  return {
    minutes: row.min ?? '0',
    points: row.pts ?? 0,
    totalRebounds: row.reb ?? 0,
    assists: row.ast ?? 0,
    steals: row.stl ?? 0,
    blocks: row.blk ?? 0,
    turnovers: row.turnover ?? 0,
    'fieldGoalsMade-fieldGoalsAttempted': `${fgm}-${fga}`,
    fieldGoalPct: pct(fgm, fga),
    'threePointFieldGoalsMade-threePointFieldGoalsAttempted': `${fg3m}-${fg3a}`,
    threePointPct: pct(fg3m, fg3a),
    'freeThrowsMade-freeThrowsAttempted': `${ftm}-${fta}`,
    freeThrowPct: pct(ftm, fta),
    fouls: row.pf ?? 0,
  };
}

// Pure transform: raw /games rows -> Map<gameId, meta>, keyed by the requesting team's perspective.
// Filters to real franchise-vs-franchise games only (both sides isRealFranchise), same exclusion
// idMap.js's team map and plays.js's getRegularSeasonEventIdsBdl already apply -- an All-Star or
// exhibition game a player appears in via /player_stats must not show up in their game log.
//
// `postseason` is carried through even though this module's own consumer (fetchPlayerGameLogRawBdl,
// below) doesn't filter on it -- a combined career game log intentionally includes both regular and
// playoff games in one list, matching ESPN's own gamelog behavior. seasonStats.js (Phase 1b) reuses
// this same map and DOES need the flag, to split a season's games into regular-season vs playoff
// totals the way ESPN's raw categories structure requires.
function buildGameMetaMap(gamesRows, teamId) {
  const map = new Map();
  for (const g of gamesRows ?? []) {
    if (!isRealFranchise(g.home_team) || !isRealFranchise(g.visitor_team)) continue;
    const isHome = String(g.home_team?.id) === String(teamId);
    const opponent = isHome ? g.visitor_team : g.home_team;
    const teamScore = isHome ? g.home_score : g.away_score;
    const oppScore = isHome ? g.away_score : g.home_score;
    const hasScores = typeof teamScore === 'number' && typeof oppScore === 'number' && g.status_state === 'final';
    map.set(g.id, {
      gameId: g.id,
      date: g.date,
      opponent: opponent?.abbreviation ?? '?',
      atVs: isHome ? 'vs' : '@',
      result: hasScores ? (teamScore > oppScore ? 'W' : 'L') : '?',
      teamScore: hasScores ? teamScore : null,
      oppScore: hasScores ? oppScore : null,
      postseason: !!g.postseason,
    });
  }
  return map;
}

// A BDL /player_stats row exists even for a game the player was on the roster for but did not
// play (DNP-rest/injury) -- confirmed live: min:"0" with every counting stat null. ESPN's own
// gamelog never includes DNP games at all, so a BDL-sourced log must filter these out explicitly
// or it silently invents extra "games" with zero/null stat lines a real game log should never show.
function isDnpRow(row) {
  return row.min == null || row.min === '0' || row.min === '';
}

// Pure transform: player_stats rows + a game-meta map -> the normalized {columns, games} shape
// (schemas.js's GameLogResponse). Rows whose game isn't in the map (all-star/exhibition, filtered
// out above) or that are DNPs are dropped, not errored -- same "silently exclude, don't fail the
// whole log" behavior ESPN's own gamelog effectively gets from its source data never including
// those games at all.
function buildGameLogFromRows(statRows, gameMetaByGameId) {
  const games = [];
  for (const row of statRows ?? []) {
    if (isDnpRow(row)) continue;
    const meta = gameMetaByGameId.get(row.game?.id);
    if (!meta) continue;
    games.push({ ...meta, stats: buildStatsBag(row) });
  }
  games.sort((a, b) => new Date(a.date) - new Date(b.date));
  return { columns: COLUMNS, games };
}

async function fetchPlayerGameLogRawBdl(bdlPlayerId, season) {
  const statsData = await bdlFetch('/player_stats', { 'player_ids[]': [bdlPlayerId], 'seasons[]': [season], per_page: 100 });
  if (!statsData) return null;
  const statRows = statsData.data ?? [];
  if (!statRows.length) return { columns: COLUMNS, games: [] };

  // A player can be traded mid-season -> more than one team id across rows. Fetch /games for every
  // team id that appears, and build one merged meta map keyed by game id (each row's own team.id
  // determines home/away perspective when the map is built per-team, so merging is safe -- no game
  // id can appear under two different teams for the same player-season).
  const teamIds = [...new Set(statRows.map(r => String(r.team?.id)).filter(Boolean))];
  const gameMetaByGameId = new Map();
  for (const teamId of teamIds) {
    const gamesData = await bdlFetch('/games', { 'team_ids[]': [teamId], 'seasons[]': [season], per_page: 100 });
    for (const [id, meta] of buildGameMetaMap(gamesData?.data, teamId)) {
      gameMetaByGameId.set(id, meta);
    }
  }

  return buildGameLogFromRows(statRows, gameMetaByGameId);
}

function fetchPlayerGameLogBdl(bdlPlayerId, season) {
  const key = `${bdlPlayerId}-${season}`;
  return gameLogCache.get(season, key, () => fetchPlayerGameLogRawBdl(bdlPlayerId, season));
}

module.exports = {
  fetchPlayerGameLogBdl, fetchPlayerGameLogRawBdl,
  // exported for unit tests:
  buildStatsBag, buildGameMetaMap, buildGameLogFromRows, isDnpRow, pct,
};
