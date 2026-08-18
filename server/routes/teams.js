// routes/teams.js — team-scoped endpoints (roster, season-info, stats, history,
// schedule) split out of the former monolithic routes/api.js. The AI-generated
// narrative endpoint moved to routes/reports.js (grouped with the other AI-generated,
// cached-content route rather than staying here just because it's team-scoped). See
// routes/api.js for the aggregator that mounts this alongside players.js,
// playerAnalysis.js, reports.js, and meta.js.
const express = require('express');
const router  = express.Router();

const { WNBA_FOUNDED }                                                   = require('../constants/wnbaFounded');
const { buildHistory, buildLegacyHistory }                               = require('../lib/historyAggregator');
const { buildSeasonInfo }                                                = require('../lib/seasonInfo');
const { readOrFetch }                                                    = require('../lib/teamSeasonCache');
const { LEGACY_DEFUNCT_TEAMS, getLegacyRoster, tricodeForEspnId,
        tricodeForDefunctId }                                            = require('../constants/legacyTeamRosters');
const { getProvider }                                                    = require('../providers');

const { requireNumericId }          = require('../lib/routeValidation');
const { findTeam }                  = require('../lib/teamLookup');
const { parseSeasonQuery }          = require('../lib/seasonQuery');
const { buildLegacyRosterResponse } = require('../lib/legacyRoster');
const { attachArchetypeNames }      = require('../lib/analysis/archetypeAttach');

// Data-source access goes through the active provider (see server/providers). These thin locals
// keep the call sites below unchanged while removing the direct espnClient import; each resolves
// the provider lazily per call so STATS_PROVIDER / test overrides take effect.
const getRoster               = (...a) => getProvider().getRoster(...a);
const fetchSeasonRoster       = (...a) => getProvider().getSeasonRoster(...a);
const fetchTeamStats          = (...a) => getProvider().getTeamStats(...a);
const fetchTeamStatsRaw       = (...a) => getProvider().getTeamStatsRaw(...a);
const fetchTeamPtsAllowed     = (...a) => getProvider().getTeamPointsAllowed(...a);
const fetchTeamPtsAllowedRaw  = (...a) => getProvider().getTeamPointsAllowedRaw(...a);
const fetchTeamSchedule       = (...a) => getProvider().getTeamSchedule(...a);

router.get('/teams', async (req, res) => {
  try {
    res.json(await getProvider().getTeams());
  } catch (err) {
    console.error('teams:', err.message);
    res.status(502).json({ error: 'failed to load teams' });
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

router.get('/teams/:id/roster', async (req, res) => {
  const rawId = req.params.id;

  const sp = parseSeasonQuery(req);
  if (sp.error) return res.status(400).json({ error: sp.error });
  const { season, currentYear } = sp;

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
    const team = await findTeam(teamId);
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

    players = await attachArchetypeNames(players);
    res.json({ team, players, season });
  } catch (err) {
    console.error(`teams/${teamId}/roster season=${season}:`, err.message);
    res.status(502).json({ error: 'failed to load roster' });
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
router.get('/teams/:id/season-info', requireNumericId('id'), async (req, res) => {
  const teamId = req.params.id;

  const sp = parseSeasonQuery(req);
  if (sp.error) return res.status(400).json({ error: sp.error });
  const { season, currentYear } = sp;

  const foundedYear = WNBA_FOUNDED[teamId] ?? 1997;
  if (season > currentYear || season < foundedYear) {
    return res.status(400).json({ error: 'invalid season' });
  }

  try {
    const team = await findTeam(teamId);
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

router.get('/teams/:id/stats', requireNumericId('id'), async (req, res) => {
  const teamId = req.params.id;

  const sp = parseSeasonQuery(req);
  if (sp.error) return res.status(400).json({ error: sp.error });
  const { season, currentYear } = sp;

  try {
    if (season === currentYear) {
      // Current season: use in-process caches (mutable mid-season). Same path as before.
      // the ESPN provider's client wraps each in withCache internally.
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
    // Cache key is provider-scoped so toggling STATS_PROVIDER can't read back the other source's
    // cached payload for the same team/season (ESPN and BallDontLie both cover season 2008+, and
    // their numbers legitimately differ).
    const cacheKey = `${getProvider().name}-${teamId}-${season}`;
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
    const team = await findTeam(teamId);
    if (!team) return res.status(404).json({ error: 'team not found' });

    const result = await buildHistory(team);
    res.json(result);
  } catch (err) {
    console.error(`teams/${teamId}/history:`, err.message);
    res.status(502).json({ error: 'upstream error building team history' });
  }
});

router.get('/teams/:id/schedule', requireNumericId('id'), async (req, res) => {
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
    const team = await findTeam(teamId);
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
    // Cache key includes seasontype to prevent regular/playoff collision, and is provider-scoped
    // (same convention as the team-stats cache above) so toggling STATS_PROVIDER can't read back
    // a stale ESPN-cached regular-season schedule after the BDL migration -- ESPN and BallDontLie
    // both cover season 2008+ and their numbers legitimately differ.
    const cacheKey = `${getProvider().name}-${teamId}-${season}-${seasontype}`;
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

module.exports = router;
