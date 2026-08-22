// Player injury report, straight off BDL's own player_injuries endpoint. BDL-only, no ESPN
// equivalent -- feeds a player-page widget (this player only) and a team roster-page widget (this
// team's whole current report).
//
// Spiked live, 2026-08-22: 40 rows league-wide (paginated 25/page via cursor -- must page through
// to get the full list, `meta.next_cursor` present on a partial page). Only two statuses seen so
// far ('Out', 'Day-To-Day') but this is observed, not documented as an enum -- treated as an open
// string, not a fixed set. `return_date` is a free-text estimate like "Aug 30" (no year, and BDL
// gives no guarantee of a parseable format at all -- e.g. a season-ending injury might read
// differently) -- passed through as-is rather than parsed into a real Date, which would be a lossy
// guess. `comment` is occasionally absent (2 of 40 rows) -- nullable.
const { bdlFetch } = require('./client');

function mapInjuryRow(row) {
  return {
    status: row.status ?? null,
    returnDate: row.return_date ?? null,
    comment: row.comment ?? null,
  };
}

// Pages through the full player_injuries list once (small league-wide dataset -- 40 rows as of the
// spike -- a handful of pages at most), rather than exposing cursor pagination up through the
// provider layer for a list this size.
async function fetchAllInjuriesBdl(params) {
  const rows = [];
  let cursor;
  for (;;) {
    const data = await bdlFetch('/player_injuries', cursor ? { ...params, cursor } : params);
    rows.push(...(data?.data ?? []));
    cursor = data?.meta?.next_cursor;
    if (!cursor) break;
  }
  return rows;
}

async function fetchPlayerInjuryBdl(bdlPlayerId) {
  const rows = await fetchAllInjuriesBdl({ 'player_ids[]': [bdlPlayerId] });
  return rows.length ? mapInjuryRow(rows[0]) : null;
}

// Returns rows in BDL's own raw shape (player.first_name/last_name intact) -- the caller resolves
// each row's internal playerId by name (see idMap.js's resolveEspnIdByName, same identity-bridge
// pattern as getLeagueShotZoneLeaders) before this reaches routes/client.
async function fetchTeamInjuriesBdl(bdlTeamId) {
  const rows = await fetchAllInjuriesBdl({ 'team_ids[]': [bdlTeamId] });
  return rows.map(row => ({ ...mapInjuryRow(row), playerName: `${row.player.first_name} ${row.player.last_name}` }));
}

module.exports = { fetchPlayerInjuryBdl, fetchTeamInjuriesBdl, mapInjuryRow };
