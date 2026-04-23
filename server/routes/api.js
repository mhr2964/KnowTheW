const express = require('express');
const router  = express.Router();

const { getDb }                                                          = require('../db');
const { WNBA_LG }                                                        = require('../constants/leagueAverages');
const { ESPN_WEB, getTeams, getRoster, fetchTeamStats,
        rosterData, playerById, teamSeasonStatsCache }                   = require('../lib/espnClient');
const { parseESPNSeasonData, extractTeamIdByYear, buildDetailedStats }   = require('../lib/statsParser');
const { ADV_HEADERS_SRV, buildAdvancedSplit, buildAdvancedCareer,
        computeSeasonPBP }                                               = require('../lib/advancedStats');

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

router.get('/search', async (req, res) => {
  const q = (req.query.q || '').toLowerCase().trim();
  if (!q) return res.json({ teams: [], players: [] });
  try {
    const allTeams = await getTeams();
    const matchedTeams = allTeams.filter(
      t => t.name.toLowerCase().includes(q) || t.abbreviation.toLowerCase().includes(q)
    );
    const matchedPlayers = Object.values(rosterData)
      .flat()
      .filter(p => p.name.toLowerCase().includes(q))
      .slice(0, 30);
    res.json({ teams: matchedTeams, players: matchedPlayers });
  } catch {
    res.status(500).json({ error: 'search failed' });
  }
});

router.get('/players/:id', async (req, res) => {
  try {
    const player = playerById[req.params.id];
    if (!player) return res.status(404).json({ error: 'player not found — load their team roster first' });
    res.json({ player });
  } catch {
    res.status(500).json({ error: 'failed to load player' });
  }
});

router.get('/players/:id/detailed-stats', async (req, res) => {
  try {
    const player = playerById[req.params.id];
    if (!player) return res.status(404).json({ error: 'player not found' });

    const [teams, regData, postData] = await Promise.all([
      getTeams(),
      fetch(`${ESPN_WEB}/athletes/${req.params.id}/stats?seasontype=2`).then(r => r.ok ? r.json() : null),
      fetch(`${ESPN_WEB}/athletes/${req.params.id}/stats?seasontype=3`).then(r => r.ok ? r.json() : null),
    ]);

    const teamsById = Object.fromEntries(teams.map(t => [t.id, t]));
    const result = buildDetailedStats(regData, postData, teamsById);

    if (!result.perGame.regular) return res.status(404).json({ error: 'no stats available for this player' });

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
    const player = playerById[req.params.id];
    if (!player) return res.status(404).json({ error: 'player not found' });

    const seasonParam = req.query.season ? `?season=${req.query.season}` : '';
    const raw = await fetch(`${ESPN_WEB}/athletes/${req.params.id}/gamelog${seasonParam}`);
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
    const player = playerById[req.params.id];
    if (!player) return res.status(404).json({ error: 'player not found' });

    const [teams, statsData] = await Promise.all([
      getTeams(),
      fetch(`${ESPN_WEB}/athletes/${req.params.id}/stats?seasontype=2`).then(r => r.ok ? r.json() : null),
    ]);

    const teamsById = Object.fromEntries(teams.map(t => [t.id, t]));
    const parsed = parseESPNSeasonData(statsData, teamsById);
    const pgTable = parsed?.pg?.table;
    if (!pgTable) return res.status(404).json({ error: 'no stats for this player' });
    const I = Object.fromEntries(pgTable.headers.map((h, i) => [h, i]));

    // Serve from MongoDB cache if GP hasn't changed since last computation.
    const currentGP = pgTable.rows.reduce((s, r) => s + (r[I.GP] ?? 0), 0);
    const db = getDb();
    if (db) {
      const advCached = await db.collection('advancedStats').findOne({ _id: req.params.id });
      if (advCached?.gp === currentGP) return res.json(advCached.data);
    }

    const totTable = parsed?.tot?.table;
    const totByYear = {};
    if (totTable?.rows) {
      for (const r of totTable.rows) totByYear[String(r[I.SEASON_ID])] = r;
    }

    const regTidByYear = extractTeamIdByYear(statsData);
    const seasons = [...new Set(pgTable.rows.map(r => String(r[I.SEASON_ID])))]
      .filter(s => WNBA_LG[s]);

    const results = await Promise.all(seasons.map(async season => {
      const playerRow = pgTable.rows.find(r => String(r[I.SEASON_ID]) === season);
      if (!playerRow) return null;
      const teamId = regTidByYear[season] ?? null;
      const totRow  = totByYear[season] ?? null;
      const result = await computeSeasonPBP(req.params.id, season, playerRow, I, teamId, totRow);
      return result ? { season, row: result.row, pbpGames: result.pbpGames } : null;
    }));

    const valid = results.filter(Boolean);
    const advResult = {
      headers: ADV_HEADERS_SRV,
      rows: valid.map(r => r.row),
      pbpGamesBySeason: Object.fromEntries(valid.map(r => [r.season, r.pbpGames])),
    };
    if (db) db.collection('advancedStats')
      .replaceOne({ _id: req.params.id }, { _id: req.params.id, gp: currentGP, data: advResult }, { upsert: true })
      .catch(err => console.error('mongo write advancedStats:', err.message));
    res.json(advResult);
  } catch (err) {
    console.error('advanced-pbp-all:', err.message);
    res.status(500).json({ error: 'failed to compute advanced stats' });
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
