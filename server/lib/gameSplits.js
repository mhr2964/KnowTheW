// Aggregates a player's per-game log (from getPlayerGameLog) into BrefTable-ready split tables.
// ESPN's free/undocumented endpoints expose no shot-location or zone data anywhere (checked
// detailed-stats, gamelog, and the PBP walk in providers/espn/gameSummary.js) — a real bref-style
// shooting-by-zone table isn't feasible without a paid provider. These are the splits that ARE
// derivable from what the gamelog actually returns: Home/Away, Monthly, and By Opponent.
//
// Unlike normalizeGameLog (which returns ESPN's raw 0-100 percent scale for the client to
// convert), this returns columns/rows already in BrefTable's convention — its whole job is to be
// BrefTable-ready, not a provider-shape passthrough.

'use strict';

// Keyed by the gamelog's percentage column -> its paired "made-attempted" combined-string column.
// A group's shooting pct must come from summed makes/attempts, never an average of per-game
// percentages (a 1-for-2 game and a 0-for-1 game do not average to 25%).
const PCT_PAIR = {
  fieldGoalPct: 'fieldGoalsMade-fieldGoalsAttempted',
  threePointPct: 'threePointFieldGoalsMade-threePointFieldGoalsAttempted',
  freeThrowPct: 'freeThrowsMade-freeThrowsAttempted',
};
const MA_KEYS = new Set(Object.values(PCT_PAIR));

function parseMA(str) {
  const m = typeof str === 'string' && str.match(/^(\d+)-(\d+)$/);
  return m ? { made: Number(m[1]), att: Number(m[2]) } : null;
}

function groupKey(game, splitType) {
  if (splitType === 'homeaway') {
    return game.atVs === 'vs' ? { key: 'home', label: 'Home' } : { key: 'away', label: 'Away' };
  }
  if (splitType === 'opponent') {
    return { key: game.opponent, label: game.opponent };
  }
  const label = new Date(game.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  return { key: label, label };
}

const SPLIT_LABEL = { homeaway: 'Split', month: 'Month', opponent: 'Opp' };

/**
 * @param {{columns: {key:string,label:string,kind:string}[]}} log - from getPlayerGameLog
 * @param {object[]} games - from getPlayerGameLog (same season the log came from)
 * @param {'homeaway'|'month'|'opponent'} splitType
 * @returns {{columns:object[], rows:Array[]}|null}
 */
function buildSplits(log, games, splitType) {
  if (!log?.columns?.length || !games?.length) return null;

  const groups = new Map();
  for (const g of games) {
    const { key, label } = groupKey(g, splitType);
    if (!groups.has(key)) groups.set(key, { label, games: [] });
    groups.get(key).games.push(g);
  }

  const columns = [
    { key: 'split', label: SPLIT_LABEL[splitType] ?? 'Split' },
    { key: 'gp', label: 'G' },
    ...log.columns,
  ];

  const orderedKeys = splitType === 'homeaway'
    ? ['home', 'away'].filter(k => groups.has(k))
    : splitType === 'month'
      ? [...groups.keys()].sort((a, b) => new Date(a) - new Date(b))
      : [...groups.keys()].sort((a, b) => groups.get(b).games.length - groups.get(a).games.length);

  const rows = orderedKeys.map(key => {
    const { label, games: groupGames } = groups.get(key);

    const maTotals = {};
    for (const maKey of MA_KEYS) {
      let made = 0, att = 0;
      for (const g of groupGames) {
        const parsed = parseMA(g.stats[maKey]);
        if (parsed) { made += parsed.made; att += parsed.att; }
      }
      maTotals[maKey] = { made, att };
    }

    const cells = log.columns.map(col => {
      if (MA_KEYS.has(col.key)) {
        const { made, att } = maTotals[col.key];
        return `${made}-${att}`;
      }
      if (PCT_PAIR[col.key]) {
        const { made, att } = maTotals[PCT_PAIR[col.key]];
        return att > 0 ? made / att : null;
      }
      const nums = groupGames.map(g => Number(g.stats[col.key])).filter(n => !Number.isNaN(n));
      return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
    });

    return [label, groupGames.length, ...cells];
  });

  return { columns, rows };
}

module.exports = { buildSplits };
