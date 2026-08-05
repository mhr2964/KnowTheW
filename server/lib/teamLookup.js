// teamLookup.js — shared "resolve a numeric team id against getTeams()" helper.
//
// Six route handlers across teams.js each independently fetched getTeams() and ran the
// same `.find(t => String(t.id) === teamId)` scan. Extracted so the lookup itself can't
// drift, while leaving 404 handling in each route — a couple of routes need to check a
// legacy-team branch first, so the "not found" response isn't uniform enough to fold in here.

const { getProvider } = require('../providers');

// Returns the team object for teamId (string), or null if no team matches.
async function findTeam(teamId) {
  const teams = await getProvider().getTeams();
  return teams.find(t => String(t.id) === teamId) ?? null;
}

module.exports = { findTeam };
