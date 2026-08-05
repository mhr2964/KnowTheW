// routes/players.js — basic player profile and raw/derived stat-table endpoints
// (profile, detailed per-game/advanced stats, gamelog, splits, percentiles). Computed
// insights (PBP analysis, archetype, similarity) live in routes/playerAnalysis.js, and
// the AI-generated graded-report lives in routes/reports.js — split out once this file
// started covering three distinct concerns. See routes/api.js for the aggregator that
// mounts this alongside teams.js, playerAnalysis.js, reports.js, and meta.js.
const express = require('express');
const router  = express.Router();

const { extractTeamIdByYear, buildDetailedStats } = require('../lib/statsParser');
const { buildAdvancedSplit, buildAdvancedCareer } = require('../lib/advancedStats');
const { toColumnTable }        = require('../lib/statColumns');
const { getPlayerPercentiles } = require('../lib/percentileClient');
const { buildSplits }          = require('../lib/gameSplits');
const { isBulkLegacyId, getBulkLegacyPlayer, resolveLegacyId,
        buildBulkLegacyProfile, buildBulkLegacyDetailedStats }           = require('../constants/legacyPlayerBulk');
const { getProvider }          = require('../providers');
const { fetchPlayerSeasonData } = require('../lib/playerSeasonData');

const fetchTeamStats = (...a) => getProvider().getTeamStats(...a);

// Valid split types for the /players/:id/splits route. Module-level so the array isn't rebuilt
// per request.
const VALID_SPLIT_TYPES = new Set(['homeaway', 'month', 'opponent']);

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
  } catch (err) {
    console.error(`players/${req.params.id}:`, err.message);
    res.status(502).json({ error: 'failed to load player' });
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
      regular:       toColumnTable(buildAdvancedSplit(result.perGame.regular,       regTidByYear,  teamStatsByKey, result.totals.regular)),
      regularCareer: toColumnTable(buildAdvancedCareer(result.perGame.regularCareer, result.totals.regularCareer)),
      playoffs:      toColumnTable(buildAdvancedSplit(result.perGame.playoffs,      postTidByYear, teamStatsByKey, result.totals.playoffs)),
      playoffCareer: toColumnTable(buildAdvancedCareer(result.perGame.playoffCareer, result.totals.playoffCareer)),
    };

    res.json(result);
  } catch (err) {
    console.error('detailed-stats:', err.message);
    res.status(502).json({ error: 'failed to load detailed stats' });
  }
});

router.get('/players/:id/gamelog', async (req, res) => {
  try {
    const log = await getProvider().getPlayerGameLog(req.params.id, req.query.season);
    if (!log) return res.status(404).json({ error: 'no gamelog available' });
    res.json(log);
  } catch (err) {
    console.error('gamelog:', err.message);
    res.status(502).json({ error: 'failed to load gamelog' });
  }
});

// Home/Away, Monthly, and By-Opponent splits, derived from the same per-game gamelog data as
// /gamelog. No shot-location/zone data exists in ESPN's free endpoints, so a bref-style
// shooting-by-zone split isn't feasible here — see server/lib/gameSplits.js.
router.get('/players/:id/splits', async (req, res) => {
  try {
    const log = await getProvider().getPlayerGameLog(req.params.id, req.query.season);
    if (!log) return res.status(404).json({ error: 'no gamelog available' });
    const splitType = VALID_SPLIT_TYPES.has(req.query.type) ? req.query.type : 'homeaway';
    res.json(buildSplits(log, log.games, splitType) ?? { columns: [], rows: [] });
  } catch (err) {
    console.error('splits:', err.message);
    res.status(502).json({ error: 'failed to load splits' });
  }
});

router.get('/players/:id/percentiles', async (req, res) => {
  try {
    const result = await getPlayerPercentiles(req.params.id);
    if (!result) return res.status(404).json({ error: 'no stats found for this player' });
    res.json(result);
  } catch (err) {
    console.error('percentiles:', err.message);
    res.status(502).json({ error: 'failed to compute percentiles' });
  }
});

module.exports = router;
