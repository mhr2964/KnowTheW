// historyAggregator.js — builds the /api/teams/:id/history response.
//
// Walks standings from 2002 → currentYear sequentially (not parallel) to avoid rate-limiting ESPN
// across 25 requests. Sequential is acceptable because the result is cached in MongoDB after the
// first call.
//
// Caching strategy (teamHistories collection):
//   - Cold: aggregate all years, store { _id: teamId, seasons, championships, founded, team,
//     coaches, lastSeasonYear, generatedAt }.
//   - Warm / year gap: fetch only the new years (lastSeasonYear+1 → currentYear) and splice them in.
//   - Current year is always re-fetched on a warm hit because the W/L record is mutable mid-season.
//   - If getDb() returns null (dev without MongoDB): aggregate per request, no caching.
//
// playoffResult derivation:
//   ESPN competition.type.text values observed: "Round of 16", "Semifinal", "Final".
//   The aggregator maps these to user-facing strings. If the team's last playoff game was a win in
//   the "Final" round, playoffResult = "Won Finals". Otherwise the round of the last loss determines
//   the label. The WNBA_CHAMPIONS constant is the authoritative champion source — if the playoff
//   schedule derivation disagrees, we trust the constant and log a warning.

const { getDb }              = require('../db');
const { getProvider }        = require('../providers');
// Source access via the active provider; thin locals keep call sites unchanged.
const fetchStandingsRaw    = (...a) => getProvider().getStandingsRaw(...a);
const fetchPlayoffSchedule = (...a) => getProvider().getPlayoffSchedule(...a);
const { WNBA_CHAMPIONS, FRANCHISE_ALIASES } = require('../constants/wnbaChampions');
const { WNBA_FOUNDED }       = require('../constants/wnbaFounded');

const HISTORY_START_YEAR = 2002;

// Pre-ESPN season records for defunct franchises.
// ESPN standings coverage starts ~2002; years before that return null from fetchStandingsByName.
// Only includes records verified against authoritative sources. Other pre-2002 years omitted rather
// than hard-coding uncertain data — they show the coverage note in the UI instead.
// Championship years are the critical rows: without them the championships header has no matching
// table row, which reads as contradictory.
const LEGACY_SEASON_SUPPLEMENT = {
  'Houston Comets': {
    1997: { wins: 18, losses: 10, conference: 'Western', seed: 1, playoffResult: 'Won Finals', champion: true  },
    1998: { wins: 27, losses:  3, conference: 'Western', seed: 1, playoffResult: 'Won Finals', champion: true  },
    1999: { wins: 26, losses:  6, conference: 'Western', seed: 1, playoffResult: 'Won Finals', champion: true  },
    2000: { wins: 27, losses:  5, conference: 'Western', seed: 1, playoffResult: 'Won Finals', champion: true  },
    2001: { wins: 19, losses: 13, conference: 'Western', seed: 2, playoffResult: null,          champion: false },
  },
};

// Returns true if the WNBA_CHAMPIONS entry for `year` belongs to `teamDisplayName` — either as a
// direct match (current name) or through a FRANCHISE_ALIASES lineage mapping (historical name).
function isChampion(year, teamDisplayName) {
  const championName = WNBA_CHAMPIONS[year]?.team;
  if (!championName) return false;
  if (championName === teamDisplayName) return true;
  const aliases = FRANCHISE_ALIASES[teamDisplayName];
  return Array.isArray(aliases) && aliases.includes(championName);
}

// Returns all championship years for a team (current name or historical aliases), newest first.
// Decouples the championships list from the seasons array — seasons only walks 2002+, but
// championships includes pre-2002 titles (e.g. Sparks 2001, Comets 1997-2000).
function getChampionships(teamDisplayName) {
  const aliases  = FRANCHISE_ALIASES[teamDisplayName] ?? [];
  const allNames = new Set([teamDisplayName, ...aliases]);
  return Object.keys(WNBA_CHAMPIONS)
    .map(Number)
    .filter(year => allNames.has(WNBA_CHAMPIONS[year].team))
    .sort((a, b) => b - a); // newest first
}

// Map ESPN competition.type.text to playoffResult string. Last playoff game determines label.
// Win in "Final" → "Won Finals" (but we cross-check against WNBA_CHAMPIONS; constant wins).
// Loss in "Final" → "Lost Finals". Loss in "Semifinal" → "Lost Semifinals".
// Loss in "Round of 16" → "Lost First Round".
function derivePlayoffResult(teamId, year, events) {
  if (!events || events.length === 0) return null;

  // Sort by date ascending to find the latest game the team played.
  const sorted = [...events].sort((a, b) => {
    const da = a.date ? new Date(a.date) : 0;
    const db = b.date ? new Date(b.date) : 0;
    return da - db;
  });

  const lastGame = sorted[sorted.length - 1];
  const roundLabel = lastGame.roundLabel ?? null;
  const won = lastGame.winner === true;

  if (!roundLabel) return null;

  const round = roundLabel.toLowerCase();

  if (round.includes('final') && !round.includes('semi')) {
    // Finals — "Won Finals" or "Lost Finals". Champion cross-check happens in the caller.
    return won ? 'Won Finals' : 'Lost Finals';
  }
  if (round.includes('semi')) return 'Lost Semifinals';
  if (round.includes('round') || round.includes('16')) return 'Lost First Round';

  // Unrecognized round label (e.g. ESPN "Standard" for older seasons) — return null so the UI
  // renders a muted em-dash rather than a nonsense "Lost in Standard" string.
  return null;
}

// Shared stat-parsing helpers used by both fetchStandingsForYear and fetchStandingsByName.
// Derive wins and losses by summing Home + Road summary strings (e.g. "12-4" + "13-3").
// ESPN's scalar `wins`/`losses` values are corrupted for some historic champion seasons
// (e.g. 2002 Sparks shows 2-0 Finals-series wins instead of 25-7 regular season).
// Home+Road sum is the authoritative regular-season record in all observed seasons.
function statByType(entry, type) { return (entry.stats ?? []).find(s => s.type === type); }
function parseSummary(s) {
  if (!s?.summary) return null;
  const parts = s.summary.split('-');
  return parts.length === 2 ? parts.map(Number) : null;
}
function recordFromEntry(entry) {
  const homeRecord = parseSummary(statByType(entry, 'home'));
  const roadRecord = parseSummary(statByType(entry, 'road'));
  const w = (homeRecord && roadRecord) ? homeRecord[0] + roadRecord[0] : null;
  const l = (homeRecord && roadRecord) ? homeRecord[1] + roadRecord[1] : null;
  const seedStat = (entry.stats ?? []).find(s => s.name === 'playoffSeed');
  const seed = seedStat ? seedStat.value : null;
  return {
    wins:   typeof w    === 'number' && !isNaN(w) ? Math.round(w)   : null,
    losses: typeof l    === 'number' && !isNaN(l) ? Math.round(l)   : null,
    seed:   typeof seed === 'number'              ? Math.round(seed) : null,
  };
}

// Fetches standings for a single year and returns a map of teamId → { wins, losses, seed, conference }.
// Returns null on network or parse failure so the caller can skip the year non-fatally.
async function fetchStandingsForYear(year) {
  try {
    const children = await fetchStandingsRaw(year);
    if (!children) return null;
    const out = {};
    for (const child of children) {
      const conference = child.name;
      for (const entry of child.standings?.entries ?? []) {
        const teamId = String(entry.team?.id ?? '');
        if (!teamId) continue;
        out[teamId] = { conference, ...recordFromEntry(entry) };
      }
    }
    return out;
  } catch (err) {
    console.error(`fetchStandingsForYear year=${year}:`, err.message);
    return null;
  }
}

// Builds one team's season record for a single year — the per-year work shared by the cold-build
// (aggregateHistory) and warm-cache-refresh (buildHistory) paths. Returns a tagged result so each
// caller can apply its own control flow:
//   { status: 'no-standings' } — standings fetch failed/empty for the year
//   { status: 'no-entry' }     — team not present in that year's standings
//   { status: 'ok', record }   — the season record
// WNBA_CHAMPIONS is authoritative: when it marks this team/year a champion, playoffResult is forced
// to 'Won Finals' regardless of ESPN's playoff-schedule derivation. warnOnMismatch logs when the
// constant and the ESPN-derived result disagree (cold path only, matching prior behavior).
async function buildSeasonRecord(teamId, teamName, year, { warnOnMismatch = false } = {}) {
  const standings = await fetchStandingsForYear(year);
  if (!standings) return { status: 'no-standings' };

  const entry = standings[teamId];
  if (!entry) return { status: 'no-entry' };

  // Fetch playoff events whenever ESPN populated a seed (needed to discover if games exist).
  // A populated seed alone does not mean the team played — ESPN seeds all teams from standings.
  let playoffResult = null;
  if (entry.seed != null) {
    try {
      const events = await fetchPlayoffSchedule(teamId, year);
      if (events && events.length > 0) {
        playoffResult = derivePlayoffResult(teamId, year, events);
      }
    } catch (err) {
      console.warn(`historyAggregator: playoff fetch failed teamId=${teamId} year=${year}:`, err.message);
    }
  }

  const constantSaysChampion = isChampion(year, teamName);
  if (warnOnMismatch) {
    const playoffSaysChampion = playoffResult === 'Won Finals';
    if (constantSaysChampion !== playoffSaysChampion && entry.seed != null && playoffResult !== null) {
      console.warn(
        `historyAggregator: champion mismatch year=${year} teamId=${teamId} ` +
        `constant=${constantSaysChampion} playoffDerived=${playoffSaysChampion} — trusting constant`
      );
    }
  }

  return {
    status: 'ok',
    record: {
      year,
      wins:          entry.wins,
      losses:        entry.losses,
      conference:    entry.conference,
      seed:          entry.seed,
      // Constant is truth: old playoff games often surface with round label "Standard" which derives
      // to a nonsense result — force "Won Finals" when WNBA_CHAMPIONS marks the title.
      playoffResult: constantSaysChampion ? 'Won Finals' : playoffResult,
      champion:      constantSaysChampion,
    },
  };
}

// Aggregates all seasons for a team. teamObj must have { id, name }.
// Returns the full /history response shape (no caching concern — caller handles that).
async function aggregateHistory(teamObj) {
  const currentYear = new Date().getFullYear();
  const teamId      = String(teamObj.id);
  const teamName    = teamObj.name;

  const seasons = [];

  for (let year = currentYear; year >= HISTORY_START_YEAR; year--) {
    try {
      const result = await buildSeasonRecord(teamId, teamName, year, { warnOnMismatch: true });
      if (result.status === 'no-standings') {
        // Network/parse failure — skip this year non-fatally
        console.warn(`historyAggregator: standings unavailable for year=${year}, skipping`);
        continue;
      }
      if (result.status === 'no-entry') continue; // team didn't exist / not in WNBA this year
      seasons.push(result.record);
    } catch (err) {
      // Per-year errors are non-fatal — log and continue
      console.error(`historyAggregator: unexpected error year=${year} teamId=${teamId}:`, err.message);
    }
  }

  // seasons array is already newest-first (we iterate currentYear → 2002)
  // championships comes from WNBA_CHAMPIONS constant — NOT from seasons — so pre-2002 titles
  // (e.g. Sparks 2001, Comets 1997-2000) are included even though seasons only walks 2002+.
  const championships = getChampionships(teamName);
  const founded       = WNBA_FOUNDED[teamId] ?? null;

  return {
    teamId,
    team: { id: teamId, name: teamName },
    founded,
    championships,
    coaches: [], // forward-compatibility hook; structured coaching data not available from ESPN
    seasons,
  };
}

// Returns the /history response for a team, using MongoDB cache when available.
// teamObj: { id, name } (from getTeams())
async function buildHistory(teamObj) {
  const teamId      = String(teamObj.id);
  const currentYear = new Date().getFullYear();
  const db          = getDb();

  if (!db) {
    // Dev path: no MongoDB — aggregate fresh every request
    return aggregateHistory(teamObj);
  }

  const coll = db.collection('teamHistories');

  let cached;
  try {
    cached = await coll.findOne({ _id: teamId });
  } catch (err) {
    console.error(`historyAggregator: mongo read failed teamId=${teamId}:`, err.message);
    cached = null;
  }

  if (!cached) {
    // Cold cache — build from scratch and store
    const result = await aggregateHistory(teamObj);
    const doc = {
      _id:            teamId,
      teamId,
      team:           result.team,
      founded:        result.founded,
      championships:  result.championships,
      coaches:        result.coaches,
      seasons:        result.seasons,
      lastSeasonYear: currentYear,
      generatedAt:    new Date().toISOString(),
    };
    try {
      await coll.replaceOne({ _id: teamId }, doc, { upsert: true });
    } catch (err) {
      console.error(`historyAggregator: mongo write failed teamId=${teamId}:`, err.message);
    }
    return result;
  }

  // Warm cache — check if we need to append new seasons
  const lastCached = cached.lastSeasonYear ?? (HISTORY_START_YEAR - 1);
  const seasons    = [...(cached.seasons ?? [])];

  // Always re-fetch the current year since W/L is mutable mid-season
  const yearsToRefetch = [];
  for (let y = lastCached + 1; y <= currentYear; y++) yearsToRefetch.push(y);
  // Include currentYear refresh even if it was already the lastSeasonYear
  if (!yearsToRefetch.includes(currentYear)) yearsToRefetch.push(currentYear);

  for (const year of yearsToRefetch) {
    try {
      const result = await buildSeasonRecord(teamId, teamObj.name, year);
      if (result.status !== 'ok') continue;
      const newRecord = result.record;

      // Splice: remove existing record for this year (if any) and insert updated one
      const existingIdx = seasons.findIndex(s => s.year === year);
      if (existingIdx !== -1) {
        seasons[existingIdx] = newRecord;
      } else {
        // Insert in correct position (newest first)
        const insertAt = seasons.findIndex(s => s.year < year);
        if (insertAt === -1) {
          seasons.push(newRecord);
        } else {
          seasons.splice(insertAt, 0, newRecord);
        }
      }
    } catch (err) {
      console.error(`historyAggregator cache refresh: year=${year} teamId=${teamId}:`, err.message);
    }
  }

  // Derive championships from constant — same reason as cold path: seasons only covers 2002+.
  const championships = getChampionships(teamObj.name);

  const updatedResult = {
    teamId,
    team:          cached.team,
    founded:       cached.founded,
    championships,
    coaches:       cached.coaches ?? [],
    seasons,
  };

  // Persist the updated cache
  try {
    await coll.replaceOne(
      { _id: teamId },
      {
        _id:            teamId,
        teamId,
        team:           updatedResult.team,
        founded:        updatedResult.founded,
        championships,
        coaches:        updatedResult.coaches,
        seasons,
        lastSeasonYear: currentYear,
        generatedAt:    new Date().toISOString(),
      },
      { upsert: true }
    );
  } catch (err) {
    console.error(`historyAggregator: mongo update failed teamId=${teamId}:`, err.message);
  }

  return updatedResult;
}

// Fetch all standings entries for a year, indexed by team displayName.
// Used by buildLegacyHistory — defunct teams have no ESPN numeric ID in this codebase,
// so name-matching is the only way to retrieve their historical records.
async function fetchStandingsByName(year) {
  try {
    const children = await fetchStandingsRaw(year);
    if (!children) return null;
    const out = {};
    for (const child of children) {
      const conference = child.name;
      for (const entry of child.standings?.entries ?? []) {
        const name = entry.team?.displayName ?? '';
        if (!name) continue;
        out[name] = { conference, ...recordFromEntry(entry) };
      }
    }
    return out;
  } catch (err) {
    console.error(`fetchStandingsByName year=${year}:`, err.message);
    return null;
  }
}

// Aggregate history for a defunct franchise. teamObj must have { id, name, activeYears }.
// Iterates activeYears newest-first; ESPN returns data for years it has coverage (typically 2002+).
// Years ESPN doesn't cover are skipped non-fatally — the caller renders whatever comes back.
async function aggregateLegacyHistory(teamObj) {
  const [startYear, endYear] = teamObj.activeYears;
  const teamName = teamObj.name;
  const teamId   = teamObj.id;
  const seasons  = [];

  for (let year = endYear; year >= startYear; year--) {
    try {
      const standings = await fetchStandingsByName(year);
      if (!standings) continue;
      const entry = standings[teamName];
      if (!entry) continue;

      const constantSaysChampion = isChampion(year, teamName);
      seasons.push({
        year,
        wins:          entry.wins,
        losses:        entry.losses,
        conference:    entry.conference,
        seed:          entry.seed,
        playoffResult: constantSaysChampion ? 'Won Finals' : null,
        champion:      constantSaysChampion,
      });
    } catch (err) {
      console.error(`aggregateLegacyHistory: year=${year} team=${teamName}:`, err.message);
    }
  }

  // Merge supplement rows for years ESPN doesn't cover (typically pre-2002).
  // ESPN data takes precedence — supplement only fills gaps, never overwrites.
  const supplement = LEGACY_SEASON_SUPPLEMENT[teamName] ?? {};
  for (const [yearStr, row] of Object.entries(supplement)) {
    const year = Number(yearStr);
    if (!seasons.find(s => s.year === year)) {
      seasons.push({ year, ...row });
    }
  }
  seasons.sort((a, b) => b.year - a.year); // maintain newest-first order

  return {
    teamId,
    team:          { id: teamId, name: teamName },
    founded:       startYear,
    dissolved:     endYear,
    championships: getChampionships(teamName),
    coaches:       [],
    seasons,
  };
}

// Returns the /history response for a defunct franchise, using MongoDB cache when available.
// Defunct teams are immutable once dissolved, so the cache is permanent (no re-fetch needed).
async function buildLegacyHistory(teamObj) {
  const teamId = teamObj.id;
  const db     = getDb();

  if (!db) return aggregateLegacyHistory(teamObj);

  const coll = db.collection('teamHistories');
  let cached;
  try {
    cached = await coll.findOne({ _id: teamId });
  } catch (err) {
    console.error(`buildLegacyHistory: mongo read failed teamId=${teamId}:`, err.message);
    cached = null;
  }

  if (cached) {
    return {
      teamId:        cached.teamId,
      team:          cached.team,
      founded:       cached.founded,
      dissolved:     cached.dissolved ?? teamObj.activeYears[1],
      championships: cached.championships,
      coaches:       cached.coaches ?? [],
      seasons:       cached.seasons ?? [],
    };
  }

  const result = await aggregateLegacyHistory(teamObj);
  try {
    await coll.replaceOne(
      { _id: teamId },
      { _id: teamId, ...result, generatedAt: new Date().toISOString() },
      { upsert: true }
    );
  } catch (err) {
    console.error(`buildLegacyHistory: mongo write failed teamId=${teamId}:`, err.message);
  }
  return result;
}

// fetchStandingsForYear and isChampion are exported for use by seasonInfo.js.
// Dependency note: seasonInfo.js relies on fetchStandingsForYear for the pre-2003 ESPN corrupted-
// scalar fix (Home+Road sum via recordFromEntry) — do not duplicate that logic there.
module.exports = { buildHistory, buildLegacyHistory, fetchStandingsForYear, isChampion };
