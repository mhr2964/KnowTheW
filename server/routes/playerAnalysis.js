// routes/playerAnalysis.js — computed-insight endpoints for a player (PBP-derived
// on/off and shooting splits, archetype classification, cross-era similarity), split
// out of the former monolithic routes/players.js so "serve the raw/derived stat rows"
// (players.js) stays separate from "compute a derived insight" (this file). See
// routes/api.js for the aggregator that mounts this alongside teams.js, players.js,
// reports.js, and meta.js.
const express = require('express');
const router  = express.Router();

const { getDb }                                                          = require('../db');
const { WNBA_LG }                                                        = require('../constants/leagueAverages');
const { parseESPNSeasonData, extractTeamIdByYear }                       = require('../lib/statsParser');
const { ADV_HEADERS_SRV, computeSeasonPBP, buildPbpSplit }               = require('../lib/advancedStats');
const { columnsFor }                                                     = require('../lib/statColumns');
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

// BBRef-style PBP season table: all regular seasons in one response.
// Columns: OnCourt/On-Off per 100 poss, TOV subtypes, foul types, PGA, And1, Blkd.
router.get('/players/:id/pbp-table', async (req, res) => {
  try {
    const playerId = String(req.params.id);
    const { regData, teamsById } = await fetchPlayerSeasonData(playerId);
    const regParsed = parseESPNSeasonData(regData, teamsById);
    const pgTable = regParsed?.pg?.table;
    if (!pgTable) return res.status(404).json({ error: 'no stats for this player' });
    const I = Object.fromEntries(pgTable.headers.map((h, i) => [h, i]));

    const seasons = [...new Set(pgTable.rows.map(r => String(r[I.SEASON_ID])))];

    const rows = (await Promise.all(seasons.map(async season => {
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
    }))).filter(Boolean);

    const careerRow = computeCareerRow(rows);
    res.json({ headers: PBP_TABLE_HEADERS, regular: { rows, careerRow } });
  } catch (err) {
    console.error('pbp-table:', err.message);
    res.status(502).json({ error: 'failed to compute pbp table' });
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
    // Provider-scoped _id so toggling STATS_PROVIDER can't read back the other source's cached
    // advanced-stats response for the same player.
    const advCacheId = `${getProvider().name}-${req.params.id}`;
    if (db) {
      const advCached = await db.collection('advancedStats').findOne({ _id: advCacheId });
      if (advCached?.gp === currentGP && advCached.v === 26 && advCached.data?.regular != null) return res.json(advCached.data);
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
      columns:  columnsFor(ADV_HEADERS_SRV),
      regular:  buildPbpSplit(validReg,  pgTable.rows,      I),
      playoffs: validPost.length ? buildPbpSplit(validPost, pgPostTable?.rows ?? [], IPost) : null,
      pbpGamesBySeason: Object.fromEntries([
        ...validReg.map(r => [r.season, r.pbpGames]),
        ...validPost.map(r => [`post-${r.season}`, r.pbpGames]),
      ]),
    };

    // v bumped 25->26: response shape changed from `headers` (bare strings) to `columns`
    // ({key,label,kind}) — force a rebuild of any Mongo-cached v25 documents.
    if (db) db.collection('advancedStats')
      .replaceOne({ _id: advCacheId }, { _id: advCacheId, gp: currentGP, v: 26, data: advResult }, { upsert: true })
      .catch(err => console.error('mongo write advancedStats:', err.message));
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
