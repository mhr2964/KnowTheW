// wnbaFranchiseLineage.js — year-range franchise identities for WNBA teams with relocations.
//
// Shape: { [teamId]: Array<{ startYear, endYear, name, location }> }
//   startYear / endYear are inclusive season years.
//   endYear: null means "current identity, ongoing."
//   Teams without an entry have never relocated or renamed — callers fall back to current team data.
//
// Sources (Wikipedia, verified 2026-05-11):
//   Dallas Wings      — https://en.wikipedia.org/wiki/Dallas_Wings
//   Las Vegas Aces    — https://en.wikipedia.org/wiki/Las_Vegas_Aces
//   Connecticut Sun   — https://en.wikipedia.org/wiki/Connecticut_Sun
//
// All boundaries are clean season-to-season transitions; no mid-season name changes.
// Team IDs verified against server/constants/wnbaFounded.js.

const WNBA_FRANCHISE_LINEAGE = Object.freeze({
  // Dallas Wings (id 3) — Detroit Shock 1998-2009, Tulsa Shock 2010-2015, Dallas Wings 2016-
  '3': Object.freeze([
    Object.freeze({ startYear: 1998, endYear: 2009, name: 'Detroit Shock',  location: 'Detroit' }),
    Object.freeze({ startYear: 2010, endYear: 2015, name: 'Tulsa Shock',    location: 'Tulsa' }),
    Object.freeze({ startYear: 2016, endYear: null, name: 'Dallas Wings',   location: 'Dallas' }),
  ]),

  // Las Vegas Aces (id 17) — Utah Starzz 1997-2002, SA Silver Stars 2003-2013, SA Stars 2014-2017, LV Aces 2018-
  '17': Object.freeze([
    Object.freeze({ startYear: 1997, endYear: 2002, name: 'Utah Starzz',              location: 'Utah' }),
    Object.freeze({ startYear: 2003, endYear: 2013, name: 'San Antonio Silver Stars', location: 'San Antonio' }),
    Object.freeze({ startYear: 2014, endYear: 2017, name: 'San Antonio Stars',        location: 'San Antonio' }),
    Object.freeze({ startYear: 2018, endYear: null, name: 'Las Vegas Aces',           location: 'Las Vegas' }),
  ]),

  // Connecticut Sun (id 18) — Orlando Miracle 1999-2002, Connecticut Sun 2003-
  '18': Object.freeze([
    Object.freeze({ startYear: 1999, endYear: 2002, name: 'Orlando Miracle', location: 'Orlando' }),
    Object.freeze({ startYear: 2003, endYear: null, name: 'Connecticut Sun', location: 'Connecticut' }),
  ]),
});

// Returns { name, location } for the franchise identity in a given season year.
// fallbackTeam must have { name, location } (the current ESPN team object works directly).
// For teams without a lineage entry, always returns fallbackTeam.name / fallbackTeam.location.
// endYear: null is treated as "currently ongoing" — matches any year >= startYear.
function nameForYear(teamId, year) {
  const entries = WNBA_FRANCHISE_LINEAGE[String(teamId)];
  if (!entries) return null; // no lineage entry — caller uses current team data
  const match = entries.find(e =>
    year >= e.startYear && (e.endYear === null || year <= e.endYear)
  );
  return match ? { name: match.name, location: match.location } : null;
}

// Returns { name, location } for the franchise identity in a given season year.
// Always returns something: falls back to fallbackTeam when the team has no lineage entry
// or when the year is outside all known ranges.
function getFranchiseIdentity(teamId, year, fallbackTeam) {
  const result = nameForYear(teamId, year);
  if (result) return result;
  return { name: fallbackTeam.name, location: fallbackTeam.location };
}

module.exports = { WNBA_FRANCHISE_LINEAGE, nameForYear, getFranchiseIdentity };
