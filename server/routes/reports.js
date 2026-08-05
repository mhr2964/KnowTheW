// routes/reports.js — the two AI-generated, MongoDB-cached content endpoints:
// player graded-report and team narrative. Grouped together (rather than living
// under players.js/teams.js) because they share one theme — Claude-generated content
// cached behind a deterministic source hash with an admin-gated manual-refresh escape
// hatch — even though they sit under different resource paths (/players vs /teams).
// Their caching *strategies* still differ deliberately (see comments below) and are
// NOT forced into one shared abstraction; only the hashing and admin-gate helpers are
// shared (lib/deterministicHash.js, lib/adminAuth.js). See routes/api.js for the
// aggregator that mounts this alongside teams.js, players.js, playerAnalysis.js, and
// meta.js.
const express = require('express');
const router  = express.Router();

const { getDb }              = require('../db');
const gradedReportClient     = require('../lib/gradedReportClient');
const { buildInputs: buildReportInputs } = require('../lib/gradedReportInputs');
const narrativeClient        = require('../lib/narrativeClient');
const { buildHistory, buildLegacyHistory } = require('../lib/historyAggregator');
const { LEGACY_DEFUNCT_TEAMS, tricodeForDefunctId } = require('../constants/legacyTeamRosters');
const { isBulkLegacyId, resolveLegacyId } = require('../constants/legacyPlayerBulk');

const { authorizeAdminRefresh } = require('../lib/adminAuth');
const { sha1Json }              = require('../lib/deterministicHash');
const { findTeam }              = require('../lib/teamLookup');

// Valid modes for the graded-report route. Module-level so the Set isn't rebuilt per request.
const VALID_REPORT_MODES = new Set(['career', 'peak', 'playoffs']);

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
      team = await findTeam(rawId);
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
    const sourceHash = sha1Json({
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

    const db = getDb();

    // Dev path: no MongoDB — skip cache lookup and call Claude directly.
    // In production this would cause repeated Claude calls; document as acceptable dev-only behaviour.
    if (!db) {
      console.warn(`[narrative] MongoDB unavailable — calling Claude directly for teamId=${teamId}`);
      const data = await narrativeClient.getNarrative({ team, history });
      return res.json({ data, generatedAt: new Date().toISOString(), sourceHash });
    }

    const coll = db.collection('teamNarratives');

    // Admin-gated manual refresh — see authorizeAdminRefresh (shared with the graded-report route).
    const forceRefresh = authorizeAdminRefresh(req);

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

module.exports = router;
