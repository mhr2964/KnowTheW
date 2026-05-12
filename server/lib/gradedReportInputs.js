// gradedReportInputs.js — assembles source data for AI-graded player reports.
//
// Pure function: given a playerId and mode, fetches per-season and advanced stats from
// the existing ESPN-backed routes (reusing the same helpers api.js uses directly), then
// slices to the rows relevant for the requested mode and attaches league-average context.
//
// Returns { player, mode, seasonRows, careerRow, leagueByYear, championships, accolades, seasonsPlayed }
// Returns { empty: true } when mode is 'playoffs' and the player has no playoff data.
//
// championships: array of years the player won a WNBA Championship.
//   Sourced from WNBA_PLAYER_CHAMPIONSHIPS constant (via getPlayerAccolades) — NOT derived from
//   season rows + franchise aliases. That derivation failed for players who missed a season
//   (no ESPN row that year) and misfired on franchise-lineage edge cases.
// accolades: { mvp, finalsMVP, dpoy, roy, sixth, allWnbaFirst, championships } — from wnbaAccolades.js.
// seasonsPlayed: sorted array of integer years the player has actual season rows for (GP > 0).
//   Passed explicitly to the prompt so peakSeasons can be validated as a strict subset.

'use strict';

const { ESPN_WEB, getTeams, fetchTeamStats, teamSeasonStatsCache } = require('./espnClient');
const { parseESPNSeasonData, extractTeamIdByYear, buildDetailedStats } = require('./statsParser');
const { ADV_HEADERS_SRV, buildAdvancedSplit, computeSeasonPBP, buildPbpSplit } = require('./advancedStats');
const { WNBA_LG } = require('../constants/leagueAverages');
const { getPlayerAccolades } = require('../constants/wnbaAccolades');
const { isLegacyId, getLegacyPlayer, buildLegacyDetailedStats } = require('../constants/legacyPlayerStats');
const { isBulkLegacyId, getBulkLegacyPlayer } = require('../constants/legacyPlayerBulk');

// Resolve player basics — name, position — from ESPN.
async function fetchPlayerBasics(playerId) {
  const r = await fetch(`${ESPN_WEB}/athletes/${playerId}`);
  if (!r.ok) return null;
  const data = await r.json();
  const a = data.athlete;
  if (!a) return null;
  return {
    id:       String(a.id),
    name:     a.displayName ?? a.fullName ?? 'Unknown',
    position: a.position?.abbreviation ?? '',
  };
}

// Convert a per-game row (array aligned to ESPN_HEADERS) into a labelled object for the prompt.
function rowToObj(headers, row) {
  const I = Object.fromEntries(headers.map((h, i) => [h, i]));
  return {
    year:     row[I.SEASON_ID],
    teamAbbr: row[I.TEAM_ABBREVIATION] || null,
    gp:       row[I.GP],
    min:      row[I.MIN],
    pts:      row[I.PTS],
    reb:      row[I.REB],
    orb:      row[I.OREB],
    drb:      row[I.DREB],
    ast:      row[I.AST],
    stl:      row[I.STL],
    blk:      row[I.BLK],
    tov:      row[I.TOV],
    fgm:      row[I.FGM],
    fga:      row[I.FGA],
    fgPct:    row[I.FG_PCT],
    fg3m:     row[I.FG3M],
    fg3a:     row[I.FG3A],
    fg3Pct:   row[I.FG3_PCT],
    ftm:      row[I.FTM],
    fta:      row[I.FTA],
    ftPct:    row[I.FT_PCT],
  };
}

// Convert an advanced row (array aligned to ADV_HEADERS_SRV) into a labelled object.
function advRowToObj(headers, row) {
  const I = Object.fromEntries(headers.map((h, i) => [h, i]));
  return {
    year:    row[I.SEASON_ID],
    gp:      row[I.GP],
    tsPct:   row[I.TS_PCT],
    efgPct:  row[I.EFG_PCT],
    usgPct:  row[I.USG_PCT],
    astPct:  row[I.AST_PCT],
    orbPct:  row[I.ORB_PCT],
    drbPct:  row[I.DRB_PCT],
    trbPct:  row[I.TRB_PCT],
    stlPct:  row[I.STL_PCT],
    blkPct:  row[I.BLK_PCT],
    per:     row[I.PER],
    ows:     row[I.OWS],
    dws:     row[I.DWS],
    ws:      row[I.WS],
    wsPer48: row[I.WS_PER48],
  };
}

/**
 * Build the input bundle for a legacy (hand-curated) player. No ESPN call, no advanced stats.
 * Playoffs mode is always empty (Wikipedia tables don't publish per-season playoff splits).
 * The returned bundle carries dataSource='legacy' so the prompt builder can add a caveat.
 */
function buildLegacyInputs(playerId, mode) {
  const legacy = getLegacyPlayer(playerId);
  if (!legacy) return null;

  if (mode === 'playoffs') return { empty: true };

  const detailed   = buildLegacyDetailedStats(legacy);
  const pgSplit    = detailed.perGame.regular;
  const pgCareer   = detailed.perGame.regularCareer;

  if (!pgSplit?.rows?.length) return null;

  const seasonRows = pgSplit.rows
    .map(r => rowToObj(pgSplit.headers, r))
    .sort((a, b) => String(a.year).localeCompare(String(b.year)));

  const careerRow = pgCareer?.rows?.[0]
    ? rowToObj(pgCareer.headers, pgCareer.rows[0])
    : null;

  const touchedYears = new Set(seasonRows.map(r => String(r.year)));
  const leagueByYear = {};
  for (const yr of touchedYears) {
    if (WNBA_LG[yr]) leagueByYear[yr] = WNBA_LG[yr];
  }

  const accolades     = getPlayerAccolades(legacy.name);
  const championships = accolades.championships ?? [];

  const seasonsPlayed = seasonRows
    .filter(r => r.gp != null && Number(r.gp) > 0)
    .map(r => Number(r.year))
    .sort((a, b) => a - b);

  return {
    player: { id: legacy.id, name: legacy.name, position: legacy.position },
    mode,
    seasonRows,
    careerRow,
    leagueByYear,
    advancedRows: [],          // Wikipedia doesn't publish PER/WS/TS% — left empty
    championships,
    accolades,
    seasonsPlayed,
    dataSource: 'legacy',
  };
}

/**
 * Build the input bundle for a bulk-legacy (BBRef CSV) player. Only advanced stats are available
 * (PER, TS%, WS, USG%, etc.) — no per-game data. Playoffs mode is always empty because the CSV
 * has no playoff splits. The prompt is told (via dataSource='legacy-bulk') to grade from advanced
 * metrics + accolades alone and not invent per-game numbers.
 */
function buildBulkLegacyInputs(playerId, mode) {
  const bulk = getBulkLegacyPlayer(playerId);
  if (!bulk) return null;

  if (mode === 'playoffs') return { empty: true };

  const years = Object.keys(bulk.seasons).map(Number).sort();
  if (years.length === 0) return null;

  // advancedRows: shaped to match what advRowToObj produces, so buildUserMessage's advByYear
  // merge can interleave these advanced fields with the (empty) seasonRows.
  const advancedRows = years.map(y => {
    const s = bulk.seasons[y];
    return {
      year:    String(y),
      gp:      s.G,
      tsPct:   s.TS_pct,
      efgPct:  null,
      usgPct:  s.USG_pct,
      astPct:  s.AST_pct,
      orbPct:  s.ORB_pct,
      drbPct:  null,
      trbPct:  s.TRB_pct,
      stlPct:  s.STL_pct,
      blkPct:  s.BLK_pct,
      per:     s.PER,
      ows:     s.OWS,
      dws:     s.DWS,
      ws:      s.WS,
      wsPer48: s.WS40,
    };
  });

  // seasonRows: we have NO per-game stats. Emit minimal rows (year, team, GP, MP) so the prompt's
  // "Seasons played" wording still has a list to chew on; numeric per-game fields are null.
  const seasonRows = years.map(y => {
    const s = bulk.seasons[y];
    return {
      year:     String(y),
      teamAbbr: s.team || null,
      gp:       s.G,
      min:      s.MP != null && s.G ? Number((s.MP / s.G).toFixed(1)) : null,
      pts:      null, reb: null, orb: null, drb: null, ast: null, stl: null, blk: null, tov: null,
      fgm:      null, fga: null, fgPct: null,
      fg3m:     null, fg3a: null, fg3Pct: null,
      ftm:      null, fta: null, ftPct: null,
    };
  });

  const touchedYears = new Set(seasonRows.map(r => String(r.year)));
  const leagueByYear = {};
  for (const yr of touchedYears) {
    if (WNBA_LG[yr]) leagueByYear[yr] = WNBA_LG[yr];
  }

  const accolades     = getPlayerAccolades(bulk.name);
  const championships = accolades.championships ?? [];

  const seasonsPlayed = seasonRows
    .filter(r => r.gp != null && Number(r.gp) > 0)
    .map(r => Number(r.year))
    .sort((a, b) => a - b);

  return {
    player: { id: bulk.id, name: bulk.name, position: bulk.position || '' },
    mode,
    seasonRows,
    careerRow:    null,
    leagueByYear,
    advancedRows,
    championships,
    accolades,
    seasonsPlayed,
    dataSource:   'legacy-bulk',
  };
}

/**
 * Build the input bundle for gradedReportClient.
 *
 * @param {string} playerId  - ESPN athlete ID
 * @param {string} mode      - 'career' | 'peak' | 'playoffs'
 * @returns {Promise<{ player, mode, seasonRows, careerRow, leagueByYear, championships, accolades, seasonsPlayed } | { empty: true }>}
 */
async function buildInputs(playerId, mode) {
  // Legacy (hand-curated, pre-2002) — bypass ESPN entirely. We only have per-game regular-season
  // data, so playoffs mode is always empty for legacy players (Wikipedia tables don't split that out).
  if (isLegacyId(playerId)) {
    return buildLegacyInputs(playerId, mode);
  }

  // Bulk-legacy (BBRef CSV import) — advanced-only data, no per-game stats. The graded-report
  // prompt is told to grade from advanced metrics + accolades only (no PPG/RPG to fall back on).
  if (isBulkLegacyId(playerId)) {
    return buildBulkLegacyInputs(playerId, mode);
  }

  const teams = await getTeams();
  const teamsById = Object.fromEntries(teams.map(t => [String(t.id), t]));

  const [player, regData, postData] = await Promise.all([
    fetchPlayerBasics(playerId),
    fetch(`${ESPN_WEB}/athletes/${playerId}/stats?seasontype=2`).then(r => r.ok ? r.json() : null),
    fetch(`${ESPN_WEB}/athletes/${playerId}/stats?seasontype=3`).then(r => r.ok ? r.json() : null),
  ]);

  if (!player) return null;

  const detailed = buildDetailedStats(regData, postData, teamsById);

  // Choose the per-game split based on mode
  const isPlayoffs = mode === 'playoffs';
  const pgSplit  = isPlayoffs ? detailed.perGame.playoffs      : detailed.perGame.regular;
  const pgCareer = isPlayoffs ? detailed.perGame.playoffCareer : detailed.perGame.regularCareer;

  // Playoffs empty-state check
  if (isPlayoffs && (!pgSplit || !pgSplit.rows || pgSplit.rows.length === 0)) {
    return { empty: true };
  }

  if (!pgSplit || !pgSplit.rows || pgSplit.rows.length === 0) {
    return null;
  }

  // Build advanced stats — mirror the logic from api.js /players/:id/advanced-pbp-all
  const regParsed  = parseESPNSeasonData(regData,  teamsById);
  const postParsed = parseESPNSeasonData(postData, teamsById);
  const pgTable    = regParsed?.pg?.table;
  const pgPostTable = postParsed?.pg?.table;

  // Hoist tid-by-year maps so they're accessible for championship computation below.
  const regTidByYear  = extractTeamIdByYear(regData);
  const postTidByYear = extractTeamIdByYear(postData);

  let advancedRows = [];

  if (pgTable) {
    const I = Object.fromEntries(pgTable.headers.map((h, i) => [h, i]));
    const IPost = pgPostTable
      ? Object.fromEntries(pgPostTable.headers.map((h, i) => [h, i]))
      : I;

    // Seed the teamSeasonStatsCache entries we need
    const seasonsNeeded = isPlayoffs
      ? (pgPostTable?.rows ?? []).map(r => ({ year: String(r[IPost.SEASON_ID]), tid: regTidByYear[String(r[IPost.SEASON_ID])] ?? postTidByYear[String(r[IPost.SEASON_ID])] }))
      : pgTable.rows.map(r => ({ year: String(r[I.SEASON_ID]), tid: regTidByYear[String(r[I.SEASON_ID])] }));

    await Promise.all(
      seasonsNeeded
        .filter(({ tid }) => !!tid)
        .map(({ tid, year }) => fetchTeamStats(tid, year))
    );

    const totByYear = {};
    const totTable = regParsed?.tot?.table;
    if (totTable?.rows) {
      for (const r of totTable.rows) totByYear[String(r[I.SEASON_ID])] = r;
    }

    const totPostByYear = {};
    const totPostTable = postParsed?.tot?.table;
    if (totPostTable?.rows) {
      for (const r of totPostTable.rows) totPostByYear[String(r[IPost.SEASON_ID])] = r;
    }

    if (!isPlayoffs) {
      // Regular / peak: use regular-season advanced rows
      const regSeasons = [...new Set(pgTable.rows.map(r => String(r[I.SEASON_ID])))].filter(s => WNBA_LG[s]);
      const regResults = await Promise.all(regSeasons.map(async season => {
        const playerRow = pgTable.rows.find(r => String(r[I.SEASON_ID]) === season);
        if (!playerRow) return null;
        const result = await computeSeasonPBP(playerId, season, playerRow, I, regTidByYear[season] ?? null, totByYear[season] ?? null, 2);
        return result ? { season, row: result.row, pbpGames: result.pbpGames } : null;
      }));
      const validReg = regResults.filter(Boolean);
      const advSplit = validReg.length ? buildPbpSplit(validReg, pgTable.rows, I) : buildAdvancedSplit(detailed.perGame.regular, regTidByYear, teamSeasonStatsCache, detailed.totals.regular);
      if (advSplit?.rows) {
        advancedRows = advSplit.rows.map(r => advRowToObj(ADV_HEADERS_SRV, r));
      }
    } else {
      // Playoffs: use playoff advanced rows
      const postSeasons = pgPostTable
        ? [...new Set(pgPostTable.rows.map(r => String(r[IPost.SEASON_ID])))].filter(s => WNBA_LG[s])
        : [];
      const postResults = await Promise.all(postSeasons.map(async season => {
        const playerRow = pgPostTable.rows.find(r => String(r[IPost.SEASON_ID]) === season);
        if (!playerRow) return null;
        const wsTeamId = regTidByYear[season] ?? postTidByYear[season] ?? null;
        const result = await computeSeasonPBP(playerId, season, playerRow, IPost, wsTeamId, totPostByYear[season] ?? null, 3);
        return result ? { season, row: result.row, pbpGames: result.pbpGames } : null;
      }));
      const validPost = postResults.filter(Boolean);
      const advSplit = validPost.length ? buildPbpSplit(validPost, pgPostTable?.rows ?? [], IPost) : null;
      if (advSplit?.rows) {
        advancedRows = advSplit.rows.map(r => advRowToObj(ADV_HEADERS_SRV, r));
      }
    }
  }

  // Convert per-game rows to labelled objects sorted by year ascending
  const seasonRows = pgSplit.rows
    .map(r => rowToObj(pgSplit.headers, r))
    .sort((a, b) => String(a.year).localeCompare(String(b.year)));

  // Career row
  const careerRow = pgCareer?.rows?.[0]
    ? rowToObj(pgCareer.headers, pgCareer.rows[0])
    : null;

  // League averages for the touched seasons
  const touchedYears = new Set(seasonRows.map(r => String(r.year)));
  const leagueByYear = {};
  for (const yr of touchedYears) {
    if (WNBA_LG[yr]) leagueByYear[yr] = WNBA_LG[yr];
  }

  // Individual accolades — MVP, Finals MVP, DPOY, ROY, Sixth Player, All-WNBA First Team,
  // and championships (from WNBA_PLAYER_CHAMPIONSHIPS constant — not derived from season rows).
  // The season-row derivation was unreliable: it missed players who sat a championship season
  // (no ESPN row = no credit) and misfired on franchise-lineage edge cases.
  const accolades = getPlayerAccolades(player.name);

  // Championships: extracted directly from accolades (which now includes the championships field).
  const championships = accolades.championships ?? [];

  // Dev-mode championship debug log: print the resolved championship years so regressions surface
  // immediately in server logs when running locally.
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[championships] ${player.name}: [${championships.join(', ')}]`);
  }

  // seasonsPlayed: sorted list of actual season years the player has ESPN data for, with GP > 0.
  // Passed to the prompt so the AI can validate peakSeasons as a strict subset.
  // GP=0 or null rows (e.g. injury seasons that ESPN records as played) are excluded so the AI
  // cannot claim consecutive seasons through a year the player did not appear.
  const seasonsPlayed = seasonRows
    .filter(r => r.gp != null && Number(r.gp) > 0)
    .map(r => Number(r.year))
    .sort((a, b) => a - b);

  return { player, mode, seasonRows, careerRow, leagueByYear, advancedRows, championships, accolades, seasonsPlayed };
}

module.exports = { buildInputs };
