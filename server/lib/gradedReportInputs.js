// gradedReportInputs.js — assembles source data for AI-graded player reports.
//
// Pure function: given a playerId and mode, fetches per-season and advanced stats from
// the existing ESPN-backed routes (reusing the same helpers api.js uses directly), then
// slices to the rows relevant for the requested mode and attaches league-average context.
//
// Returns { player, mode, seasonRows, careerRow, leagueByYear, championships, accolades }
// Returns { empty: true } when mode is 'playoffs' and the player has no playoff data.
//
// championships: array of years the player's team won the WNBA Championship.
//   Derived from WNBA_CHAMPIONS + franchise alias lineage. Players on defunct franchises
//   (Houston Comets, Sacramento Monarchs) may have incomplete results if their team ID is
//   not resolvable via the current teams list — acceptable for v1.
// accolades: { mvp, finalsMVP, dpoy, roy, sixth, allWnbaFirst } — from wnbaAccolades.js.

'use strict';

const { ESPN_WEB, getTeams, fetchTeamStats, teamSeasonStatsCache } = require('./espnClient');
const { parseESPNSeasonData, extractTeamIdByYear, buildDetailedStats } = require('./statsParser');
const { ADV_HEADERS_SRV, buildAdvancedSplit, computeSeasonPBP, buildPbpSplit } = require('./advancedStats');
const { WNBA_LG } = require('../constants/leagueAverages');
const { isChampion } = require('./historyAggregator');
const { getPlayerAccolades } = require('../constants/wnbaAccolades');

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

// Derive championship years from per-season rows.
//
// Uses isChampion(year, teamDisplayName) from historyAggregator, which resolves franchise
// lineage aliases so Detroit Shock ↔ Dallas Wings and similar work correctly.
//
// teamNameByYear: map of seasonYear(string) → team display name, built from teamsById lookup.
// Years where the team ID isn't in teamsById (defunct franchises: Comets, Monarchs) will have
// no entry and are silently skipped — those championships are not attributable in v1.
function getChampionshipsForPlayer(seasonRows, teamNameByYear) {
  const years = [];
  for (const row of seasonRows) {
    const yr  = Number(row.year);
    const teamName = teamNameByYear[String(yr)];
    if (!teamName) continue;
    if (isChampion(yr, teamName)) years.push(yr);
  }
  return years.sort((a, b) => a - b);
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
 * Build the input bundle for gradedReportClient.
 *
 * @param {string} playerId  - ESPN athlete ID
 * @param {string} mode      - 'career' | 'peak' | 'playoffs'
 * @returns {Promise<{ player, mode, seasonRows, careerRow, leagueByYear, championships, accolades } | { empty: true }>}
 */
async function buildInputs(playerId, mode) {
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

  // Championship years — resolved via WNBA_CHAMPIONS + franchise-lineage aliases.
  // tidByYear prefers regular-season team assignment; falls back to post-season.
  // Uses current team display name (teamsById lookup) so isChampion() + FRANCHISE_ALIASES works.
  // Players on defunct franchises (Houston Comets etc.) whose team ID is absent from teamsById
  // will have no team name resolved and those years are silently omitted.
  const teamNameByYear = {};
  for (const yr of touchedYears) {
    const tid = regTidByYear[yr] ?? postTidByYear[yr];
    if (tid && teamsById[String(tid)]) {
      teamNameByYear[yr] = teamsById[String(tid)].name;
    }
  }
  const championships = getChampionshipsForPlayer(seasonRows, teamNameByYear);

  // Individual accolades — MVP, Finals MVP, DPOY, ROY, Sixth Player, All-WNBA First Team.
  const accolades = getPlayerAccolades(player.name);

  return { player, mode, seasonRows, careerRow, leagueByYear, advancedRows, championships, accolades };
}

module.exports = { buildInputs };
