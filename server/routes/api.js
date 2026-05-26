const express = require('express');
const router  = express.Router();

const crypto                                                             = require('crypto');
const { getDb }                                                          = require('../db');
const { WNBA_LG }                                                        = require('../constants/leagueAverages');
const { WNBA_FOUNDED }                                                   = require('../constants/wnbaFounded');
const { buildHistory, buildLegacyHistory }                               = require('../lib/historyAggregator');
const { buildSeasonInfo }                                                = require('../lib/seasonInfo');
const { readOrFetch }                                                    = require('../lib/teamSeasonCache');
const narrativeClient                                                    = require('../lib/narrativeClient');
const gradedReportClient                                                 = require('../lib/gradedReportClient');
const { buildInputs: buildReportInputs }                                 = require('../lib/gradedReportInputs');
const { parseESPNSeasonData, extractTeamIdByYear, buildDetailedStats }   = require('../lib/statsParser');
const { ADV_HEADERS_SRV, buildAdvancedSplit, buildAdvancedCareer,
        computeSeasonPBP, buildPbpSplit }                                = require('../lib/advancedStats');
const { getPlayerPercentiles }                                           = require('../lib/percentileClient');
const { LEGACY_PLAYERS_BULK, isBulkLegacyId, getBulkLegacyPlayer, resolveLegacyId,
        searchBulkLegacyPlayers, buildBulkLegacyProfile,
        buildBulkLegacyDetailedStats }                                   = require('../constants/legacyPlayerBulk');
const { LEGACY_DEFUNCT_TEAMS, getLegacyRoster, tricodeForEspnId,
        tricodeForDefunctId }                                            = require('../constants/legacyTeamRosters');
const { getProvider }                                                    = require('../providers');

// Data-source access goes through the active provider (see server/providers). These thin locals
// keep the call sites below unchanged while removing the direct espnClient import; each resolves
// the provider lazily per call so STATS_PROVIDER / test overrides take effect.
const getTeams                = (...a) => getProvider().getTeams(...a);
const getRoster               = (...a) => getProvider().getRoster(...a);
const fetchSeasonRoster       = (...a) => getProvider().getSeasonRoster(...a);
const fetchTeamStats          = (...a) => getProvider().getTeamStats(...a);
const fetchTeamStatsRaw       = (...a) => getProvider().getTeamStatsRaw(...a);
const fetchTeamPtsAllowed     = (...a) => getProvider().getTeamPointsAllowed(...a);
const fetchTeamPtsAllowedRaw  = (...a) => getProvider().getTeamPointsAllowedRaw(...a);
const fetchTeamSchedule       = (...a) => getProvider().getTeamSchedule(...a);

async function fetchPlayerSeasonData(playerId) {
  const [teams, { regData, postData }] = await Promise.all([
    getTeams(),
    getProvider().getPlayerSeasonStats(playerId),
  ]);
  return { teams, regData, postData, teamsById: Object.fromEntries(teams.map(t => [t.id, t])) };
}

router.get('/teams', async (req, res) => {
  try {
    res.json(await getProvider().getTeams());
  } catch {
    res.status(500).json({ error: 'failed to load teams' });
  }
});

// GET /api/teams/legacy — returns the catalog of defunct franchises with their synthetic ids.
// Stubbed endpoint: lets a direct URL (or future Historical Franchises UI) resolve the same id
// the team/roster endpoint expects. TODO: surface these in the home-page team grid.
router.get('/teams/legacy', (req, res) => {
  const teams = Object.entries(LEGACY_DEFUNCT_TEAMS).map(([tri, t]) => ({
    id:            t.id,
    name:          t.name,
    location:      t.location,
    abbreviation:  tri,
    activeYears:   t.activeYears,
    defunct:       true,
  }));
  res.json({ teams });
});

// Build a legacy-roster response from LEGACY_PLAYERS_BULK player_IDs.
// Used by both the numeric-ESPN-id path and the synthetic 'legacy-...' defunct-team path.
function buildLegacyRosterResponse(team, season, playerIds) {
  const players = playerIds.map(pid => {
    const p = LEGACY_PLAYERS_BULK[pid];
    if (!p) return null;                // safety: roster references a missing player
    const seasonRow = p.seasons?.[season] ?? null;
    return {
      id:           p.id,
      name:         p.name,
      position:     p.position ?? '',
      positionName: p.position ?? '',
      jersey:       null,
      headshot:     null,
      height:       null,
      weight:       null,
      age:          seasonRow?.age ?? null,
      college:      null,
      birthPlace:   null,
      experience:   null,
      teamId:       team.id,
      teamName:     team.name,
      legacy:       true,
      dataSource:   'legacy-bulk',
    };
  }).filter(Boolean);
  return { team, players, season, dataSource: 'legacy-bulk' };
}

router.get('/teams/:id/roster', async (req, res) => {
  const rawId = req.params.id;

  // season param: default to current calendar year; reject non-numeric / non-4-digit values.
  const currentYear = new Date().getFullYear();
  let season;
  if (req.query.season === undefined || req.query.season === '') {
    season = currentYear;
  } else if (/^\d{4}$/.test(req.query.season)) {
    season = parseInt(req.query.season, 10);
  } else {
    return res.status(400).json({ error: 'season must be a 4-digit year (e.g. 2024)' });
  }

  // Defunct-team synthetic ids ('legacy-cleveland-rockers' etc.) — resolve via LEGACY_DEFUNCT_TEAMS.
  // These don't have ESPN ids, so the numeric-id validator below would reject them; handle first.
  if (typeof rawId === 'string' && rawId.startsWith('legacy-')) {
    const tricode = tricodeForDefunctId(rawId);
    if (!tricode) return res.status(404).json({ error: 'team not found' });
    const defunct = LEGACY_DEFUNCT_TEAMS[tricode];
    const [startYear, endYear] = defunct.activeYears;
    // Default season for a defunct team is the franchise's first active year — current year is meaningless.
    const resolvedSeason = req.query.season === undefined || req.query.season === ''
      ? startYear
      : season;
    if (resolvedSeason < startYear || resolvedSeason > endYear) {
      return res.status(400).json({ error: `season must be between ${startYear} and ${endYear}` });
    }
    if (resolvedSeason > 2001) {
      // Past 2001 we have no bulk data — defunct teams in 2002-2009 are out of scope for this dispatch.
      return res.json({ team: { id: rawId, name: defunct.name, location: defunct.location }, players: [], season: resolvedSeason, dataSource: 'legacy-bulk', note: 'roster only available for 1997-2001' });
    }
    const ids = getLegacyRoster(tricode, resolvedSeason) ?? [];
    const team = { id: rawId, name: defunct.name, location: defunct.location, abbreviation: tricode };
    return res.json(buildLegacyRosterResponse(team, resolvedSeason, ids));
  }

  // Validate :id — ESPN team IDs are integers; reject anything non-numeric.
  if (!/^\d+$/.test(rawId)) {
    return res.status(400).json({ error: 'team id must be a numeric string' });
  }
  const teamId = rawId;

  // Reject seasons after the current year or before the franchise's founding year.
  const foundedYear = WNBA_FOUNDED[teamId] ?? 1997;
  if (season > currentYear || season < foundedYear) {
    return res.status(400).json({ error: 'invalid season' });
  }

  try {
    const allTeams = await getTeams();
    const team = allTeams.find(t => String(t.id) === teamId);
    if (!team) return res.status(404).json({ error: 'team not found' });

    // Pre-2002 seasons: ESPN has no usable roster data. Fall back to the bulk-legacy roster
    // when this franchise has a BBRef tricode mapping for the requested season.
    if (season <= 2001) {
      const tricode = tricodeForEspnId(teamId);
      const ids = tricode ? getLegacyRoster(tricode, season) : null;
      if (ids && ids.length > 0) {
        return res.json(buildLegacyRosterResponse(team, season, ids));
      }
      // No legacy roster for this team/season — fall through to ESPN (will likely return []).
    }

    let players;
    if (season === currentYear) {
      // Current season: use the in-memory cached live roster.
      players = await getRoster(team.id, team.name);
    } else {
      // Historical season: fetch from ESPN Web API (site.api returns empty athletes for past seasons).
      // fetchSeasonRoster is non-fatal — returns [] if ESPN is unreachable or the season is sparse.
      players = await fetchSeasonRoster(team.id, season, team.name);
    }

    res.json({ team, players, season });
  } catch (err) {
    console.error(`teams/${teamId}/roster season=${season}:`, err.message);
    res.status(500).json({ error: 'failed to load roster' });
  }
});

// GET /api/teams/:id/season-info?season=YYYY
// Returns season-correct header tuple: { teamId, season, name, location, record?, seedLabel?,
// conference?, champion? }. Fields are omitted (not null) when unavailable.
//
// Current season: proxied from getTeams() — no additional ESPN call, stays in sync with /api/teams.
// Past season: fetched via fetchStandingsForYear, cached in teamSeasonInfo MongoDB collection.
// The pre-2003 ESPN corrupted-scalar fix is in fetchStandingsForYear (historyAggregator) — not
// duplicated here. Franchise name from WNBA_FRANCHISE_LINEAGE via buildSeasonInfo.
router.get('/teams/:id/season-info', async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) {
    return res.status(400).json({ error: 'team id must be a numeric string' });
  }
  const teamId = req.params.id;

  const currentYear = new Date().getFullYear();
  let season;
  if (req.query.season === undefined || req.query.season === '') {
    season = currentYear;
  } else if (/^\d{4}$/.test(req.query.season)) {
    season = parseInt(req.query.season, 10);
  } else {
    return res.status(400).json({ error: 'season must be a 4-digit year (e.g. 2024)' });
  }

  const foundedYear = WNBA_FOUNDED[teamId] ?? 1997;
  if (season > currentYear || season < foundedYear) {
    return res.status(400).json({ error: 'invalid season' });
  }

  try {
    const allTeams = await getTeams();
    const team = allTeams.find(t => String(t.id) === teamId);
    if (!team) return res.status(404).json({ error: 'team not found' });

    if (season === currentYear) {
      // Fast path: proxy from current team object (no MongoDB, no extra ESPN call).
      const result = await buildSeasonInfo(team, season, currentYear);
      return res.json(result);
    }

    // Past season: cache-aside via MongoDB teamSeasonInfo collection.
    const cacheKey = `${teamId}-${season}`;
    const result = await readOrFetch(
      'teamSeasonInfo',
      cacheKey,
      () => buildSeasonInfo(team, season, currentYear)
    );
    return res.json(result);
  } catch (err) {
    console.error(`teams/${teamId}/season-info season=${season}:`, err.message);
    res.status(502).json({ error: 'upstream error fetching season info' });
  }
});

router.get('/teams/:id/stats', async (req, res) => {
  // Validate :id — ESPN team IDs are integers; reject anything non-numeric.
  if (!/^\d+$/.test(req.params.id)) {
    return res.status(400).json({ error: 'team id must be a numeric string' });
  }
  const teamId = req.params.id;

  // season param: default to current calendar year; reject non-numeric / non-4-digit values.
  const currentYear = new Date().getFullYear();
  let season;
  if (req.query.season === undefined || req.query.season === '') {
    season = currentYear;
  } else if (/^\d{4}$/.test(req.query.season)) {
    season = parseInt(req.query.season, 10);
  } else {
    return res.status(400).json({ error: 'season must be a 4-digit year (e.g. 2026)' });
  }

  try {
    if (season === currentYear) {
      // Current season: use in-process caches (mutable mid-season). Same path as before.
      // espnClient wraps each in withCache internally.
      const [rawStats, oppPpg] = await Promise.all([
        fetchTeamStats(teamId, season),
        fetchTeamPtsAllowed(teamId, season).catch(err => {
          console.warn(`teams/${teamId}/stats: oppPpg unavailable (season=${season}):`, err.message);
          return null;
        }),
      ]);

      // null → ESPN error; { noData: true } → ESPN 200 but no stats categories. Both render as empty.
      if (!rawStats || rawStats.noData) return res.json({ empty: true, season, teamId });

      const stats = { ...rawStats };
      if (oppPpg != null) stats.oppPpg = oppPpg;
      return res.json({ season, teamId, stats });
    }

    // Past season: route through MongoDB teamSeasonStats cache.
    // Raw fetch functions bypass the in-process cache — past seasons are immutable and belong
    // in MongoDB only. In-process cache stays current-season-only for clean invalidation story.
    const cacheKey = `${teamId}-${season}`;
    const result = await readOrFetch('teamSeasonStats', cacheKey, async () => {
      const [rawStats, oppPpg] = await Promise.all([
        fetchTeamStatsRaw(teamId, season),
        fetchTeamPtsAllowedRaw(teamId, season).catch(err => {
          console.warn(`teams/${teamId}/stats: oppPpg unavailable (season=${season}):`, err.message);
          return null;
        }),
      ]);

      // null → ESPN error (non-2xx) — transient, do not cache.
      if (rawStats === null) return { empty: true, season, teamId };
      // { noData: true } → ESPN 200 but no stats categories — confirmed empty, safe to cache.
      if (rawStats.noData) return { empty: true, confirmedEmpty: true, season, teamId };

      const stats = { ...rawStats };
      if (oppPpg != null) stats.oppPpg = oppPpg;
      return { season, teamId, stats };
    });

    return res.json(result);
  } catch (err) {
    console.error(`teams/${teamId}/stats season=${season}:`, err.message);
    res.status(502).json({ error: 'upstream error fetching team stats' });
  }
});

router.get('/teams/:id/history', async (req, res) => {
  // Defunct-team synthetic ids — route to legacy history builder (ESPN data by name-match).
  if (typeof req.params.id === 'string' && req.params.id.startsWith('legacy-')) {
    const tricode = tricodeForDefunctId(req.params.id);
    if (!tricode) return res.status(404).json({ error: 'team not found' });
    const defunct = LEGACY_DEFUNCT_TEAMS[tricode];
    try {
      return res.json(await buildLegacyHistory(defunct));
    } catch (err) {
      console.error(`teams/${req.params.id}/history:`, err.message);
      return res.status(502).json({ error: 'upstream error building legacy team history' });
    }
  }

  if (!/^\d+$/.test(req.params.id)) {
    return res.status(400).json({ error: 'team id must be a numeric string' });
  }
  const teamId = req.params.id;

  try {
    const allTeams = await getTeams();
    const team = allTeams.find(t => String(t.id) === teamId);
    if (!team) return res.status(404).json({ error: 'team not found' });

    const result = await buildHistory(team);
    res.json(result);
  } catch (err) {
    console.error(`teams/${teamId}/history:`, err.message);
    res.status(502).json({ error: 'upstream error building team history' });
  }
});

router.get('/teams/:id/schedule', async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) {
    return res.status(400).json({ error: 'team id must be a numeric string' });
  }
  const teamId = req.params.id;

  // season: required, 4-digit year, 1997 or later
  const seasonRaw = req.query.season;
  if (!seasonRaw || !/^\d{4}$/.test(seasonRaw)) {
    return res.status(400).json({ error: 'season must be a 4-digit year (e.g. 2024)' });
  }
  const season = parseInt(seasonRaw, 10);
  if (season < 1997) {
    return res.status(400).json({ error: 'season must be 1997 or later' });
  }

  // seasontype: must be 2 (regular) or 3 (playoffs); defaults to 2
  const stRaw = req.query.seasontype;
  let seasontype;
  if (stRaw === undefined || stRaw === '') {
    seasontype = 2;
  } else if (stRaw === '2' || stRaw === '3') {
    seasontype = parseInt(stRaw, 10);
  } else {
    return res.status(400).json({ error: 'seasontype must be 2 (regular) or 3 (playoffs)' });
  }

  try {
    const allTeams = await getTeams();
    const team = allTeams.find(t => String(t.id) === teamId);
    if (!team) return res.status(404).json({ error: 'team not found' });

    const currentYear = new Date().getFullYear();

    if (season === currentYear) {
      // Current season: no cache — live data. Same path as before.
      // fetchTeamSchedule returns null on ESPN error, [] on confirmed-empty, or an events array.
      const events = await fetchTeamSchedule(teamId, season, seasontype);
      if (!events || events.length === 0) return res.json({ empty: true, teamId, season, seasontype, events: [] });
      return res.json({ teamId, season, seasontype, events });
    }

    // Past season: route through MongoDB teamSeasonSchedule cache.
    // Cache key includes seasontype to prevent regular/playoff collision — same key shape as
    // the design doc specifies: '<teamId>-<season>-<seasontype>'.
    const cacheKey = `${teamId}-${season}-${seasontype}`;
    const result = await readOrFetch('teamSeasonSchedule', cacheKey, async () => {
      const events = await fetchTeamSchedule(teamId, season, seasontype);
      // null → ESPN error (non-2xx or network failure) — do not cache; mark as transient empty.
      if (events === null) return { empty: true, teamId, season, seasontype, events: [] };
      // [] → ESPN 200 with zero events — confirmed empty, safe to cache permanently.
      //       Keep empty: true so clients render the empty-state UI correctly.
      //       Add confirmedEmpty: true so the cache gate knows this is safe to persist.
      // non-empty array → normal response.
      if (events.length === 0) return { empty: true, confirmedEmpty: true, teamId, season, seasontype, events: [] };
      return { teamId, season, seasontype, events };
    });

    return res.json(result);
  } catch (err) {
    console.error(`teams/${teamId}/schedule season=${season} seasontype=${seasontype}:`, err.message);
    res.status(502).json({ error: 'upstream error fetching team schedule' });
  }
});

router.get('/search', async (req, res) => {
  const q = (req.query.q || '').toLowerCase().trim();
  if (!q) return res.json({ teams: [], players: [] });
  try {
    const allTeams = await getTeams();
    const matchedTeams = allTeams.filter(
      t => t.name.toLowerCase().includes(q) || t.abbreviation.toLowerCase().includes(q)
    );

    const activePlayers = getProvider().getActivePlayers()
      .filter(p => p.name.toLowerCase().includes(q));
    const activeIds = new Set(activePlayers.map(p => p.id));

    let retiredPlayers = [];
    const db = getDb();
    if (db) {
      const docs = await db.collection('playerIndex')
        .find({ name: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } })
        .limit(20)
        .toArray();
      retiredPlayers = docs
        .filter(d => !activeIds.has(d.id))
        .map(d => ({ id: d.id, name: d.name, position: d.position, headshot: d.headshot, retired: true }));
    }

    // Pre-2002 legends are stored alongside the bulk-legacy dataset (single source of truth).
    // Eight hand-curated greats have per-game stats inline; the rest are advanced-only.
    const bulkLegacyMatches = searchBulkLegacyPlayers(q);

    const matchedPlayers = [...activePlayers, ...retiredPlayers, ...bulkLegacyMatches].slice(0, 30);
    res.json({ teams: matchedTeams, players: matchedPlayers });
  } catch {
    res.status(500).json({ error: 'search failed' });
  }
});

router.get('/players/:id', async (req, res) => {
  try {
    // Translate retired synthetic ids ('cooper-cynthia-1963') to their BBRef counterparts.
    // Old shared URLs continue to work; the response carries the canonical BBRef id.
    const playerId = resolveLegacyId(req.params.id);

    // Bulk-legacy (BBRef-keyed historical data) — short-circuit before ESPN. Pattern: 'staleda01w'.
    // ESPN ids are pure integers and never end in a 'w', so no collision risk with the regex.
    if (isBulkLegacyId(playerId)) {
      const bulk = getBulkLegacyPlayer(playerId);
      if (!bulk) return res.status(404).json({ error: 'player not found' });
      return res.json({ player: buildBulkLegacyProfile(bulk), dataSource: 'legacy-bulk' });
    }

    const player = getProvider().findActivePlayer(playerId);
    if (player) return res.json({ player });

    // Not in active roster — try the source on-demand (retired player).
    const retired = await getProvider().getRetiredPlayer(playerId);
    if (!retired) return res.status(404).json({ error: 'player not found' });
    res.json({ player: retired });
  } catch {
    res.status(500).json({ error: 'failed to load player' });
  }
});

router.get('/players/:id/detailed-stats', async (req, res) => {
  try {
    // Translate retired synthetic ids to BBRef. Old URLs keep working.
    const playerId = resolveLegacyId(req.params.id);

    // Bulk-legacy (BBRef-keyed) players: build from constant, skip ESPN. The response carries
    // advancedOnly when no per-game data is present, so the frontend can hide the per-game tab.
    if (isBulkLegacyId(playerId)) {
      const bulk = getBulkLegacyPlayer(playerId);
      if (!bulk) return res.status(404).json({ error: 'player not found' });
      return res.json(buildBulkLegacyDetailedStats(bulk));
    }

    const { regData, postData, teamsById } = await fetchPlayerSeasonData(playerId);
    const result = buildDetailedStats(regData, postData, teamsById);

    // Players with no WNBA games yet (rookies pre-season, etc.) get an empty payload instead of 404
    // so the page renders the normal stat-tab strip with a friendly empty state inside.
    if (!result.perGame.regular) return res.json({ ...result, empty: true });

    const regTidByYear  = extractTeamIdByYear(regData);
    const postTidByYear = extractTeamIdByYear(postData);
    const allPairs = new Map([
      ...Object.entries(regTidByYear).map(([y, t])  => [`${t}-${y}`, { t, y }]),
      ...Object.entries(postTidByYear).map(([y, t]) => [`${t}-${y}`, { t, y }]),
    ]);
    // Build a plain {teamId-year: stats} map from the provider; buildAdvancedSplit just indexes it,
    // so we never reach into the provider's internal cache.
    const teamStatsByKey = Object.fromEntries(
      await Promise.all([...allPairs.values()].map(async ({ t, y }) => [`${t}-${y}`, await fetchTeamStats(t, y)]))
    );

    result.advanced = {
      regular:       buildAdvancedSplit(result.perGame.regular,       regTidByYear,  teamStatsByKey, result.totals.regular),
      regularCareer: buildAdvancedCareer(result.perGame.regularCareer, result.totals.regularCareer),
      playoffs:      buildAdvancedSplit(result.perGame.playoffs,      postTidByYear, teamStatsByKey, result.totals.playoffs),
      playoffCareer: buildAdvancedCareer(result.perGame.playoffCareer, result.totals.playoffCareer),
    };

    res.json(result);
  } catch (err) {
    console.error('detailed-stats:', err.message);
    res.status(500).json({ error: 'failed to load detailed stats' });
  }
});

router.get('/players/:id/gamelog', async (req, res) => {
  try {
    const log = await getProvider().getPlayerGameLog(req.params.id, req.query.season);
    if (!log) return res.status(404).json({ error: 'no gamelog available' });
    res.json(log);
  } catch (err) {
    console.error('gamelog:', err.message);
    res.status(500).json({ error: 'failed to load gamelog' });
  }
});



router.get('/players/:id/advanced-pbp-all', async (req, res) => {
  try {

    const { regData, postData, teamsById } = await fetchPlayerSeasonData(req.params.id);
    const regParsed  = parseESPNSeasonData(regData,  teamsById);
    const postParsed = parseESPNSeasonData(postData, teamsById);
    const pgTable = regParsed?.pg?.table;
    if (!pgTable) return res.status(404).json({ error: 'no stats for this player' });
    const I = Object.fromEntries(pgTable.headers.map((h, i) => [h, i]));

    const pgPostTable = postParsed?.pg?.table;
    const IPost = pgPostTable
      ? Object.fromEntries(pgPostTable.headers.map((h, i) => [h, i]))
      : I;

    // Cache: invalidate when regular or playoff GP changes, or when format is old (no .regular key)
    const regGP  = pgTable.rows.reduce((s, r) => s + (r[I.GP] ?? 0), 0);
    const postGP = (pgPostTable?.rows ?? []).reduce((s, r) => s + (r[IPost.GP] ?? 0), 0);
    const currentGP = regGP + postGP;
    const db = getDb();
    if (db) {
      const advCached = await db.collection('advancedStats').findOne({ _id: req.params.id });
      if (advCached?.gp === currentGP && advCached.v === 25 && advCached.data?.regular != null) return res.json(advCached.data);
    }

    // Build totals-by-year maps for both splits
    const totByYear = {};
    const totTable = regParsed?.tot?.table;
    if (totTable?.rows) for (const r of totTable.rows) totByYear[String(r[I.SEASON_ID])] = r;

    const totPostByYear = {};
    const totPostTable = postParsed?.tot?.table;
    if (totPostTable?.rows) for (const r of totPostTable.rows) totPostByYear[String(r[IPost.SEASON_ID])] = r;

    const regTidByYear  = extractTeamIdByYear(regData);
    const postTidByYear = extractTeamIdByYear(postData);

    const regSeasons  = [...new Set(pgTable.rows.map(r => String(r[I.SEASON_ID])))].filter(s => WNBA_LG[s]);
    const postSeasons = pgPostTable
      ? [...new Set(pgPostTable.rows.map(r => String(r[IPost.SEASON_ID])))].filter(s => WNBA_LG[s])
      : [];

    const [regResults, postResults] = await Promise.all([
      Promise.all(regSeasons.map(async season => {
        const playerRow = pgTable.rows.find(r => String(r[I.SEASON_ID]) === season);
        if (!playerRow) return null;
        const result = await computeSeasonPBP(req.params.id, season, playerRow, I, regTidByYear[season] ?? null, totByYear[season] ?? null, 2);
        return result ? { season, row: result.row, pbpGames: result.pbpGames } : null;
      })),
      Promise.all(postSeasons.map(async season => {
        const playerRow = pgPostTable.rows.find(r => String(r[IPost.SEASON_ID]) === season);
        if (!playerRow) return null;
        // WS computation needs regular-season team stats; prefer regTidByYear so the team ID
        // is always valid even if ESPN omits teamId from playoff stat entries.
        const wsTeamId = regTidByYear[season] ?? postTidByYear[season] ?? null;
        const result = await computeSeasonPBP(req.params.id, season, playerRow, IPost, wsTeamId, totPostByYear[season] ?? null, 3);
        return result ? { season, row: result.row, pbpGames: result.pbpGames } : null;
      })),
    ]);

    const validReg  = regResults.filter(Boolean);
    const validPost = postResults.filter(Boolean);

    const advResult = {
      headers:  ADV_HEADERS_SRV,
      regular:  buildPbpSplit(validReg,  pgTable.rows,      I),
      playoffs: validPost.length ? buildPbpSplit(validPost, pgPostTable?.rows ?? [], IPost) : null,
      pbpGamesBySeason: Object.fromEntries([
        ...validReg.map(r => [r.season, r.pbpGames]),
        ...validPost.map(r => [`post-${r.season}`, r.pbpGames]),
      ]),
    };

    if (db) db.collection('advancedStats')
      .replaceOne({ _id: req.params.id }, { _id: req.params.id, gp: currentGP, v: 25, data: advResult }, { upsert: true })
      .catch(err => console.error('mongo write advancedStats:', err.message));
    res.json(advResult);
  } catch (err) {
    console.error('advanced-pbp-all:', err.message);
    res.status(500).json({ error: 'failed to compute advanced stats' });
  }
});

router.get('/players/:id/percentiles', async (req, res) => {
  try {
    const result = await getPlayerPercentiles(req.params.id);
    if (!result) return res.status(404).json({ error: 'no stats found for this player' });
    res.json(result);
  } catch (err) {
    console.error('percentiles:', err.message);
    res.status(500).json({ error: 'failed to compute percentiles' });
  }
});

// GET /api/players/:id/graded-report?mode=career|peak|playoffs
//
// Returns an AI-generated letter-grade report for a player scoped to the requested mode.
// Reports are cached in MongoDB collection `playerGradedReports` keyed by
// `"<playerId>-<mode>-<sourceHash[:8]>"` so stat corrections or prompt-version bumps write
// a new document rather than overwriting the old one.
//
// 503 — no ANTHROPIC_API_KEY
// 404 — player id not found in ESPN
// 400 — invalid id or mode
// 200 { empty: true } — mode=playoffs with zero playoff GP
// 502 — Claude error or shape validation failure
router.get('/players/:id/graded-report', async (req, res) => {
  // Validate :id — numeric (ESPN), retired synthetic id (e.g. 'cooper-cynthia-1963'), or bulk-legacy
  // BBRef id (e.g. 'staleda01w'). Synthetic ids resolve to BBRef via resolveLegacyId, after which
  // buildInputs branches on isBulkLegacyId.
  const rawId = req.params.id;
  const playerId = resolveLegacyId(rawId);
  if (!/^\d+$/.test(playerId) && !isBulkLegacyId(playerId)) {
    return res.status(400).json({ error: 'player id must be a numeric string or legacy id' });
  }

  // Validate mode (default 'career')
  const modeRaw = req.query.mode;
  const VALID_MODES = new Set(['career', 'peak', 'playoffs']);
  let mode;
  if (modeRaw === undefined || modeRaw === '') {
    mode = 'career';
  } else if (VALID_MODES.has(modeRaw)) {
    mode = modeRaw;
  } else {
    return res.status(400).json({ error: 'mode must be one of: career, peak, playoffs' });
  }

  if (!gradedReportClient.enabled) {
    return res.status(503).json({ error: 'Graded report unavailable' });
  }

  let inputs;
  try {
    inputs = await buildReportInputs(playerId, mode);
  } catch (err) {
    console.error(`[graded-report] buildInputs playerId=${playerId} mode=${mode}:`, err.message);
    return res.status(502).json({ error: 'upstream error building report inputs' });
  }

  // Player not found
  if (inputs === null) {
    return res.status(404).json({ error: 'player not found' });
  }

  // Playoffs empty-state — player has no playoff data
  if (inputs.empty) {
    return res.json({ playerId, mode, empty: true });
  }

  // Deterministic source hash over all data Claude will receive.
  // Sorted ascending by year so insertion order doesn't matter.
  // seasonsPlayed is now included so that a change in the player's GP-filtered year set
  // (e.g. ESPN adds or removes a 0-GP row) correctly invalidates the cache.
  const hashInput = JSON.stringify({
    promptVersion:  gradedReportClient.PROMPT_VERSION,
    playerId,
    playerName:     inputs.player.name,
    position:       inputs.player.position,
    mode,
    seasonRows:     [...(inputs.seasonRows ?? [])].sort((a, b) => String(a.year).localeCompare(String(b.year))),
    advancedRows:   [...(inputs.advancedRows ?? [])].sort((a, b) => String(a.year).localeCompare(String(b.year))),
    leagueByYear:   Object.fromEntries(Object.entries(inputs.leagueByYear ?? {}).sort()),
    championships:  [...(inputs.championships ?? [])].sort((a, b) => a - b),
    accolades:      inputs.accolades ?? {},
    seasonsPlayed:  [...(inputs.seasonsPlayed ?? [])].sort((a, b) => a - b),
  });
  const sourceHash = crypto.createHash('sha1').update(hashInput).digest('hex');
  const docId = `${playerId}-${mode}-${sourceHash.slice(0, 8)}`;

  const db = getDb();

  // Admin-gated manual refresh — mirrors narrative route exactly.
  const adminToken  = process.env.ADMIN_TOKEN;
  const headerToken = req.headers['x-admin-token'];
  let forceRefresh  = false;
  if (req.query.refresh === '1' && adminToken && headerToken) {
    const aBuf = Buffer.from(adminToken,  'utf8');
    const bBuf = Buffer.from(headerToken, 'utf8');
    if (aBuf.length === bBuf.length) {
      forceRefresh = crypto.timingSafeEqual(aBuf, bBuf);
    }
  }

  // Cache lookup — skip when Mongo unavailable or forced refresh
  if (db && !forceRefresh) {
    let cached;
    try {
      cached = await db.collection('playerGradedReports').findOne({ _id: docId });
    } catch (err) {
      console.error(`[graded-report] mongo read failed _id=${docId}:`, err.message);
      cached = null;
    }
    if (cached) {
      const years = inputs.seasonRows?.map(r => Number(r.year)).filter(Boolean) ?? [];
      const careerYearRange = years.length
        ? [Math.min(...years), Math.max(...years)]
        : null;
      // Bug 6: playoffs mode has no peak window — never include peakSeasons in playoffs response.
      const includePeakSeasons = mode === 'peak' && cached.data.peakSeasons;
      return res.json({
        playerId,
        playerName:  cached.data.playerName  ?? inputs.player.name,
        mode,
        ...(includePeakSeasons ? { peakSeasons: cached.data.peakSeasons } : {}),
        ...(careerYearRange ? { careerYearRange } : {}),
        categories:  cached.data.categories,
        overall:     cached.data.overall,
        volume:      cached.data.volume,
        generatedAt: cached.generatedAt instanceof Date
          ? cached.generatedAt.toISOString()
          : cached.generatedAt,
        sourceHash:  cached.sourceHash,
      });
    }
  } else if (!db) {
    console.warn(`[graded-report] MongoDB unavailable — calling Claude directly for playerId=${playerId} mode=${mode}`);
  }

  // Cache miss (or no Mongo / forced refresh) — call Claude
  let reportData;
  try {
    reportData = await gradedReportClient.callClaude({ inputs, mode, sourceHash });
  } catch (err) {
    console.error(`[graded-report] Claude error playerId=${playerId} mode=${mode}:`, err.message);
    return res.status(502).json({ error: 'upstream error generating graded report' });
  }

  const generatedAt = new Date();

  // Persist — fire-and-forget with hash key so corrections create a new doc
  if (db) {
    const doc = {
      _id:           docId,
      playerId,
      mode,
      data:          { playerName: inputs.player.name, ...reportData },
      sourceHash,
      generatedAt,
      promptVersion: gradedReportClient.PROMPT_VERSION,
    };
    db.collection('playerGradedReports')
      .replaceOne({ _id: docId }, doc, { upsert: true })
      .catch(err => console.error(`[graded-report] mongo write failed _id=${docId}:`, err.message));
  }

  const years = inputs.seasonRows?.map(r => Number(r.year)).filter(Boolean) ?? [];
  const careerYearRange = years.length
    ? [Math.min(...years), Math.max(...years)]
    : null;

  // Bug 6: playoffs mode has no peak window concept — never include peakSeasons in playoffs response.
  const includePeakSeasons = mode === 'peak' && reportData.peakSeasons;

  return res.json({
    playerId,
    playerName: inputs.player.name,
    mode,
    ...(includePeakSeasons ? { peakSeasons: reportData.peakSeasons } : {}),
    ...(careerYearRange ? { careerYearRange } : {}),
    categories:  reportData.categories,
    overall:     reportData.overall,
    volume:      reportData.volume,
    generatedAt: generatedAt.toISOString(),
    sourceHash,
  });
});

router.get('/teams/:id/narrative', async (req, res) => {
  if (!narrativeClient.enabled) {
    return res.status(503).json({ error: 'narrative service unavailable' });
  }

  const rawId  = req.params.id;
  const teamId = rawId; // used as MongoDB _id and in log messages for both active and legacy teams

  let team, history;

  try {
    if (typeof rawId === 'string' && rawId.startsWith('legacy-')) {
      // Defunct franchise — resolve via LEGACY_DEFUNCT_TEAMS, build history by ESPN name-match.
      const tricode = tricodeForDefunctId(rawId);
      if (!tricode) return res.status(404).json({ error: 'team not found' });
      const defunct = LEGACY_DEFUNCT_TEAMS[tricode];
      team    = { id: defunct.id, name: defunct.name };
      history = await buildLegacyHistory(defunct);
    } else {
      if (!/^\d+$/.test(rawId)) {
        return res.status(400).json({ error: 'team id must be a numeric string' });
      }
      const allTeams = await getTeams();
      team = allTeams.find(t => String(t.id) === rawId);
      if (!team) return res.status(404).json({ error: 'team not found' });
      history = await buildHistory(team);
    }
  } catch (err) {
    console.error(`teams/${rawId}/narrative (team/history resolve):`, err.message);
    return res.status(502).json({ error: 'upstream error generating narrative' });
  }

  try {

    // Deterministic source hash over the data Claude will receive.
    // Includes teamName and current-record fields so a mid-season record update (wins/losses/seed
    // on seasons[0]) invalidates the cache — the currentCtx line in the prompt depends on these.
    // buildHistory() is itself MongoDB cache-aside via teamHistories collection — calling it before
    // the narrative cache lookup costs one DB roundtrip on warm hits, not a full ESPN walk. The
    // narrative cache is layered on top of the history cache.
    const hashInput = JSON.stringify({
      promptVersion: narrativeClient.PROMPT_VERSION,
      teamName:      team.name,
      championships: [...(history.championships ?? [])].sort((a, b) => a - b),
      currentRecord: {
        wins:   history.seasons[0]?.wins   ?? null,
        losses: history.seasons[0]?.losses ?? null,
        seed:   history.seasons[0]?.seed   ?? null,
      },
      seasons: [...(history.seasons ?? [])]
        .sort((a, b) => a.year - b.year)
        .map(s => ({
          year:          s.year,
          wins:          s.wins,
          losses:        s.losses,
          seed:          s.seed,
          playoffResult: s.playoffResult,
          champion:      s.champion,
        })),
    });
    const sourceHash = crypto.createHash('sha1').update(hashInput).digest('hex');

    const db = getDb();

    // Dev path: no MongoDB — skip cache lookup and call Claude directly.
    // In production this would cause repeated Claude calls; document as acceptable dev-only behaviour.
    if (!db) {
      console.warn(`[narrative] MongoDB unavailable — calling Claude directly for teamId=${teamId}`);
      const data = await narrativeClient.getNarrative({ team, history });
      return res.json({ data, generatedAt: new Date().toISOString(), sourceHash });
    }

    const coll = db.collection('teamNarratives');

    // Admin-gated manual refresh: ?refresh=1 + x-admin-token header must match ADMIN_TOKEN env var.
    // If ADMIN_TOKEN is unset, the trigger is unavailable — fail-closed default.
    //
    // Timing-safe comparison is required here: a naive === leaks timing info that lets an attacker
    // infer token length and content byte-by-byte, which would expose a cache-flush vector that
    // also triggers a paid Claude call on each successful guess.
    const adminToken   = process.env.ADMIN_TOKEN;
    const headerToken  = req.headers['x-admin-token'];
    let forceRefresh   = false;
    if (req.query.refresh === '1' && adminToken && headerToken) {
      // Different lengths → reject immediately (timingSafeEqual requires equal-length buffers).
      const aBuf = Buffer.from(adminToken,  'utf8');
      const bBuf = Buffer.from(headerToken, 'utf8');
      if (aBuf.length === bBuf.length) {
        forceRefresh = crypto.timingSafeEqual(aBuf, bBuf);
      }
    }

    if (!forceRefresh) {
      let cached;
      try {
        cached = await coll.findOne({ _id: teamId });
      } catch (err) {
        console.error(`[narrative] mongo read failed teamId=${teamId}:`, err.message);
        cached = null;
      }
      if (cached && cached.sourceHash === sourceHash) {
        return res.json({
          data:        cached.data,
          generatedAt: cached.generatedAt instanceof Date
            ? cached.generatedAt.toISOString()
            : cached.generatedAt,
          sourceHash:  cached.sourceHash,
        });
      }
    }

    // Cache miss or forced refresh — call Claude.
    const data        = await narrativeClient.getNarrative({ team, history });
    const generatedAt = new Date();

    try {
      // If write fails after Claude succeeds, the next request will re-bill Claude.
      // Acceptable risk at 12 teams + ~yearly regen frequency.
      await coll.replaceOne(
        { _id: teamId },
        { _id: teamId, data, generatedAt, sourceHash },
        { upsert: true },
      );
    } catch (err) {
      console.error(`[narrative] mongo write failed teamId=${teamId}:`, err.message);
    }

    return res.json({ data, generatedAt: generatedAt.toISOString(), sourceHash });
  } catch (err) {
    console.error(`teams/${rawId}/narrative:`, err.message);
    res.status(502).json({ error: 'upstream error generating narrative' });
  }
});

router.get('/status', (req, res) => {
  const activePlayers = getProvider().getActivePlayers();
  res.json({
    status: 'ok',
    app: 'KnowTheW',
    teamsLoaded: true,
    rostersCached: new Set(activePlayers.map(p => p.teamId)).size,
    playersCached: activePlayers.length,
  });
});

module.exports = router;
