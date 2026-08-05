// routes/players.js — player-scoped endpoints (profile, stats, splits, PBP analysis,
// archetype/similarity, graded reports) split out of the former monolithic
// routes/api.js. See routes/api.js for the aggregator that mounts this alongside
// teams.js and meta.js.
const express = require('express');
const router  = express.Router();

const { getDb }                                                          = require('../db');
const { WNBA_LG }                                                        = require('../constants/leagueAverages');
const gradedReportClient                                                 = require('../lib/gradedReportClient');
const { buildInputs: buildReportInputs }                                 = require('../lib/gradedReportInputs');
const { parseESPNSeasonData, extractTeamIdByYear, buildDetailedStats }   = require('../lib/statsParser');
const { ADV_HEADERS_SRV, buildAdvancedSplit, buildAdvancedCareer,
        computeSeasonPBP, buildPbpSplit }                                = require('../lib/advancedStats');
const { columnsFor, toColumnTable }                                      = require('../lib/statColumns');
const { getPlayerPercentiles, loadFingerprintIndex }                     = require('../lib/percentileClient');
const { getPlayerFingerprint, AXES, buildDimensions }                    = require('../lib/analysis/playerFingerprint');
const { assignArchetype, buildDescriptor }                               = require('../lib/analysis/archetypes');
const { rankSimilar }                                                    = require('../lib/analysis/similarity');
const { computeSeasonOnOff }                                             = require('../lib/onOffClient');
const { computeSeasonPbpStats }                                          = require('../lib/pbpStatsClient');
const { computePbpTableRow, computeCareerRow, PBP_TABLE_HEADERS }        = require('../lib/analysis/pbpTable');
const { buildSplits }                                                    = require('../lib/gameSplits');
const { isBulkLegacyId, getBulkLegacyPlayer, resolveLegacyId,
        buildBulkLegacyProfile, buildBulkLegacyDetailedStats }           = require('../constants/legacyPlayerBulk');
const { getProvider }                                                    = require('../providers');

const { authorizeAdminRefresh } = require('../lib/adminAuth');
const { sha1Json }              = require('../lib/deterministicHash');

const getTeams        = (...a) => getProvider().getTeams(...a);
const fetchTeamStats  = (...a) => getProvider().getTeamStats(...a);

async function fetchPlayerSeasonData(playerId) {
  const [teams, { regData, postData }] = await Promise.all([
    getTeams(),
    getProvider().getPlayerSeasonStats(playerId),
  ]);
  return { teams, regData, postData, teamsById: Object.fromEntries(teams.map(t => [t.id, t])) };
}

// Valid modes for the graded-report route. Module-level so the Set isn't rebuilt per request.
const VALID_REPORT_MODES = new Set(['career', 'peak', 'playoffs']);

// Valid split types for the /players/:id/splits route. Module-level so the array isn't rebuilt
// per request (same reasoning as VALID_REPORT_MODES above).
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
    if (db) {
      const advCached = await db.collection('advancedStats').findOne({ _id: req.params.id });
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
      .replaceOne({ _id: req.params.id }, { _id: req.params.id, gp: currentGP, v: 26, data: advResult }, { upsert: true })
      .catch(err => console.error('mongo write advancedStats:', err.message));
    res.json(advResult);
  } catch (err) {
    console.error('advanced-pbp-all:', err.message);
    res.status(502).json({ error: 'failed to compute advanced stats' });
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
  let mode;
  if (modeRaw === undefined || modeRaw === '') {
    mode = 'career';
  } else if (VALID_REPORT_MODES.has(modeRaw)) {
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

  // Career year range from inputs.seasonRows — same for both the cache-hit and freshly-generated
  // response below, so it's computed once here rather than twice.
  const reportYears = inputs.seasonRows?.map(r => Number(r.year)).filter(Boolean) ?? [];
  const careerYearRange = reportYears.length
    ? [Math.min(...reportYears), Math.max(...reportYears)]
    : null;

  // Deterministic source hash over all data Claude will receive.
  // Sorted ascending by year so insertion order doesn't matter.
  // seasonsPlayed is now included so that a change in the player's GP-filtered year set
  // (e.g. ESPN adds or removes a 0-GP row) correctly invalidates the cache.
  const sourceHash = sha1Json({
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
  const docId = `${playerId}-${mode}-${sourceHash.slice(0, 8)}`;

  const db = getDb();

  // Admin-gated manual refresh — see authorizeAdminRefresh (shared with the narrative route).
  const forceRefresh = authorizeAdminRefresh(req);

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
        accolades:   inputs.accolades ?? {},
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
    accolades:   inputs.accolades ?? {},
    generatedAt: generatedAt.toISOString(),
    sourceHash,
  });
});

module.exports = router;
