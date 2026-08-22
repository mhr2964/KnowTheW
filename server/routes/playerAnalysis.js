// routes/playerAnalysis.js — computed-insight endpoints for a player (PBP-derived
// on/off and shooting splits, archetype classification, cross-era similarity), split
// out of the former monolithic routes/players.js so "serve the raw/derived stat rows"
// (players.js) stays separate from "compute a derived insight" (this file). See
// routes/api.js for the aggregator that mounts this alongside teams.js, players.js,
// reports.js, and meta.js.
const express = require('express');
const router  = express.Router();

const { buildSeasonTables }                                              = require('../lib/statsParser');
const { computeAdvancedPbpAll, computeSeasonAdvancedRow }                = require('../lib/advancedStats');
const { loadFingerprintIndex }                                           = require('../lib/percentileClient');
const { getPlayerFingerprint, AXES, buildDimensions }                    = require('../lib/analysis/playerFingerprint');
const { assignArchetype, buildDescriptor }                               = require('../lib/analysis/archetypes');
const { rankSimilar }                                                    = require('../lib/analysis/similarity');
const { computeSeasonOnOff }                                             = require('../lib/onOffClient');
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

// Bounds a per-season provider fan-out to well under Heroku's 30s router (H12) timeout. Confirmed
// live (2026-08-20 measurement session): specific player-seasons can stall the full 30.0-30.1s with
// zero completed requests (a socket-level failure, not a slow-but-successful response) and get
// silently dropped by the client's error handling -- the season just vanishes from the tab with no
// error shown. Racing against this timeout can't make the underlying provider calls finish faster,
// but it guarantees the client gets a fast, explicit "this season timed out" instead of eating the
// full 30s dead-air stall and then getting cut off by Heroku's router with no response at all. The
// in-flight provider calls aren't cancelled (no AbortController threaded through the provider
// stack) -- they keep running server-side and populate the season cache on completion, so a retry
// shortly after often hits a warm cache even though this request gave up on waiting.
const SEASON_TIMEOUT_MS = 20000;
class SeasonTimeoutError extends Error {}
function withSeasonTimeout(promise) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new SeasonTimeoutError('season computation timed out')), SEASON_TIMEOUT_MS);
    promise.then(
      v => { clearTimeout(timer); resolve(v); },
      e => { clearTimeout(timer); reject(e); },
    );
  });
}

// Shared by both routes below: one season's PBP table row, live-fetching that season's games
// from the provider. `seasontype` (2=regular, 3=playoffs) is threaded straight through to
// getRegularSeasonEventIds, same dispatch convention advancedStats.js's computeSeasonAdvancedRow
// already uses -- the method name predates the playoffs use and stays a bare event-id lookup for
// whichever seasontype is asked for. Per-GAME raw fetches are cached (past seasons only, see
// gamePbpCache.js) inside getGamePbpStats itself, the same primitive getSeasonPBPSummary/Advanced
// uses -- a season warmed by anyone opening either tab benefits both, and players sharing a game
// only pay the real fetch cost once between them.
async function computeSeasonPbpRow(playerId, pgTable, I, season, seasontype = 2) {
  const playerRow = pgTable.rows.find(r => String(r[I.SEASON_ID]) === season);
  if (!playerRow) return null;

  const provider = getProvider();
  const eventIds = await provider.getRegularSeasonEventIds(playerId, season, seasontype);
  if (!eventIds?.length) return null;

  const pbpResults = await Promise.all(eventIds.map(id => provider.getGamePbpStats(id, playerId, season)));
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

// Loads both the regular-season and playoff per-game tables -- mirrors advancedStats.js's
// loadAdvPgTables (pgPostTable/IPost naming) so the two PBP-family routes below can pick whichever
// side seasontype asks for the same way computeSeasonAdvancedRow does.
async function loadPgTable(playerId) {
  const { regSeasons, postSeasons, teamsById } = await fetchPlayerSeasonData(playerId);
  const regParsed  = buildSeasonTables(regSeasons,  teamsById);
  const postParsed = buildSeasonTables(postSeasons, teamsById);
  const pgTable = regParsed?.pg?.table;
  if (!pgTable) return null;
  const I = Object.fromEntries(pgTable.headers.map((h, i) => [h, i]));
  const pgPostTable = postParsed?.pg?.table;
  const IPost = pgPostTable ? Object.fromEntries(pgPostTable.headers.map((h, i) => [h, i])) : I;
  return { pgTable, I, pgPostTable, IPost };
}

// Single-season PBP row: the fast path the client hits first so the current season can render
// before the full multi-season table (below) finishes loading every prior season's games.
router.get('/players/:id/pbp-table/season/:season', async (req, res) => {
  try {
    const playerId = String(req.params.id);
    const season = String(req.params.season);
    const seasontype = req.query.seasontype === '3' ? 3 : 2;
    const loaded = await loadPgTable(playerId);
    if (!loaded) return res.status(404).json({ error: 'no stats for this player' });
    const table = seasontype === 3 ? loaded.pgPostTable : loaded.pgTable;
    const I     = seasontype === 3 ? loaded.IPost      : loaded.I;
    if (!table) return res.status(404).json({ error: 'no play-by-play data for this season' });
    const row = await withSeasonTimeout(computeSeasonPbpRow(playerId, table, I, season, seasontype));
    if (!row) return res.status(404).json({ error: 'no play-by-play data for this season' });
    res.json({ headers: PBP_TABLE_HEADERS, row });
  } catch (err) {
    if (err instanceof SeasonTimeoutError) {
      console.warn(`pbp-table/season: season ${req.params.season} exceeded ${SEASON_TIMEOUT_MS}ms budget`);
      return res.status(504).json({ error: 'season computation timed out', timeout: true });
    }
    console.error('pbp-table/season:', err.message);
    res.status(502).json({ error: 'failed to compute pbp row' });
  }
});

// Career-row aggregation only -- pure math over rows the client already fetched one season at a
// time via /pbp-table/season/:season above. No provider calls here, so no rate-limit exposure;
// this is what replaced the old "all regular seasons in one response" /pbp-table route, which for
// a long career could need 800+ live BallDontLie requests in a single request -- structurally
// unable to finish inside Heroku's 30s router timeout (confirmed live, 2026-08-19). Splitting the
// data-fetch into N small per-season requests (each well under the ~500 req/min BDL ceiling on its
// own) and doing this last aggregation step in-process is what makes a long career loadable at all.
router.post('/players/:id/pbp-table/career-row', (req, res) => {
  const rows = req.body?.rows;
  if (!Array.isArray(rows)) return res.status(400).json({ error: 'rows must be an array' });
  res.json({ careerRow: computeCareerRow(rows) });
});

router.get('/players/:id/advanced-pbp-all/season/:season', async (req, res) => {
  try {
    const playerId = String(req.params.id);
    const season = String(req.params.season);
    const seasontype = req.query.seasontype === '3' ? 3 : 2;
    const result = await withSeasonTimeout(computeSeasonAdvancedRow(playerId, season, seasontype));
    if (!result) return res.status(404).json({ error: 'no advanced stats for this season' });
    res.json(result);
  } catch (err) {
    if (err instanceof SeasonTimeoutError) {
      console.warn(`advanced-pbp-all/season: season ${req.params.season} exceeded ${SEASON_TIMEOUT_MS}ms budget`);
      return res.status(504).json({ error: 'season computation timed out', timeout: true });
    }
    console.error('advanced-pbp-all/season:', err.message);
    res.status(502).json({ error: 'failed to compute advanced stats row' });
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
