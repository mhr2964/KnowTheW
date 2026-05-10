// WNBA Champions by year. Update once per October when the Finals conclude — it's a two-line PR.
// Team names must match ESPN's team.name (team.displayName) exactly for the join in historyAggregator.
// Defunct franchises (Houston Comets, Detroit Shock, Sacramento Monarchs) no longer appear in
// /api/teams but are kept here under their historically-recognized names; the aggregator matches
// by string equality so those years produce champion:true only when the team name matches.
// If ESPN's champion constant and the playoff-schedule-derived result disagree, the constant wins —
// it is the audit-trail source of truth.
//
// FRANCHISE_ALIASES maps each current ESPN display name to the historical names that belong to the
// same franchise lineage. The aggregator uses this so that, e.g., Dallas Wings earns the Detroit
// Shock championships (2003, 2006, 2008). Only franchises whose historical name differs from the
// current ESPN display name need an entry here. Defunct-only franchises (Houston Comets, Sacramento
// Monarchs) have no successor and are intentionally absent — no current team inherits their titles.

const WNBA_CHAMPIONS = Object.freeze({
  1997: { team: 'Houston Comets' },
  1998: { team: 'Houston Comets' },
  1999: { team: 'Houston Comets' },
  2000: { team: 'Houston Comets' },
  2001: { team: 'Los Angeles Sparks' },
  2002: { team: 'Los Angeles Sparks' },
  2003: { team: 'Detroit Shock' },
  2004: { team: 'Seattle Storm' },
  2005: { team: 'Sacramento Monarchs' },
  2006: { team: 'Detroit Shock' },
  2007: { team: 'Phoenix Mercury' },
  2008: { team: 'Detroit Shock' },
  2009: { team: 'Phoenix Mercury' },
  2010: { team: 'Seattle Storm' },
  2011: { team: 'Minnesota Lynx' },
  2012: { team: 'Indiana Fever' },
  2013: { team: 'Minnesota Lynx' },
  2014: { team: 'Phoenix Mercury' },
  2015: { team: 'Minnesota Lynx' },
  2016: { team: 'Los Angeles Sparks' },
  2017: { team: 'Minnesota Lynx' },
  2018: { team: 'Seattle Storm' },
  2019: { team: 'Washington Mystics' },
  2020: { team: 'Seattle Storm' },
  2021: { team: 'Chicago Sky' },
  2022: { team: 'Las Vegas Aces' },
  2023: { team: 'Las Vegas Aces' },
  2024: { team: 'New York Liberty' },
  2025: { team: 'New York Liberty' },
});

// Franchise lineage: current ESPN display name → historical names that count as the same franchise.
// Sources: WNBA_FOUNDED comments + WNBA official franchise histories.
const FRANCHISE_ALIASES = Object.freeze({
  'Dallas Wings':    ['Detroit Shock', 'Tulsa Shock'],
  'Las Vegas Aces':  ['Utah Starzz', 'San Antonio Silver Stars', 'San Antonio Stars'],
  'Connecticut Sun': ['Orlando Miracle'],
});

module.exports = { WNBA_CHAMPIONS, FRANCHISE_ALIASES };
