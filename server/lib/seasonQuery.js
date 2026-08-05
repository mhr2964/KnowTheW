// seasonQuery.js — shared ?season= query-param parser for the roster, season-info, and
// team-stats routes. Moved out of routes/api.js verbatim during the God-Module split
// (see refactor-log.md) — no behavior change.
//
// Default to the current year, accept any 4-digit year, reject everything else. Returns
// { season, currentYear } on success or { error } carrying the 400 message. The schedule
// route has stricter rules (season required, 1997 floor) and deliberately does not use this.
function parseSeasonQuery(req) {
  const currentYear = new Date().getFullYear();
  const raw = req.query.season;
  if (raw === undefined || raw === '') return { season: currentYear, currentYear };
  if (/^\d{4}$/.test(raw)) return { season: parseInt(raw, 10), currentYear };
  return { error: 'season must be a 4-digit year (e.g. 2024)' };
}

module.exports = { parseSeasonQuery };
