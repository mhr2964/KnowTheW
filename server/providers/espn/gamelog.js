// ESPN player gamelog: fetch + normalize. Previously the route returned ESPN's raw per-game stat
// ARRAYS plus a parallel `names` array, and the client decoded them positionally and owned the
// label/percent-formatting knowledge. That coupled the client to ESPN's stat-key set and ordering.
//
// Now the provider returns named-key stats plus `columns` metadata, so the client renders generically
// from whatever columns it's handed — no positional decode, no source-specific labels in the client.
//
// `normalizeGameLog` is split out as a pure function so it can be characterization-tested against a
// captured fixture without a network call (the exact stat order + the 0-100 percent values that the
// client renders as 3-dp fractions are the regression-prone bits).

const { ESPN_WEB } = require('./client');

// Presentation metadata for ESPN's gamelog stat keys. `kind` drives client formatting:
// 'pct' values are 0-100 and render as a 3-dp fraction (e.g. 60.0 -> ".600"); 'num' renders as-is.
const LABELS = {
  minutes: 'MP', points: 'PTS', totalRebounds: 'REB',
  assists: 'AST', steals: 'STL', blocks: 'BLK', turnovers: 'TOV',
  'fieldGoalsMade-fieldGoalsAttempted': 'FG',
  fieldGoalPct: 'FG%',
  'threePointFieldGoalsMade-threePointFieldGoalsAttempted': '3P',
  threePointPct: '3P%',
  'freeThrowsMade-freeThrowsAttempted': 'FT',
  freeThrowPct: 'FT%',
  fouls: 'PF',
};
const PCT_KEYS = new Set(['fieldGoalPct', 'threePointPct', 'freeThrowPct']);

function columnFor(name) {
  return { key: name, label: LABELS[name] ?? name, kind: PCT_KEYS.has(name) ? 'pct' : 'num' };
}

/**
 * Pure transform of ESPN's gamelog response into the normalized {columns, games} shape.
 * @returns {{columns: {key:string,label:string,kind:string}[], games: object[]}}
 */
function normalizeGameLog(data) {
  const names = data.names || [];
  const eventMeta = data.events || {};
  const columns = names.map(columnFor);

  const games = [];
  (data.seasonTypes || []).forEach((st) => {
    (st.categories || []).forEach((cat) => {
      (cat.events || []).forEach((evt) => {
        const meta = eventMeta[evt.eventId];
        if (!meta || !evt.stats) return;
        const isHome = meta.atVs === 'vs';
        games.push({
          date: meta.gameDate,
          opponent: meta.opponent?.abbreviation || '?',
          atVs: meta.atVs || 'vs',
          result: meta.gameResult || '?',
          teamScore: isHome ? parseInt(meta.homeTeamScore) : parseInt(meta.awayTeamScore),
          oppScore: isHome ? parseInt(meta.awayTeamScore) : parseInt(meta.homeTeamScore),
          stats: Object.fromEntries(names.map((n, i) => [n, evt.stats[i]])),
        });
      });
    });
  });

  games.sort((a, b) => new Date(a.date) - new Date(b.date));
  return { columns, games };
}

/** Fetch + normalize a player's gamelog for a season. Returns null on a non-2xx response. */
async function getPlayerGameLog(playerId, season) {
  const url = new URL(`${ESPN_WEB}/athletes/${playerId}/gamelog`);
  if (season) url.searchParams.set('season', season);
  const raw = await fetch(url.toString());
  if (!raw.ok) return null;
  return normalizeGameLog(await raw.json());
}

/**
 * Pure transform: flatten ESPN's gamelog into per-event metadata used to select which games to pull
 * play-by-play for. Returns [{ eventId, seasonTypeName, eventNote, opponentId }]. Filtering (season
 * type, all-star exclusion, franchise opponents) is the caller's job — it needs the team list.
 */
function extractGameLogEvents(data) {
  const eventMeta = data.events || {};
  const out = [];
  (data.seasonTypes || []).forEach((st) => {
    (st.categories || []).forEach((cat) => {
      (cat.events || []).forEach((evt) => {
        if (!evt.eventId) return;
        const meta = eventMeta[evt.eventId];
        out.push({
          eventId: evt.eventId,
          seasonTypeName: st.displayName ?? '',
          eventNote: meta?.eventNote ?? '',
          opponentId: String(meta?.opponent?.id ?? ''),
        });
      });
    });
  });
  return out;
}

/** Fetch the gamelog and return per-event metadata for PBP selection. Null on non-2xx. */
async function getGameLogEvents(playerId, season, seasontype) {
  const url = new URL(`${ESPN_WEB}/athletes/${playerId}/gamelog`);
  if (season) url.searchParams.set('season', season);
  if (seasontype) url.searchParams.set('seasontype', seasontype);
  const raw = await fetch(url.toString());
  if (!raw.ok) return null;
  return extractGameLogEvents(await raw.json());
}

module.exports = { getPlayerGameLog, normalizeGameLog, getGameLogEvents, extractGameLogEvents };
