// Betting odds for upcoming games, straight off BDL's own /odds endpoint. BDL-only, no ESPN
// equivalent -- feeds a compact line/total surface on TeamSchedulePage.jsx's upcoming games.
//
// Spiked live, 2026-08-22 (5 upcoming games, next 5 days): MULTIPLE sportsbooks post a line per
// game (fanduel, fanatics, draftkings, caesars, betrivers, betmgm all seen -- a game can have
// anywhere from 1 to 6 rows depending on how far out it is and which books have posted yet), each
// with its own spread/moneyline/total -- these genuinely disagree with each other by a point or
// more, this isn't one canonical line with vendor noise. Rather than build a full odds-comparison
// table (a much bigger feature than "surface the line next to the game"), this picks ONE
// representative vendor per game via PREFERRED_VENDOR_ORDER (the two biggest US retail
// sportsbooks first, then whichever else is available) and returns just that one row, vendor name
// included so the display can attribute it rather than imply a single consensus line.
const { bdlFetch } = require('./client');

const PREFERRED_VENDOR_ORDER = ['draftkings', 'fanduel', 'betmgm', 'caesars', 'betrivers', 'fanatics'];

// Pure: picks one representative row from a game's set of vendor quotes, preferred-vendor-first.
// Split out from fetchOddsForGamesBdl so the selection policy is unit-testable without a network
// call, same pattern as schedule.js's mapGameToScheduleEvent / idMap.js's matchPlayerCandidate.
function pickPreferredOdds(gameRows) {
  if (!gameRows?.length) return null;
  return PREFERRED_VENDOR_ORDER.map(v => gameRows.find(r => r.vendor === v)).find(Boolean) ?? gameRows[0];
}

function mapOddsRow(row) {
  return {
    vendor: row.vendor,
    spread: { home: row.spread_home_value ?? null, away: row.spread_away_value ?? null },
    moneyline: { home: row.moneyline_home_odds ?? null, away: row.moneyline_away_odds ?? null },
    total: { value: row.total_value ?? null, over: row.total_over_odds ?? null, under: row.total_under_odds ?? null },
    updatedAt: row.updated_at ?? null,
  };
}

// Pages through /odds by explicit game_ids[] (a bounded, already-known set from the caller's own
// schedule fetch -- no date-range guessing needed) -- same cursor-pagination shape as
// injuries.js's fetchAllInjuriesBdl, since a handful of upcoming games at up to 6 vendors each can
// still exceed one 25-row page.
async function fetchOddsForGamesBdl(bdlGameIds) {
  if (!bdlGameIds?.length) return new Map();

  const rows = [];
  let cursor;
  for (;;) {
    const params = { 'game_ids[]': bdlGameIds, ...(cursor ? { cursor } : {}) };
    const data = await bdlFetch('/odds', params);
    rows.push(...(data?.data ?? []));
    cursor = data?.meta?.next_cursor;
    if (!cursor) break;
  }

  const byGame = new Map();
  for (const row of rows) {
    if (!byGame.has(row.game_id)) byGame.set(row.game_id, []);
    byGame.get(row.game_id).push(row);
  }

  const picked = new Map();
  for (const [gameId, gameRows] of byGame) {
    picked.set(gameId, mapOddsRow(pickPreferredOdds(gameRows)));
  }
  return picked;
}

module.exports = { fetchOddsForGamesBdl, mapOddsRow, pickPreferredOdds, PREFERRED_VENDOR_ORDER };
