// seasonInfo.js — pure assembly function for the /api/teams/:id/season-info response.
//
// buildSeasonInfo(team, season, currentYear) returns the season-info response shape:
//   { teamId, season, name, location, record?, seedLabel?, conference?, champion? }
//
// Fields are omitted (not null) when their source value is unavailable, matching getTeams() behavior.
//
// Current-season fast path: proxies from the team object (already contains current standings via
// getTeams() which merges fetchStandings() inline). No additional ESPN call.
//
// Past-season path: calls fetchStandingsForYear(season) which already handles the pre-2003 ESPN
// corrupted scalar bug (sums Home+Road instead of using scalar wins/losses). Do not duplicate
// that logic here — this is the intentional dependency.
//
// Franchise name: getFranchiseIdentity(teamId, season, team) returns the season-correct name and
// location from WNBA_FRANCHISE_LINEAGE. Falls back to current team data for non-aliased teams.
//
// champion field: from isChampion(season, historicalName) — resolves lineage aliases internally.
// Included in all responses so a future frontend can show a trophy glyph without a new endpoint.

'use strict';

const { fetchStandingsForYear, isChampion } = require('./historyAggregator');
const { formatSeedLabel }                   = require('./espnClient');
const { getFranchiseIdentity }              = require('../constants/wnbaFranchiseLineage');

// Assembles the season-info response for a given team and season.
// team: current team object from getTeams() — must have { id, name, location, record?, seedLabel?, conference? }
// season: integer year
// currentYear: integer — caller passes new Date().getFullYear() to keep this function pure/testable
//
// Returns an object matching the response shape. Record/seed/conference fields are omitted when
// the source value is null so client null-checks stay uniform.
async function buildSeasonInfo(team, season, currentYear) {
  const teamId = String(team.id);
  const { name, location } = getFranchiseIdentity(teamId, season, team);

  if (season === currentYear) {
    // Fast path: proxy from the current team object (populated by fetchStandings() in getTeams()).
    const result = { teamId, season, name, location };
    if (team.record      != null) result.record      = team.record;
    if (team.seedLabel   != null) result.seedLabel   = team.seedLabel;
    if (team.conference  != null) result.conference  = team.conference;
    // isChampion checks against current display name + aliases; current year may not be final yet.
    const champion = isChampion(season, team.name);
    if (champion) result.champion = true;
    return result;
  }

  // Past-season path: fetch standings for that year.
  // fetchStandingsForYear handles the pre-2003 ESPN scalar corruption — do not re-implement here.
  const standings = await fetchStandingsForYear(season);
  const entry = standings ? standings[teamId] : null;

  const result = { teamId, season, name, location };

  if (entry) {
    // Assemble record string only when both wins and losses are available.
    if (entry.wins != null && entry.losses != null) {
      result.record = `${entry.wins}-${entry.losses}`;
    }
    const seedLabel = formatSeedLabel(entry.seed);
    if (seedLabel) result.seedLabel = seedLabel;
    if (entry.conference) result.conference = entry.conference;
  }
  // isChampion resolves via historical name aliases (e.g. 'Detroit Shock' → Dallas Wings).
  // We check using the franchise name for this season so pre-lineage champion flags work correctly.
  const champion = isChampion(season, name);
  if (champion) result.champion = true;

  return result;
}

module.exports = { buildSeasonInfo };
