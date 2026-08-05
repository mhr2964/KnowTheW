// legacyRoster.js — builds a roster response from LEGACY_PLAYERS_BULK player_IDs. Moved
// out of routes/teams.js (formerly routes/api.js) verbatim during the God-Module split —
// no behavior change.
//
// Used by both the numeric-ESPN-id path and the synthetic 'legacy-...' defunct-team path
// in the /teams/:id/roster route.
const { LEGACY_PLAYERS_BULK } = require('../constants/legacyPlayerBulk');

function buildLegacyRosterResponse(team, season, playerIds) {
  const players = playerIds.map(pid => {
    const p = LEGACY_PLAYERS_BULK[pid];
    if (!p) return null;                // safety: roster references a missing player
    const seasonRow = p.seasons?.[season] ?? null;
    return {
      id:           p.id,
      name:         p.name,
      position:     p.position ?? '',
      positionName: p.position ?? '',
      jersey:       null,
      headshot:     null,
      height:       null,
      weight:       null,
      age:          seasonRow?.age ?? null,
      college:      null,
      birthPlace:   null,
      experience:   null,
      teamId:       team.id,
      teamName:     team.name,
      legacy:       true,
      dataSource:   'legacy-bulk',
    };
  }).filter(Boolean);
  return { team, players, season, dataSource: 'legacy-bulk' };
}

module.exports = { buildLegacyRosterResponse };
