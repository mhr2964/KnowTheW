const express = require('express');
const router  = express.Router();

const crypto                                                             = require('crypto');
const { getDb }                                                          = require('../db');
const { WNBA_LG }                                                        = require('../constants/leagueAverages');
const { ESPN_WEB, getTeams, getRoster, fetchTeamStats, fetchTeamPtsAllowed,
        fetchTeamSchedule,
        rosterData, playerById, teamSeasonStatsCache }                   = require('../lib/espnClient');
const { buildHistory }                                                   = require('../lib/historyAggregator');
const narrativeClient                                                    = require('../lib/narrativeClient');
const { parseESPNSeasonData, extractTeamIdByYear, buildDetailedStats }   = require('../lib/statsParser');
const { ADV_HEADERS_SRV, buildAdvancedSplit, buildAdvancedCareer,
        computeSeasonPBP, buildPbpSplit }                                = require('../lib/advancedStats');
const { getPlayerPercentiles }                                           = require('../lib/percentileClient');

async function fetchPlayerSeasonData(playerId) {
  const [teams, regData, postData] = await Promise.all([
    getTeams(),
    fetch(`${ESPN_WEB}/athletes/${playerId}/stats?seasontype=2`).then(r => r.ok ? r.json() : null),
    fetch(`${ESPN_WEB}/athletes/${playerId}/stats?seasontype=3`).then(r => r.ok ? r.json() : null),
  ]);
  return { teams, regData, postData, teamsById: Object.fromEntries(teams.map(t => [t.id, t])) };
}

router.get('/teams', async (req, res) => {
  try {
    res.json(await getTeams());
  } catch {
    res.status(500).json({ error: 'failed to load teams' });
  }
});

router.get('/teams/:id/roster', async (req, res) => {
  try {
    const allTeams = await getTeams();
    const team = allTeams.find(t => t.id === req.params.id);
    if (!team) return res.status(404).json({ error: 'team not found' });
    const players = await getRoster(team.id, team.name);
    res.json({ team, players });
  } catch {
    res.status(500).json({ error: 'failed to load roster' });
  }
});

router.get('/teams/:id/stats', async (req, res) => {
  // Validate :id — ESPN team IDs are integers; reject anything non-numeric.
  if (!/^\d+$/.test(req.params.id)) {
    return res.status(400).json({ error: 'team id must be a numeric string' });
  }
  const teamId = req.params.id;

  // season param: default to current calendar year; reject non-numeric / non-4-digit values.
  let season;
  if (req.query.season === undefined || req.query.season === '') {
    season = new Date().getFullYear();
  } else if (/^\d{4}$/.test(req.query.season)) {
    season = parseInt(req.query.season, 10);
  } else {
    return res.status(400).json({ error: 'season must be a 4-digit year (e.g. 2026)' });
  }

  try {
    // Run both upstream fetches in parallel; espnClient wraps each in withCache internally.
    // fetchTeamPtsAllowed is a best-effort enrichment — if it rejects, preserve rawStats and
    // omit oppPpg rather than dropping the whole response.
    const [rawStats, oppPpg] = await Promise.all([
      fetchTeamStats(teamId, season),
      fetchTeamPtsAllowed(teamId, season).catch(err => {
        console.warn(`teams/${teamId}/stats: oppPpg unavailable (season=${season}):`, err.message);
        return null;
      }),
    ]);

    // ESPN returned no stat data for this team/season combination.
    if (!rawStats) {
      return res.json({ empty: true, season, teamId });
    }

    // Merge oppPpg into the stats object only when we have a value — do not emit null fields.
    const stats = { ...rawStats };
    if (oppPpg != null) stats.oppPpg = oppPpg;

    res.json({ season, teamId, stats });
  } catch (err) {
    console.error(`teams/${teamId}/stats season=${season}:`, err.message);
    res.status(502).json({ error: 'upstream error fetching team stats' });
  }
});

router.get('/teams/:id/history', async (req, res) => {
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

    const events = await fetchTeamSchedule(teamId, season, seasontype);
    if (!events || events.length === 0) return res.json({ empty: true, teamId, season, seasontype, events: [] });
    res.json({ teamId, season, seasontype, events });
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

    const activePlayers = Object.values(rosterData)
      .flat()
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

    const matchedPlayers = [...activePlayers, ...retiredPlayers].slice(0, 30);
    res.json({ teams: matchedTeams, players: matchedPlayers });
  } catch {
    res.status(500).json({ error: 'search failed' });
  }
});

router.get('/players/:id', async (req, res) => {
  try {
    const player = playerById[req.params.id];
    if (player) return res.json({ player });

    // Not in active roster — try ESPN on-demand (retired player)
    const r = await fetch(`${ESPN_WEB}/athletes/${req.params.id}`);
    if (!r.ok) return res.status(404).json({ error: 'player not found' });
    const data = await r.json();
    const a = data.athlete;
    if (!a) return res.status(404).json({ error: 'player not found' });
    res.json({ player: {
      id:           String(a.id),
      name:         a.displayName,
      position:     a.position?.abbreviation ?? '',
      positionName: a.position?.displayName  ?? '',
      jersey:       a.jersey ?? null,
      headshot:     a.headshot?.href ?? null,
      height:       a.height ?? null,
      weight:       a.weight ?? null,
      age:          a.age    ?? null,
      college:      a.college?.name ?? null,
      birthPlace:   null,
      experience:   a.experience?.years ?? null,
      teamId:       null,
      teamName:     null,
      retired:      true,
    }});
  } catch {
    res.status(500).json({ error: 'failed to load player' });
  }
});

router.get('/players/:id/detailed-stats', async (req, res) => {
  try {

    const { regData, postData, teamsById } = await fetchPlayerSeasonData(req.params.id);
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
    await Promise.all([...allPairs.values()].map(({ t, y }) => fetchTeamStats(t, y)));

    result.advanced = {
      regular:       buildAdvancedSplit(result.perGame.regular,       regTidByYear,  teamSeasonStatsCache, result.totals.regular),
      regularCareer: buildAdvancedCareer(result.perGame.regularCareer, result.totals.regularCareer),
      playoffs:      buildAdvancedSplit(result.perGame.playoffs,      postTidByYear, teamSeasonStatsCache, result.totals.playoffs),
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

    const glUrl = new URL(`${ESPN_WEB}/athletes/${req.params.id}/gamelog`);
    if (req.query.season) glUrl.searchParams.set('season', req.query.season);
    const raw = await fetch(glUrl.toString());
    if (!raw.ok) return res.status(404).json({ error: 'no gamelog available' });
    const data = await raw.json();

    const names = data.names || [];
    const eventMeta = data.events || {};

    const games = [];
    (data.seasonTypes || []).forEach(st => {
      (st.categories || []).forEach(cat => {
        (cat.events || []).forEach(evt => {
          const meta = eventMeta[evt.eventId];
          if (!meta || !evt.stats) return;
          const isHome = meta.atVs === 'vs';
          games.push({
            date: meta.gameDate,
            opponent: meta.opponent?.abbreviation || '?',
            atVs: meta.atVs || 'vs',
            result: meta.gameResult || '?',
            teamScore: isHome ? parseInt(meta.homeTeamScore) : parseInt(meta.awayTeamScore),
            oppScore: isHome ? parseInt(meta.awayTeamScore) : parseInt(meta.homeTeamScore),
            stats: evt.stats,
          });
        });
      });
    });

    games.sort((a, b) => new Date(a.date) - new Date(b.date));
    res.json({ names, games });
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

router.get('/teams/:id/narrative', async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) {
    return res.status(400).json({ error: 'team id must be a numeric string' });
  }
  const teamId = req.params.id;

  if (!narrativeClient.enabled) {
    return res.status(503).json({ error: 'narrative service unavailable' });
  }

  try {
    const allTeams = await getTeams();
    const team = allTeams.find(t => String(t.id) === teamId);
    if (!team) return res.status(404).json({ error: 'team not found' });

    const history = await buildHistory(team);

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
    console.error(`teams/${teamId}/narrative:`, err.message);
    res.status(502).json({ error: 'upstream error generating narrative' });
  }
});

router.get('/status', (req, res) => {
  res.json({
    status: 'ok',
    app: 'KnowTheW',
    teamsLoaded: true,
    rostersCached: Object.keys(rosterData).length,
    playersCached: Object.keys(playerById).length,
  });
});

module.exports = router;
