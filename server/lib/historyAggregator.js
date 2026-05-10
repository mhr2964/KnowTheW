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
const { STANDINGS }          = require('./espnClient');
const { fetchPlayoffSchedule } = require('./espnClient');
const { WNBA_CHAMPIONS, FRANCHISE_ALIASES } = require('../constants/wnbaChampions');
const { WNBA_FOUNDED }       = require('../constants/wnbaFounded');

const HISTORY_START_YEAR = 2002;

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

// Fetches standings for a single year and returns a map of teamId → { wins, losses, seed, conference }.
// Returns null on network or parse failure so the caller can skip the year non-fatally.
async function fetchStandingsForYear(year) {
  try {
    const res = await fetch(`${STANDINGS}?season=${year}`);
    if (!res.ok) return null;
    const data = await res.json();
    const out = {};
    for (const child of data.children ?? []) {
      const conference = child.name;
      for (const entry of child.standings?.entries ?? []) {
        const teamId = String(entry.team?.id ?? '');
        if (!teamId) continue;
        // Derive wins and losses by summing Home + Road summary strings (e.g. "12-4" + "13-3").
        // ESPN's scalar `wins`/`losses` values are corrupted for some historic champion seasons
        // (e.g. 2002 Sparks shows 2-0 Finals-series wins instead of 25-7 regular season).
        // Home+Road sum is the authoritative regular-season record in all observed seasons.
        const statByType = (type) => (entry.stats ?? []).find(s => s.type === type);
        const parseSummary = (s) => {
          if (!s?.summary) return null;
          const parts = s.summary.split('-');
          return parts.length === 2 ? parts.map(Number) : null;
        };
        const homeRecord = parseSummary(statByType('home'));
        const roadRecord = parseSummary(statByType('road'));
        const w = (homeRecord && roadRecord) ? homeRecord[0] + roadRecord[0] : null;
        const l = (homeRecord && roadRecord) ? homeRecord[1] + roadRecord[1] : null;
        const seedStat = (entry.stats ?? []).find(s => s.name === 'playoffSeed');
        const seed = seedStat ? seedStat.value : null;
        out[teamId] = {
          conference,
          wins:   typeof w    === 'number' && !isNaN(w) ? Math.round(w)    : null,
          losses: typeof l    === 'number' && !isNaN(l) ? Math.round(l)    : null,
          seed:   typeof seed === 'number'              ? Math.round(seed)  : null,
        };
      }
    }
    return out;
  } catch (err) {
    console.error(`fetchStandingsForYear year=${year}:`, err.message);
    return null;
  }
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
      const standings = await fetchStandingsForYear(year);
      if (!standings) {
        // Network/parse failure — skip this year non-fatally
        console.warn(`historyAggregator: standings unavailable for year=${year}, skipping`);
        continue;
      }

      const entry = standings[teamId];
      if (!entry) {
        // Team didn't exist or wasn't in WNBA this year — skip silently
        continue;
      }

      // Fetch playoff events whenever ESPN populated a seed (needed to discover if games exist).
      // Only set playoffResult when actual playoff events came back — a populated seed alone
      // does not mean the team played (ESPN populates playoffSeed for all teams based on standings).
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

      // Champion determination: primary source is WNBA_CHAMPIONS constant.
      // Cross-check: if playoffResult says "Won Finals" but constant disagrees (or vice-versa),
      // trust the constant and log a warning so we can investigate.
      // isChampion() resolves franchise lineage aliases (e.g. Dallas Wings ← Detroit Shock).
      const constantSaysChampion = isChampion(year, teamName);
      const playoffSaysChampion  = playoffResult === 'Won Finals';

      if (constantSaysChampion !== playoffSaysChampion && entry.seed != null && playoffResult !== null) {
        console.warn(
          `historyAggregator: champion mismatch year=${year} teamId=${teamId} ` +
          `constant=${constantSaysChampion} playoffDerived=${playoffSaysChampion} — trusting constant`
        );
      }

      // Constant is truth — when WNBA_CHAMPIONS marks this year, force playoffResult to "Won Finals"
      // regardless of what ESPN's playoff-schedule derivation produced. Old playoff games often
      // surface with round label "Standard" which derives to "Lost in Standard" — wrong for titles.
      const finalPlayoffResult = constantSaysChampion ? 'Won Finals' : playoffResult;

      seasons.push({
        year,
        wins:        entry.wins,
        losses:      entry.losses,
        conference:  entry.conference,
        seed:        entry.seed,
        playoffResult: finalPlayoffResult,
        champion:    constantSaysChampion,
      });
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
      const standings = await fetchStandingsForYear(year);
      if (!standings) continue;

      const entry = standings[teamId];
      if (!entry) continue;

      let playoffResult = null;
      if (entry.seed != null) {
        try {
          const events = await fetchPlayoffSchedule(teamId, year);
          if (events && events.length > 0) {
            playoffResult = derivePlayoffResult(teamId, year, events);
          }
        } catch (err) {
          console.warn(`historyAggregator cache refresh: playoff fetch failed teamId=${teamId} year=${year}:`, err.message);
        }
      }

      const constantSaysChampion = isChampion(year, teamObj.name);
      const finalPlayoffResult   = constantSaysChampion ? 'Won Finals' : playoffResult;
      const newRecord = {
        year,
        wins:        entry.wins,
        losses:      entry.losses,
        conference:  entry.conference,
        seed:        entry.seed,
        playoffResult: finalPlayoffResult,
        champion:    constantSaysChampion,
      };

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

module.exports = { buildHistory };
