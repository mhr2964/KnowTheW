// One-shot generator: reads the FiveThirtyEight WNBA CSV, filters rows for 1997-2001,
// and emits two source files:
//   server/constants/legacyPlayerBulk.js   — { player_ID: { id, name, position, retired, seasons: {year: {team, age, G, MP, ...}} } }
//   server/constants/legacyTeamRosters.js  — { teamCode: { year: [player_IDs] } } + LEGACY_DEFUNCT_TEAMS map
//
// Designed for idempotent regen — run again if the upstream CSV updates.

'use strict';
const fs   = require('fs');
const path = require('path');

const CSV_PATH = process.argv[2] || 'C:/Users/Owner/AppData/Local/Temp/wnba-player-stats.csv';
const OUT_DIR  = process.argv[3] || 'C:/Users/Owner/Desktop/AI/Projects/knowthew/server/constants';

// Header indexes from the CSV (verified 2026-05-11):
// player_ID,Player,year_ID,Age,Tm,tm_gms,Tm_Net_Rtg,Pos,G,MP,MP_pct,PER,TS_pct,ThrPAr,FTr,
// ORB_pct,TRB_pct,AST_pct,STL_pct,BLK_pct,TOV_pct,USG_pct,OWS,DWS,WS,WS40,Composite_Rating,Wins_Generated

function parseCSV(text) {
  // Simple CSV parser — the upstream file has no embedded quotes/commas, so a basic split works.
  const lines = text.split(/\r?\n/).filter(Boolean);
  const headers = lines[0].split(',');
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(',');
    if (cells.length !== headers.length) continue; // skip malformed
    const row = {};
    headers.forEach((h, j) => { row[h] = cells[j]; });
    rows.push(row);
  }
  return rows;
}

// Coerce a CSV cell into a number.
// BBRef-style percent strings like ".520" or "69.5%" become floats (0.520, 0.695).
// Returns null when the cell is empty, a dash, or unparseable.
function num(v) {
  if (v == null) return null;
  let s = String(v).trim();
  if (s === '' || s === '-' || s === 'NA') return null;
  if (s.endsWith('%')) {
    const n = parseFloat(s.slice(0, -1));
    return isFinite(n) ? Number((n / 100).toFixed(4)) : null;
  }
  // Leading-dot percentages like ".520" — treat as already-decimal (BBRef convention).
  const n = parseFloat(s);
  return isFinite(n) ? n : null;
}

function int(v) {
  if (v == null) return null;
  const s = String(v).trim();
  if (s === '' || s === '-' || s === 'NA') return null;
  const n = parseInt(s, 10);
  return isFinite(n) ? n : null;
}

const csvText = fs.readFileSync(CSV_PATH, 'utf8');
const all = parseCSV(csvText);

// Filter to 1997-2001 seasons.
const filtered = all.filter(r => {
  const y = int(r.year_ID);
  return y != null && y >= 1997 && y <= 2001;
});

console.log(`CSV rows total: ${all.length}, 1997-2001: ${filtered.length}`);

// Build player map. For multi-team seasons, keep the LAST team (last row in CSV order)
// per the spec — simpler than aggregating, ~16 cases in the filtered set.
const players = {};
const skipped = { malformedRow: 0, missingFields: 0 };

for (const r of filtered) {
  const id   = (r.player_ID || '').trim();
  const name = (r.Player    || '').trim();
  const year = int(r.year_ID);
  const team = (r.Tm || '').trim();
  if (!id || !name || !year || !team) { skipped.missingFields++; continue; }

  if (!players[id]) {
    players[id] = {
      id,
      name,
      position: (r.Pos || '').trim() || null,
      retired:  true,
      seasons:  {},
    };
  }

  // Capture per-season advanced stats. Overwrite on multi-team duplicate (last row wins).
  players[id].seasons[year] = {
    team,
    age:        int(r.Age),
    G:          int(r.G),
    MP:         int(r.MP),
    MP_pct:     num(r.MP_pct),
    PER:        num(r.PER),
    TS_pct:     num(r.TS_pct),
    ThrPAr:     num(r.ThrPAr),
    FTr:        num(r.FTr),
    ORB_pct:    num(r.ORB_pct),
    TRB_pct:    num(r.TRB_pct),
    AST_pct:    num(r.AST_pct),
    STL_pct:    num(r.STL_pct),
    BLK_pct:    num(r.BLK_pct),
    TOV_pct:    num(r.TOV_pct),
    USG_pct:    num(r.USG_pct),
    OWS:        num(r.OWS),
    DWS:        num(r.DWS),
    WS:         num(r.WS),
    WS40:       num(r.WS40),
  };

  // Keep position fresh — players changed positions across seasons; the latest entry wins.
  const pos = (r.Pos || '').trim();
  if (pos) players[id].position = pos;
}

const playerCount = Object.keys(players).length;
console.log(`Unique players: ${playerCount}`);

// Build team rosters: for each (team, year), collect the player_IDs.
// When a player played for multiple teams in a year, they appear in BOTH team's rosters
// — this matches the historical reality, even though seasons[year] only records one team.
const rostersByTeam = {};
for (const r of filtered) {
  const id   = (r.player_ID || '').trim();
  const year = int(r.year_ID);
  const team = (r.Tm || '').trim();
  if (!id || !year || !team) continue;
  if (!rostersByTeam[team]) rostersByTeam[team] = {};
  if (!rostersByTeam[team][year]) rostersByTeam[team][year] = [];
  if (!rostersByTeam[team][year].includes(id)) {
    rostersByTeam[team][year].push(id);
  }
}

// Sort rosters alphabetically by player_ID for stable output.
for (const t of Object.keys(rostersByTeam)) {
  for (const y of Object.keys(rostersByTeam[t])) {
    rostersByTeam[t][y].sort();
  }
}

const teamSeasons = Object.entries(rostersByTeam)
  .map(([t, yrs]) => `${t}: [${Object.keys(yrs).sort().join(',')}]`);
console.log('Team-seasons covered:', teamSeasons.length, 'tuples');
console.log(teamSeasons.join('\n'));

// ─────────────────────────────────────────────────────────────────────────────
// Emit legacyPlayerBulk.js
// ─────────────────────────────────────────────────────────────────────────────

function jsString(s) {
  return "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
}

function emitNumber(v) {
  return v == null ? 'null' : String(v);
}

function emitSeason(s) {
  // Compact one-line season block.
  return `{ team: ${jsString(s.team)}, age: ${emitNumber(s.age)}, G: ${emitNumber(s.G)}, MP: ${emitNumber(s.MP)}, MP_pct: ${emitNumber(s.MP_pct)}, PER: ${emitNumber(s.PER)}, TS_pct: ${emitNumber(s.TS_pct)}, ThrPAr: ${emitNumber(s.ThrPAr)}, FTr: ${emitNumber(s.FTr)}, ORB_pct: ${emitNumber(s.ORB_pct)}, TRB_pct: ${emitNumber(s.TRB_pct)}, AST_pct: ${emitNumber(s.AST_pct)}, STL_pct: ${emitNumber(s.STL_pct)}, BLK_pct: ${emitNumber(s.BLK_pct)}, TOV_pct: ${emitNumber(s.TOV_pct)}, USG_pct: ${emitNumber(s.USG_pct)}, OWS: ${emitNumber(s.OWS)}, DWS: ${emitNumber(s.DWS)}, WS: ${emitNumber(s.WS)}, WS40: ${emitNumber(s.WS40)} }`;
}

function emitPlayer(p) {
  const ids   = jsString(p.id);
  const name  = jsString(p.name);
  const pos   = p.position ? jsString(p.position) : 'null';
  const years = Object.keys(p.seasons).map(Number).sort();
  const seasonLines = years.map(y =>
    `      ${y}: ${emitSeason(p.seasons[y])},`
  ).join('\n');
  return `  ${ids}: {
    id: ${ids},
    name: ${name},
    position: ${pos},
    retired: true,
    seasons: {
${seasonLines}
    },
  },`;
}

const sortedIds = Object.keys(players).sort();
const playerBlocks = sortedIds.map(id => emitPlayer(players[id])).join('\n');

const playerFileHeader = `// legacyPlayerBulk.js — bulk-imported pre-2002 WNBA players (FiveThirtyEight CSV, BBRef-sourced).
//
// Source: https://raw.githubusercontent.com/fivethirtyeight/WNBA-stats/master/wnba-player-stats.csv
//   Upstream is FiveThirtyEight's mirror of Basketball-Reference WNBA player advanced stats.
//   Filtered to year_ID 1997-2001 so every player from the first five seasons is represented.
//
// Why this exists: ESPN's player API returns sparse/empty data for most pre-2002 players, so
// search, /api/players/:id, and team rosters can't surface them. This constant fills the gap
// with advanced metrics (PER, TS%, WS, USG%) — per-game stats (PPG/RPG/APG) are NOT in this
// data set. The graded-report prompt is told to grade these players from advanced metrics +
// accolades alone.
//
// player_ID format is BBRef's (e.g. 'staleda01w'). Used as the synthetic player id since the
// existing isLegacyId() check matches any id containing a hyphen — BBRef ids never contain
// hyphens, so we need a separate detector (isBulkLegacyId) for the bulk set.
//
// Coexistence with legacyPlayerStats.js (8 hand-curated legends): these may overlap by player
// (e.g., Dawn Staley is both 'staleda01w' in this constant and 'staley-dawn-1970' in the hand-
// curated one). The hand-curated copy carries per-game stats and wins by-name lookups; the
// bulk copy wins by-id lookups (BBRef id). TODO: reconcile after v1 ships.
//
// Multi-team seasons: when a player played for two teams in one year (e.g., Olympia Scott 1999
// DET → UTA), only the LAST team is recorded in seasons[year]. Both teams' rosters still list
// the player. ~16 such cases in 1997-2001; aggregating advanced stats across teams is not
// straightforward (PER/WS are not additive), so we keep the simpler "last team" approach.
//
// Regenerate via: node scripts/build-legacy-bulk.js (see scripts/).
// Generated ${new Date().toISOString().slice(0, 10)} from 1997-2001 CSV rows.

'use strict';

const LEGACY_PLAYERS_BULK = {
${playerBlocks}
};

/**
 * Detect a bulk-legacy BBRef id. They look like 'staleda01w' — lowercase letters with a numeric
 * tail and a trailing 'w'. Hand-curated legacy ids contain hyphens; ESPN ids are pure integers.
 */
function isBulkLegacyId(id) {
  return typeof id === 'string' && /^[a-z]{2,8}\\d{2}w$/.test(id);
}

function getBulkLegacyPlayer(id) {
  return LEGACY_PLAYERS_BULK[id] ?? null;
}

/**
 * Substring case-insensitive name search. Returns search-shaped hits with legacy + dataSource flags
 * so the /api/search response can mix them in alongside active and ESPN-retired results.
 * Each hit carries the BBRef player_ID — the same id /api/players/:id will resolve.
 */
function searchBulkLegacyPlayers(q) {
  const needle = String(q || '').toLowerCase().trim();
  if (!needle) return [];
  return Object.values(LEGACY_PLAYERS_BULK)
    .filter(p => p.name.toLowerCase().includes(needle))
    .map(p => ({
      id:         p.id,
      name:       p.name,
      position:   p.position,
      headshot:   null,
      retired:    true,
      legacy:     true,
      dataSource: 'legacy-bulk',
    }));
}

/**
 * Build a player profile shaped like /api/players/:id returns for ESPN-backed players.
 * teamName comes from the most-recent season's team abbreviation (left as the BBRef code;
 * api.js resolves the display name via getBulkLegacyTeamDisplay).
 */
function buildBulkLegacyProfile(player) {
  const years = Object.keys(player.seasons).map(Number).sort();
  const lastYear = years.length ? years[years.length - 1] : null;
  const lastSeason = lastYear ? player.seasons[lastYear] : null;
  return {
    id:           player.id,
    name:         player.name,
    position:     player.position,
    positionName: player.position,
    jersey:       null,
    headshot:     null,
    height:       null,
    weight:       null,
    age:          lastSeason?.age ?? null,
    college:      null,
    birthPlace:   null,
    experience:   years.length,
    teamId:       null,                                  // resolved per-season; profile has no single team
    teamName:     lastSeason?.team ?? null,              // BBRef tricode — caller may want to map
    teamAbbr:     lastSeason?.team ?? null,
    careerYears:  years,
    retired:      true,
    dataSource:   'legacy-bulk',
  };
}

/**
 * Build the detailed-stats payload for a bulk-legacy player. Only advanced rows are available —
 * no per-game stats — so the response carries advancedOnly: true. The shape mirrors what the
 * frontend's stat-tab strip expects (perGame/totals/per36/per100), with the populated half being
 * 'advanced' alone.
 */
function buildBulkLegacyDetailedStats(player) {
  const years = Object.keys(player.seasons).map(Number).sort();
  const rows = years.map(y => {
    const s = player.seasons[y];
    return {
      year:    String(y),
      team:    s.team,
      age:     s.age,
      G:       s.G,
      MP:      s.MP,
      PER:     s.PER,
      TS_pct:  s.TS_pct,
      ORB_pct: s.ORB_pct,
      TRB_pct: s.TRB_pct,
      AST_pct: s.AST_pct,
      STL_pct: s.STL_pct,
      BLK_pct: s.BLK_pct,
      TOV_pct: s.TOV_pct,
      USG_pct: s.USG_pct,
      OWS:     s.OWS,
      DWS:     s.DWS,
      WS:      s.WS,
      WS40:    s.WS40,
    };
  });
  return {
    source:        'legacy-bulk',
    advancedOnly:  true,
    dataSource:    'legacy-bulk',
    perGame:       { regular: null, regularCareer: null, playoffs: null, playoffCareer: null },
    totals:        { regular: null, regularCareer: null, playoffs: null, playoffCareer: null },
    per36:         { regular: null, regularCareer: null, playoffs: null, playoffCareer: null },
    per100:        null,
    advanced:      { regular: rows, playoffs: null },
  };
}

module.exports = {
  LEGACY_PLAYERS_BULK,
  isBulkLegacyId,
  getBulkLegacyPlayer,
  searchBulkLegacyPlayers,
  buildBulkLegacyProfile,
  buildBulkLegacyDetailedStats,
};
`;

fs.writeFileSync(path.join(OUT_DIR, 'legacyPlayerBulk.js'), playerFileHeader);
console.log(`Wrote ${path.join(OUT_DIR, 'legacyPlayerBulk.js')}`);

// ─────────────────────────────────────────────────────────────────────────────
// Emit legacyTeamRosters.js
// ─────────────────────────────────────────────────────────────────────────────

// Map BBRef tricodes → ESPN team IDs (active franchises) OR LEGACY_DEFUNCT_TEAMS entry.
// Sources: server/constants/wnbaFounded.js + wnbaFranchiseLineage.js.
//
//   CHA = Charlotte Sting (defunct 2007)
//   CLE = Cleveland Rockers (defunct 2003)
//   DET = Detroit Shock → Dallas Wings (id 3)
//   HOU = Houston Comets (defunct 2008)
//   IND = Indiana Fever (id 5)
//   LAS = Los Angeles Sparks (id 6)
//   MIA = Miami Sol (defunct 2002)
//   MIN = Minnesota Lynx (id 8)
//   NYL = New York Liberty (id 9)
//   ORL = Orlando Miracle → Connecticut Sun (id 18)
//   PHO = Phoenix Mercury (id 11)
//   POR = Portland Fire (defunct 2002) — note: NEW 2026 Portland Fire is id 132052 but distinct franchise
//   SAC = Sacramento Monarchs (defunct 2009)
//   SEA = Seattle Storm (id 14)
//   UTA = Utah Starzz → Las Vegas Aces (id 17)
//   WAS = Washington Mystics (id 16)
const BBREF_TO_ESPN = {
  DET: '3',
  IND: '5',
  LAS: '6',
  MIN: '8',
  NYL: '9',
  PHO: '11',
  SEA: '14',
  WAS: '16',
  UTA: '17',
  ORL: '18',
};

// Defunct franchises that don't map to a current ESPN team. The 'id' is a synthetic slug used
// by /api/teams/:id when a user navigates directly to a historical team page.
//
// activeYears [start, end] (inclusive). Used by /api/teams/legacy and roster lookup gates.
const LEGACY_DEFUNCT_TEAMS = {
  CHA: { id: 'legacy-charlotte-sting',    name: 'Charlotte Sting',    location: 'Charlotte',   activeYears: [1997, 2006] },
  CLE: { id: 'legacy-cleveland-rockers',  name: 'Cleveland Rockers',  location: 'Cleveland',   activeYears: [1997, 2003] },
  HOU: { id: 'legacy-houston-comets',     name: 'Houston Comets',     location: 'Houston',     activeYears: [1997, 2008] },
  MIA: { id: 'legacy-miami-sol',          name: 'Miami Sol',          location: 'Miami',       activeYears: [2000, 2002] },
  POR: { id: 'legacy-portland-fire',      name: 'Portland Fire',      location: 'Portland',    activeYears: [2000, 2002] },
  SAC: { id: 'legacy-sacramento-monarchs', name: 'Sacramento Monarchs', location: 'Sacramento', activeYears: [1997, 2009] },
};

const sortedTeams = Object.keys(rostersByTeam).sort();
const rosterBlocks = sortedTeams.map(t => {
  const yrs = rostersByTeam[t];
  const yearBlocks = Object.keys(yrs).sort().map(y => {
    const ids = yrs[y].map(id => jsString(id)).join(', ');
    return `    ${y}: [${ids}],`;
  }).join('\n');
  return `  ${jsString(t)}: {
${yearBlocks}
  },`;
}).join('\n');

const rosterFileHeader = `// legacyTeamRosters.js — pre-2002 team rosters, keyed by BBRef tricode.
//
// Derived from the same CSV as legacyPlayerBulk.js. Each entry is the list of BBRef player_IDs
// that appear in the FiveThirtyEight stats CSV for that (team, year) tuple.
//
// Tricode mapping (BBREF_TO_ESPN): maps the BBRef tricode to ESPN's current team ID where the
// franchise still exists (e.g., DET → Detroit Shock's modern Dallas Wings (id 3)). Tricodes for
// franchises that folded use LEGACY_DEFUNCT_TEAMS instead — those resolve to synthetic ids like
// 'legacy-cleveland-rockers' so direct URLs work but no current /api/teams entry exists.
//
// Multi-team seasons: when a player played for both teams in a year (~16 cases in 1997-2001),
// they appear on BOTH rosters. This mirrors historical reality; the player's own profile
// records only the last team they played for that year.
//
// Generated ${new Date().toISOString().slice(0, 10)} from 1997-2001 CSV rows.

'use strict';

const LEGACY_TEAM_ROSTERS = {
${rosterBlocks}
};

// Active-franchise tricodes → ESPN team ID (string).
// Use this when /api/teams/:id resolves a current franchise — the BBRef tricode is the lookup key.
const BBREF_TO_ESPN = ${JSON.stringify(BBREF_TO_ESPN, null, 2).replace(/\\n/g, '\\n')};

// Defunct-franchise tricodes → synthetic team object. Keep id stable across deploys (used in URLs).
const LEGACY_DEFUNCT_TEAMS = ${JSON.stringify(LEGACY_DEFUNCT_TEAMS, null, 2).replace(/\\n/g, '\\n')};

// Reverse-lookup: synthetic 'legacy-...' id → tricode. Used by /api/teams/:id when a request
// arrives for a defunct team page so we can find its roster in LEGACY_TEAM_ROSTERS.
const DEFUNCT_ID_TO_TRICODE = Object.fromEntries(
  Object.entries(LEGACY_DEFUNCT_TEAMS).map(([tri, t]) => [t.id, tri])
);

// Reverse-lookup: ESPN id → tricode. Used by /api/teams/:id/roster?season=YYYY for pre-2002
// seasons: take the requested ESPN team id, find its BBRef tricode, then look up LEGACY_TEAM_ROSTERS.
const ESPN_TO_BBREF = Object.fromEntries(
  Object.entries(BBREF_TO_ESPN).map(([tri, id]) => [id, tri])
);

/**
 * Get the player_IDs that played for tricode in year, or null if no entry exists.
 */
function getLegacyRoster(tricode, year) {
  return LEGACY_TEAM_ROSTERS[tricode]?.[year] ?? null;
}

/**
 * Resolve an ESPN team id to its BBRef tricode (for pre-2002 roster lookups on active franchises).
 */
function tricodeForEspnId(espnId) {
  return ESPN_TO_BBREF[String(espnId)] ?? null;
}

/**
 * Resolve a synthetic legacy-* id to its BBRef tricode (for defunct-team roster lookups).
 */
function tricodeForDefunctId(legacyId) {
  return DEFUNCT_ID_TO_TRICODE[legacyId] ?? null;
}

module.exports = {
  LEGACY_TEAM_ROSTERS,
  BBREF_TO_ESPN,
  ESPN_TO_BBREF,
  LEGACY_DEFUNCT_TEAMS,
  DEFUNCT_ID_TO_TRICODE,
  getLegacyRoster,
  tricodeForEspnId,
  tricodeForDefunctId,
};
`;

fs.writeFileSync(path.join(OUT_DIR, 'legacyTeamRosters.js'), rosterFileHeader);
console.log(`Wrote ${path.join(OUT_DIR, 'legacyTeamRosters.js')}`);
console.log(`Skipped: ${JSON.stringify(skipped)}`);
