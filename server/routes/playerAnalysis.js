// routes/playerAnalysis.js — computed-insight endpoints for a player (PBP-derived
// on/off and shooting splits, archetype classification, cross-era similarity), split
// out of the former monolithic routes/players.js so "serve the raw/derived stat rows"
// (players.js) stays separate from "compute a derived insight" (this file). See
// routes/api.js for the aggregator that mounts this alongside teams.js, players.js,
// reports.js, and meta.js.
const express = require('express');
const router  = express.Router();

const { buildSeasonTables }                                              = require('../lib/statsParser');
const { computeAdvancedPbpAll }                                          = require('../lib/advancedStats');
const { loadFingerprintIndex }                                           = require('../lib/percentileClient');
const { getPlayerFingerprint, AXES, buildDimensions }                    = require('../lib/analysis/playerFingerprint');
const { assignArchetype, buildDescriptor }                               = require('../lib/analysis/archetypes');
const { rankSimilar }                                                    = require('../lib/analysis/similarity');
const { computeSeasonOnOff }                                             = require('../lib/onOffClient');
const { computeSeasonPbpStats }                                          = require('../lib/pbpStatsClient');
const { computePbpTableRow, computeCareerRow, PBP_TABLE_HEADERS }        = require('../lib/analysis/pbpTable');
const { getProvider }                                                    = require('../providers');
const { fetchPlayerSeasonData }                                         = require('../lib/playerSeasonData');

// On/Off-Court Impact: team net rating (per 100 possessions) while the player is on vs off court.
// PBP-derived; regular season only. Returns null result when < MIN_ON_GAMES games have usable PBP.
router.get('/players/:id/onoff', async (req, res) => {
  try {
    const playerId = String(req.params.id);
    const season   = Number(req.query.season) || new Date().getFullYear();
    const result   = await computeSeasonOnOff(playerId, season);
    res.json({ result: result ?? null, season });
  } catch (err) {
    console.error('onoff:', err.message);
    res.status(502).json({ error: 'failed to compute on/off stats' });
  }
});

// Full Play-by-Play section: shooting splits + on/off net ratings, both from the same PBP pass.
// Returns { result: { onoff, shooting } | null, season }.
router.get('/players/:id/pbp-stats', async (req, res) => {
  try {
    const playerId = String(req.params.id);
    const season   = Number(req.query.season) || new Date().getFullYear();
    const result   = await computeSeasonPbpStats(playerId, season);
    res.json({ result: result ?? null, season });
  } catch (err) {
    console.error('pbp-stats:', err.message);
    res.status(502).json({ error: 'failed to compute play-by-play stats' });
  }
});

// Shared by both routes below: one season's PBP table row, live-fetching that season's games
// from the provider (uncached at the HTTP layer -- see espn/client.js fetchGameSummary). This is
// the expensive part; isolating it to one season is what makes the /season/:season route fast.
async function computeSeasonPbpRow(playerId, pgTable, I, season) {
  const playerRow = pgTable.rows.find(r => String(r[I.SEASON_ID]) === season);
  if (!playerRow) return null;

  const eventIds = await getProvider().getRegularSeasonEventIds(playerId, season, 2);
  if (!eventIds?.length) return null;

  const pbpResults = await Promise.all(eventIds.map(id => getProvider().getGamePbpStats(id, playerId)));
  const gp      = playerRow[I.GP]  ?? 0;
  const minPg   = playerRow[I.MIN] ?? 0;
  const minutes = Math.round(minPg * gp);
  const meta = {
    season,
    team:    playerRow[I.TEAM_ABBREVIATION] ?? null,
    age:     playerRow[I.AGE]  ?? null,
    gp,
    minutes,
  };
  return computePbpTableRow(pbpResults, meta);
}

async function loadPgTable(playerId) {
  const { regSeasons, teamsById } = await fetchPlayerSeasonData(playerId);
  const regParsed = buildSeasonTables(regSeasons, teamsById);
  const pgTable = regParsed?.pg?.table;
  if (!pgTable) return null;
  const I = Object.fromEntries(pgTable.headers.map((h, i) => [h, i]));
  return { pgTable, I };
}

// Single-season PBP row: the fast path the client hits first so the current season can render
// before the full multi-season table (below) finishes loading every prior season's games.
router.get('/players/:id/pbp-table/season/:season', async (req, res) => {
  try {
    const playerId = String(req.params.id);
    const season = String(req.params.season);
    const loaded = await loadPgTable(playerId);
    if (!loaded) return res.status(404).json({ error: 'no stats for this player' });
    const row = await computeSeasonPbpRow(playerId, loaded.pgTable, loaded.I, season);
    if (!row) return res.status(404).json({ error: 'no play-by-play data for this season' });
    res.json({ headers: PBP_TABLE_HEADERS, row });
  } catch (err) {
    console.error('pbp-table/season:', err.message);
    res.status(502).json({ error: 'failed to compute pbp row' });
  }
});

// BBRef-style PBP season table: all regular seasons in one response.
// Columns: OnCourt/On-Off per 100 poss, TOV subtypes, foul types, PGA, And1, Blkd.
router.get('/players/:id/pbp-table', async (req, res) => {
  try {
    const playerId = String(req.params.id);
    const loaded = await loadPgTable(playerId);
    if (!loaded) return res.status(404).json({ error: 'no stats for this player' });
    const { pgTable, I } = loaded;

    const seasons = [...new Set(pgTable.rows.map(r => String(r[I.SEASON_ID])))];
    const rows = (await Promise.all(
      seasons.map(season => computeSeasonPbpRow(playerId, pgTable, I, season))
    )).filter(Boolean);

    const careerRow = computeCareerRow(rows);
    res.json({ headers: PBP_TABLE_HEADERS, regular: { rows, careerRow } });
  } catch (err) {
    console.error('pbp-table:', err.message);
    res.status(502).json({ error: 'failed to compute pbp table' });
  }
});

router.get('/players/:id/advanced-pbp-all', async (req, res) => {
  try {
    const advResult = await computeAdvancedPbpAll(req.params.id);
    if (!advResult) return res.status(404).json({ error: 'no stats for this player' });
    res.json(advResult);
  } catch (err) {
    console.error('advanced-pbp-all:', err.message);
    res.status(502).json({ error: 'failed to compute advanced stats' });
  }
});

// GET /api/players/:id/archetype
//
// Player Archetype Badge: the nearest prototype (or the Versatile/Role-Player/none fallback) plus
// the player's OWN 13-axis fingerprint, so the hover card can show why the label was assigned.
// Always 200 when reachable — a player with too thin a sample returns { archetype: null, reason }
// (the client shows no badge) rather than a 404, since the player record itself may well exist.
router.get('/players/:id/archetype', async (req, res) => {
  try {
    const fingerprint = await getPlayerFingerprint(req.params.id);
    // Compute the play dimensions once (position-aware for the Defense spoke); they drive the
    // archetype fallback, the descriptor, AND the radar — one source of truth so the label can't
    // contradict the sentence. Axes feed the 13-bar detail (server owns presentation).
    const dimensions = fingerprint.axes
      ? buildDimensions(fingerprint.axes, fingerprint.advanced, fingerprint.pos)
      : null;
    const assignment = assignArchetype(fingerprint, dimensions);
    const descriptor = dimensions ? buildDescriptor(dimensions, assignment, fingerprint.pos) : null;
    const axes = fingerprint.axes
      ? AXES.map(a => ({ key: a.key, label: a.label, value: fingerprint.axes[a.key] }))
      : null;
    res.json({
      ...assignment,
      pos: fingerprint.pos ?? null,
      descriptor,
      dimensions,
      axes,
      seasonsCovered: fingerprint.seasonsCovered ?? 0,
      totalMinutes: fingerprint.totalMinutes ?? 0,
    });
  } catch (err) {
    console.error('archetype:', err.message);
    res.status(502).json({ error: 'failed to compute archetype' });
  }
});

// GET /api/players/:id/similar
//
// Cross-Era Similarity ("players like X"): the most alike players by era-normalized fingerprint
// distance, gated to adjacent positions because the axes are position-pooled (see similarity.js).
// Candidates come from the precomputed fingerprint cache (loadFingerprintIndex) so this is one Mongo
// read plus pure math, not ~700 live ESPN calls.
//
// The TARGET is also read from the cache when present, NOT recomputed live: a live fingerprint is
// currently non-deterministic (a distribution-build race jitters the percentiles between calls), so a
// live target would (a) make "players like X" change between page loads and (b) be compared on a
// different snapshot than the cached candidates. Using the cached target keeps the target and the pool
// on one consistent, stable basis. Live compute is the fallback only for a player not yet in the cache.
// Always 200 when reachable — a too-thin target returns { target: { insufficient }, similar: [] }.
router.get('/players/:id/similar', async (req, res) => {
  try {
    const id = String(req.params.id);
    const candidates = await loadFingerprintIndex();
    let target = candidates.find(c => String(c.id) === id); // cached fingerprintable docs only
    if (!target) {
      // Not in the cache (e.g. a brand-new player) — compute live as a fallback. Must use the same
      // 'all' (league-wide) pool the cache is built with, or the target wouldn't be comparable.
      const live = await getPlayerFingerprint(id, { pool: 'all' });
      if (live.insufficient || !live.axes) {
        return res.json({ target: { id, insufficient: true, reason: live.reason ?? 'no-data' }, similar: [] });
      }
      // The archetype label is position-pooled (matches the player's badge) — compute it from a
      // position-pooled fingerprint, not the league-wide similarity axes.
      const fpPos = await getPlayerFingerprint(id, { pool: 'position' });
      const archetype = (!fpPos.insufficient && fpPos.axes)
        ? assignArchetype(fpPos, buildDimensions(fpPos.axes, fpPos.advanced, fpPos.pos))?.archetype?.name ?? null
        : null;
      target = { id, headshot: null, pos: live.pos || null, axes: live.axes, advanced: live.advanced, stats: live.stats ?? null, archetype };
    }
    const similar = rankSimilar(target, candidates);
    res.json({
      target: {
        id,
        headshot: target.headshot ?? null,
        pos: target.pos ?? null,
        archetype: target.archetype ?? null,
        stats: target.stats ?? null,
        // Same dimensions the radar overlay draws under each comparison, so target + candidate
        // shapes share one source of truth (buildDimensions).
        dimensions: buildDimensions(target.axes, target.advanced, target.pos),
      },
      similar,
    });
  } catch (err) {
    console.error('similar:', err.message);
    res.status(502).json({ error: 'failed to compute similar players' });
  }
});

module.exports = router;
