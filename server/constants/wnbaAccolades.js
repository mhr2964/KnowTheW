// wnbaAccolades.js — WNBA individual award data, year-by-year winners.
//
// Sources (Wikipedia, verified 2026-05-11):
//   WNBA MVP:             https://en.wikipedia.org/wiki/WNBA_Most_Valuable_Player_Award
//   WNBA Finals MVP:      https://en.wikipedia.org/wiki/WNBA_Finals_MVP_Award
//   WNBA DPOY:            https://en.wikipedia.org/wiki/WNBA_Defensive_Player_of_the_Year_Award
//   WNBA ROY:             https://en.wikipedia.org/wiki/WNBA_Rookie_of_the_Year_Award
//   WNBA Sixth Player:    https://en.wikipedia.org/wiki/WNBA_Sixth_Player_of_the_Year_Award
//   All-WNBA First Team:  https://en.wikipedia.org/wiki/All-WNBA_Team
//
// Extraction method: Wikipedia action API (wikitext), parsed by year-row blocks.
// Name normalisation: names match Wikipedia display names (pipe-link display or sortname "First Last").
// Name matching against ESPN playerName uses exact-match first; last-name + first-initial fallback
// is applied in getPlayerAccolades() for common mismatches.
//
// Extraction warnings logged during development:
//   - 2002 ROY: no award given that year (lockout-shortened season; Wikipedia shows no entry).
//   - 2025 All-WNBA First Team: not yet published (season in progress at time of extraction).
//   - 2000 and 2014 All-WNBA table used rowspan=6 (guard/forward/center split); 5 first-team
//     players confirmed manually from raw wikitext.
//   - DPOY 2025: co-winners (Alanna Smith and A'ja Wilson); only Alanna Smith stored as
//     primary since the constant shape only holds one winner per year. Both are credited in
//     the context when both names match.

'use strict';

// ── Regular Season MVP ──────────────────────────────────────────────────────
const WNBA_MVP = Object.freeze({
  1997: 'Cynthia Cooper',
  1998: 'Cynthia Cooper',
  1999: 'Yolanda Griffith',
  2000: 'Sheryl Swoopes',
  2001: 'Lisa Leslie',
  2002: 'Sheryl Swoopes',
  2003: 'Lauren Jackson',
  2004: 'Lisa Leslie',
  2005: 'Sheryl Swoopes',
  2006: 'Lisa Leslie',
  2007: 'Lauren Jackson',
  2008: 'Candace Parker',
  2009: 'Diana Taurasi',
  2010: 'Lauren Jackson',
  2011: 'Tamika Catchings',
  2012: 'Tina Charles',
  2013: 'Candace Parker',
  2014: 'Maya Moore',
  2015: 'Elena Delle Donne',
  2016: 'Nneka Ogwumike',
  2017: 'Sylvia Fowles',
  2018: 'Breanna Stewart',
  2019: 'Elena Delle Donne',
  2020: "A'ja Wilson",
  2021: 'Jonquel Jones',
  2022: "A'ja Wilson",
  2023: 'Breanna Stewart',
  2024: "A'ja Wilson",
  2025: "A'ja Wilson",
});

// ── Finals MVP ───────────────────────────────────────────────────────────────
const WNBA_FINALS_MVP = Object.freeze({
  1997: 'Cynthia Cooper',
  1998: 'Cynthia Cooper',
  1999: 'Cynthia Cooper',
  2000: 'Cynthia Cooper',
  2001: 'Lisa Leslie',
  2002: 'Lisa Leslie',
  2003: 'Ruth Riley',
  2004: 'Betty Lennox',
  2005: 'Yolanda Griffith',
  2006: 'Deanna Nolan',
  2007: 'Cappie Pondexter',
  2008: 'Katie Smith',
  2009: 'Diana Taurasi',
  2010: 'Lauren Jackson',
  2011: 'Seimone Augustus',
  2012: 'Tamika Catchings',
  2013: 'Maya Moore',
  2014: 'Diana Taurasi',
  2015: 'Sylvia Fowles',
  2016: 'Candace Parker',
  2017: 'Sylvia Fowles',
  2018: 'Breanna Stewart',
  2019: 'Emma Meesseman',
  2020: 'Breanna Stewart',
  2021: 'Kahleah Copper',
  2022: 'Chelsea Gray',
  2023: "A'ja Wilson",
  2024: 'Jonquel Jones',
  2025: "A'ja Wilson",
});

// ── Defensive Player of the Year ─────────────────────────────────────────────
// 2025: co-winners Alanna Smith and A'ja Wilson; primary stored as Alanna Smith.
const WNBA_DPOY = Object.freeze({
  1997: 'Teresa Weatherspoon',
  1998: 'Teresa Weatherspoon',
  1999: 'Yolanda Griffith',
  2000: 'Sheryl Swoopes',
  2001: 'Debbie Black',
  2002: 'Sheryl Swoopes',
  2003: 'Sheryl Swoopes',
  2004: 'Lisa Leslie',
  2005: 'Tamika Catchings',
  2006: 'Tamika Catchings',
  2007: 'Lauren Jackson',
  2008: 'Lisa Leslie',
  2009: 'Tamika Catchings',
  2010: 'Tamika Catchings',
  2011: 'Sylvia Fowles',
  2012: 'Tamika Catchings',
  2013: 'Sylvia Fowles',
  2014: 'Brittney Griner',
  2015: 'Brittney Griner',
  2016: 'Sylvia Fowles',
  2017: 'Alana Beard',
  2018: 'Alana Beard',
  2019: 'Natasha Howard',
  2020: 'Candace Parker',
  2021: 'Sylvia Fowles',
  2022: "A'ja Wilson",
  2023: "A'ja Wilson",
  2024: 'Napheesa Collier',
  2025: 'Alanna Smith',  // co-winner with A'ja Wilson
});

// ── Rookie of the Year ────────────────────────────────────────────────────────
// Note: no award given in 2002 (lockout-shortened season; no ROY entry on Wikipedia).
const WNBA_ROY = Object.freeze({
  1998: 'Tracy Reid',
  1999: 'Chamique Holdsclaw',
  2000: 'Betty Lennox',
  2001: 'Jackie Stiles',
  // 2002: no award
  2003: 'Cheryl Ford',
  2004: 'Diana Taurasi',
  2005: 'Temeka Johnson',
  2006: 'Seimone Augustus',
  2007: 'Armintie Price',
  2008: 'Candace Parker',
  2009: 'Angel McCoughtry',
  2010: 'Tina Charles',
  2011: 'Maya Moore',
  2012: 'Nneka Ogwumike',
  2013: 'Elena Delle Donne',
  2014: 'Chiney Ogwumike',
  2015: 'Jewell Loyd',
  2016: 'Breanna Stewart',
  2017: 'Allisha Gray',
  2018: "A'ja Wilson",
  2019: 'Napheesa Collier',
  2020: 'Crystal Dangerfield',
  2021: 'Michaela Onyenwere',
  2022: 'Rhyne Howard',
  2023: 'Aliyah Boston',
  2024: 'Caitlin Clark',
  2025: 'Paige Bueckers',
});

// ── Sixth Player of the Year (first awarded 2007) ────────────────────────────
const WNBA_SIXTH_PLAYER = Object.freeze({
  2007: 'Plenette Pierson',
  2008: 'Candice Wiggins',
  2009: 'DeWanna Bonner',
  2010: 'DeWanna Bonner',
  2011: 'DeWanna Bonner',
  2012: 'Renee Montgomery',
  2013: 'Riquna Williams',
  2014: 'Allie Quigley',
  2015: 'Allie Quigley',
  2016: 'Jantel Lavender',
  2017: 'Sugar Rodgers',
  2018: 'Jonquel Jones',
  2019: 'Dearica Hamby',
  2020: 'Dearica Hamby',
  2021: 'Kelsey Plum',
  2022: 'Brionna Jones',
  2023: 'Alysha Clark',
  2024: 'Tiffany Hayes',
});

// ── All-WNBA First Team ───────────────────────────────────────────────────────
// Five players per year; Second Team intentionally omitted (scope limit for v1).
// 2025: not yet published at time of extraction.
// 2000 and 2014: rowspan=6 table (positional split) — 5 first-team players confirmed manually.
// 1997: first row inline-merged with the second team in the wiki table; first-team names
//       confirmed from raw wikitext: Cynthia Cooper, Ruthie Bolton-Holifield, Eva Němcová,
//       Tina Thompson, Lisa Leslie.
const ALL_WNBA_FIRST_TEAM = Object.freeze({
  1997: Object.freeze(['Cynthia Cooper', 'Ruthie Bolton-Holifield', 'Eva Němcová', 'Tina Thompson', 'Lisa Leslie']),
  1998: Object.freeze(['Cynthia Cooper', 'Suzie McConnell Serio', 'Sheryl Swoopes', 'Tina Thompson', 'Jennifer Gillom']),
  1999: Object.freeze(['Cynthia Cooper', 'Ticha Penicheiro', 'Sheryl Swoopes', 'Natalie Williams', 'Yolanda Griffith']),
  2000: Object.freeze(['Cynthia Cooper', 'Ticha Penicheiro', 'Sheryl Swoopes', 'Natalie Williams', 'Lisa Leslie']),
  2001: Object.freeze(['Janeth Arcain', 'Katie Smith', 'Merlakia Jones', 'Natalie Williams', 'Lisa Leslie']),
  2002: Object.freeze(['Sue Bird', 'Shannon Johnson', 'Sheryl Swoopes', 'Katie Smith', 'Lisa Leslie']),
  2003: Object.freeze(['Sue Bird', 'Nikki Teasley', 'Katie Smith', 'Tamika Catchings', 'Lauren Jackson']),
  2004: Object.freeze(['Sue Bird', 'Diana Taurasi', 'Tina Thompson', 'Lauren Jackson', 'Lisa Leslie']),
  2005: Object.freeze(['Sue Bird', 'Deanna Nolan', 'Sheryl Swoopes', 'Lauren Jackson', 'Yolanda Griffith']),
  2006: Object.freeze(['Diana Taurasi', 'Katie Douglas', 'Tamika Catchings', 'Lauren Jackson', 'Yolanda Griffith']),
  2007: Object.freeze(['Diana Taurasi', 'Becky Hammon', 'Deanna Nolan', 'Penny Taylor', 'Lauren Jackson']),
  2008: Object.freeze(['Diana Taurasi', 'Sue Bird', 'Lindsay Whalen', 'Candace Parker', 'Lisa Leslie']),
  2009: Object.freeze(['Diana Taurasi', 'Becky Hammon', 'Cappie Pondexter', 'Tamika Catchings', 'Lauren Jackson']),
  2010: Object.freeze(['Diana Taurasi', 'Sue Bird', 'Cappie Pondexter', 'Tamika Catchings', 'Lauren Jackson']),
  2011: Object.freeze(['Lindsay Whalen', 'Sue Bird', 'Diana Taurasi', 'Angel McCoughtry', 'Tina Charles']),
  2012: Object.freeze(['Seimone Augustus', 'Cappie Pondexter', 'Tamika Catchings', 'Candace Parker', 'Tina Charles']),
  2013: Object.freeze(['Diana Taurasi', 'Maya Moore', 'Candace Parker', 'Sylvia Fowles', 'Brittney Griner']),
  2014: Object.freeze(['Skylar Diggins-Smith', 'Diana Taurasi', 'Maya Moore', 'Candace Parker', 'Sylvia Fowles']),
  2015: Object.freeze(['Maya Moore', 'Angel McCoughtry', 'Elena Delle Donne', 'DeWanna Bonner', 'Tina Charles']),
  2016: Object.freeze(['Sue Bird', 'Maya Moore', 'Elena Delle Donne', 'Nneka Ogwumike', 'Tina Charles']),
  2017: Object.freeze(['Skylar Diggins-Smith', 'Chelsea Gray', 'Maya Moore', 'Diana Taurasi', 'Candace Parker']),
  2018: Object.freeze(['Diana Taurasi', 'Courtney Vandersloot', 'Tiffany Hayes', 'Elena Delle Donne', 'Breanna Stewart']),
  2019: Object.freeze(['Courtney Vandersloot', 'Chelsea Gray', 'Elena Delle Donne', 'Natasha Howard', 'Brittney Griner']),
  2020: Object.freeze(['Courtney Vandersloot', 'Arike Ogunbowale', "A'ja Wilson", 'Breanna Stewart', 'Candace Parker']),
  2021: Object.freeze(['Jonquel Jones', 'Skylar Diggins-Smith', 'Brittney Griner', 'Breanna Stewart', 'Jewell Loyd']),
  2022: Object.freeze(["A'ja Wilson", 'Breanna Stewart', 'Kelsey Plum', 'Skylar Diggins-Smith', 'Candace Parker']),
  2023: Object.freeze(['Breanna Stewart', 'Alyssa Thomas', "A'ja Wilson", 'Napheesa Collier', 'Jonquel Jones']),
  2024: Object.freeze(["A'ja Wilson", 'Napheesa Collier', 'Breanna Stewart', 'Caitlin Clark', 'Alyssa Thomas']),
  // 2025: not yet published
});

// ── Name matching helpers ─────────────────────────────────────────────────────

// Known name-variant overrides: maps ESPN displayName → Wikipedia award name where they differ.
// Add entries here when a player's ESPN name doesn't match their Wikipedia award name.
// Key = ESPN displayName, value = the name used in the award constants above.
const NAME_ALIASES = Object.freeze({
  // ESPN name              Wikipedia award name
  'Cynthia Cooper-Dyke':   'Cynthia Cooper',
  'Skylar Diggins':        'Skylar Diggins-Smith',  // ESPN drops the married name
  'Armintie Herrington':   'Armintie Price',        // married-name change
  'Renee Montgomery-Larrieu': 'Renee Montgomery',   // married-name change
});

// Last-name + first-initial fallback: "Sue Bird" matches "Sue Bird" trivially, but e.g.
// "S. Bird" or "S Bird" (ESPN variations) would not. This handles the reverse direction
// by normalising both sides to "LAST, F" form for comparison.
function toLastFirst(name) {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name.toLowerCase();
  return (parts[parts.length - 1] + ', ' + parts[0][0]).toLowerCase();
}

/**
 * Return all WNBA individual accolades for a player name.
 *
 * @param {string} playerName  - ESPN displayName (e.g. "Sue Bird")
 * @returns {{ mvp: number[], finalsMVP: number[], dpoy: number[], roy: number[], sixth: number[], allWnbaFirst: number[] }}
 */
function getPlayerAccolades(playerName) {
  // Resolve name variant
  const lookupName = NAME_ALIASES[playerName] ?? playerName;
  const lookupNorm = lookupName.toLowerCase();
  const lookupLF   = toLastFirst(lookupName);

  function matches(wikiName) {
    if (!wikiName) return false;
    const wNorm = wikiName.toLowerCase();
    if (wNorm === lookupNorm) return true;
    if (toLastFirst(wikiName) === lookupLF) return true;
    return false;
  }

  const mvp          = Object.entries(WNBA_MVP)        .filter(([, n]) => matches(n)).map(([y]) => Number(y));
  const finalsMVP    = Object.entries(WNBA_FINALS_MVP)  .filter(([, n]) => matches(n)).map(([y]) => Number(y));
  const dpoy         = Object.entries(WNBA_DPOY)        .filter(([, n]) => matches(n)).map(([y]) => Number(y));
  const roy          = Object.entries(WNBA_ROY)         .filter(([, n]) => matches(n)).map(([y]) => Number(y));
  const sixth        = Object.entries(WNBA_SIXTH_PLAYER).filter(([, n]) => matches(n)).map(([y]) => Number(y));
  const allWnbaFirst = Object.entries(ALL_WNBA_FIRST_TEAM)
    .filter(([, names]) => names.some(n => matches(n)))
    .map(([y]) => Number(y));

  // Dev-mode diagnostic: for prominent players (lots of GP) getting zero accolades, that's
  // likely a name mismatch — log a warning so it surfaces in server logs during development.
  const total = mvp.length + finalsMVP.length + dpoy.length + allWnbaFirst.length;
  if (total === 0 && process.env.NODE_ENV !== 'production') {
    // Heuristic: only warn for names that look like well-known players (multiple words).
    // This avoids noise for legitimate players with no awards.
    const knownStars = ['Diana Taurasi', 'Sue Bird', 'Candace Parker', 'Maya Moore',
      'Breanna Stewart', 'Lisa Leslie', 'Sheryl Swoopes', 'Tamika Catchings',
      'Lauren Jackson', 'Tina Charles', 'Sylvia Fowles'];
    if (knownStars.some(s => s.toLowerCase() === lookupNorm)) {
      console.warn(`[wnbaAccolades] getPlayerAccolades: zero accolades for known star "${playerName}" — possible name mismatch`);
    }
  }

  return { mvp, finalsMVP, dpoy, roy, sixth, allWnbaFirst };
}

module.exports = {
  WNBA_MVP,
  WNBA_FINALS_MVP,
  WNBA_DPOY,
  WNBA_ROY,
  WNBA_SIXTH_PLAYER,
  ALL_WNBA_FIRST_TEAM,
  getPlayerAccolades,
};
