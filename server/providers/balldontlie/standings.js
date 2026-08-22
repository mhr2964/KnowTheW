// New capability, not a migration -- BDL's /standings gives games-behind and home/away/conference
// split records that ESPN's merged team data doesn't have (espn/client.js's fetchTeams only merges
// a bare W-L record + a formatted seed label onto each team, no GB/splits). Joined to ESPN's team
// identity (id/slug/logo/color) by abbreviation -- same proven join schedule.js already uses
// (buildOpponentLookup), reused here rather than a new BDL<->ESPN id map, since standings.js's own
// live spike (2026-08-21) confirmed BDL's team.abbreviation matches ESPN's derived-from-logo tricode
// the same way schedule.js already relies on.

const { bdlFetch } = require('./client');
const espn = require('../espn');

function buildTeamLookup(espnTeams) {
  const map = new Map();
  for (const t of espnTeams ?? []) {
    map.set(String(t.abbreviation).toUpperCase(), t);
  }
  return map;
}

function mapRowToStanding(row, lookup) {
  const identity = lookup.get(String(row.team?.abbreviation ?? '').toUpperCase());
  return {
    teamId: identity?.id ?? String(row.team?.id ?? ''),
    slug: identity?.slug ?? null,
    name: identity?.name ?? row.team?.full_name ?? null,
    abbreviation: row.team?.abbreviation ?? null,
    logo: identity?.logo ?? null,
    color: identity?.color ?? null,
    conference: row.conference ?? null,
    wins: row.wins ?? null,
    losses: row.losses ?? null,
    winPct: row.win_percentage ?? null,
    gamesBehind: row.games_behind ?? null,
    homeRecord: row.home_record ?? null,
    awayRecord: row.away_record ?? null,
    conferenceRecord: row.conference_record ?? null,
    playoffSeed: row.playoff_seed ?? null,
  };
}

// `season` is REQUIRED, not optional -- confirmed live (2026-08-21) that omitting it does not
// default to the current season; it returns every season back to 2008 in one unfiltered response
// (235 rows for a 13-team, ~18-season league). The default-to-current-year decision lives one layer
// up, in index.js's getStandings(), not here -- this function only does what it's told.
async function fetchStandingsBdl(season) {
  const [data, espnTeams] = await Promise.all([
    bdlFetch('/standings', { season, per_page: 100 }),
    espn.getTeams(),
  ]);
  if (!data) return null;
  const lookup = buildTeamLookup(espnTeams);
  return (data.data ?? []).map(row => mapRowToStanding(row, lookup));
}

module.exports = { fetchStandingsBdl };
