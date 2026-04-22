const express = require('express');
const router = express.Router();

const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/basketball/wnba';
const ESPN_WEB = 'https://site.web.api.espn.com/apis/common/v3/sports/basketball/wnba';

// ── Caches ───────────────────────────────────────────────────────────────────
let teamsPromise = null;
const rosterPromises = {};
const rosterData = {};
const playerById = {};

// ── ESPN helpers ─────────────────────────────────────────────────────────────
async function fetchTeams() {
  const res = await fetch(`${ESPN}/teams?limit=100`);
  if (!res.ok) throw new Error(`ESPN teams ${res.status}`);
  const data = await res.json();
  return data.sports[0].leagues[0].teams.map(({ team: t }) => ({
    id: t.id,
    name: t.displayName,
    shortName: t.shortDisplayName,
    abbreviation: t.abbreviation,
    color: t.color || '555555',
    logo: t.logos?.[0]?.href || null,
    slug: t.slug,
  }));
}

async function fetchRoster(teamId, teamName) {
  const res = await fetch(`${ESPN}/teams/${teamId}/roster`);
  if (!res.ok) throw new Error(`ESPN roster ${res.status}`);
  const data = await res.json();
  return (data.athletes || []).map(p => ({
    id: p.id,
    name: p.fullName || p.displayName,
    position: p.position?.abbreviation || '',
    positionName: p.position?.displayName || '',
    jersey: p.jersey || '',
    headshot: p.headshot?.href || null,
    height: p.displayHeight || null,
    weight: p.displayWeight || null,
    age: p.age || null,
    college: p.college?.name || null,
    birthPlace: p.birthPlace
      ? [p.birthPlace.city, p.birthPlace.state, p.birthPlace.country].filter(Boolean).join(', ')
      : null,
    experience: p.experience?.years ?? null,
    teamId,
    teamName,
  }));
}

function getTeams() {
  if (!teamsPromise) teamsPromise = fetchTeams();
  return teamsPromise;
}

function getRoster(teamId, teamName) {
  if (!rosterPromises[teamId]) {
    rosterPromises[teamId] = fetchRoster(teamId, teamName).then(players => {
      rosterData[teamId] = players;
      players.forEach(p => { playerById[p.id] = p; });
      return players;
    });
  }
  return rosterPromises[teamId];
}

// ── ESPN detailed stats ───────────────────────────────────────────────────────
const ESPN_DETAILED_HEADERS = [
  'SEASON_ID', 'TEAM_ABBREVIATION', 'GP', 'GS', 'MIN',
  'FGM', 'FGA', 'FG_PCT', 'FG3M', 'FG3A', 'FG3_PCT',
  'FTM', 'FTA', 'FT_PCT', 'OREB', 'DREB', 'REB',
  'AST', 'STL', 'BLK', 'TOV', 'PF', 'PTS',
];

function parseStat(name, val) {
  const n = parseFloat(val);
  if (isNaN(n)) return null;
  return (name.endsWith('Pct') || name.endsWith('Percentage')) ? n / 100 : n;
}

function parseStatMap(names, stats) {
  const m = {};
  names.forEach((name, i) => {
    const val = stats?.[i];
    if (name.includes('-')) {
      const [n1, n2] = name.split('-');
      if (typeof val === 'string' && val.includes('-')) {
        const dash = val.indexOf('-');
        m[n1] = parseStat(n1, val.slice(0, dash));
        m[n2] = parseStat(n2, val.slice(dash + 1));
      } else {
        m[n1] = null;
        m[n2] = null;
      }
    } else {
      m[name] = parseStat(name, val);
    }
  });
  return m;
}

function avgMapToRow(seasonId, teamAbbr, m) {
  return [
    seasonId, teamAbbr,
    m.gamesPlayed, m.gamesStarted, m.avgMinutes,
    m.avgFieldGoalsMade, m.avgFieldGoalsAttempted, m.fieldGoalPct,
    m.avgThreePointFieldGoalsMade, m.avgThreePointFieldGoalsAttempted, m.threePointFieldGoalPct,
    m.avgFreeThrowsMade, m.avgFreeThrowsAttempted, m.freeThrowPct,
    m.avgOffensiveRebounds, m.avgDefensiveRebounds, m.avgRebounds,
    m.avgAssists, m.avgSteals, m.avgBlocks, m.avgTurnovers, m.avgFouls, m.avgPoints,
  ];
}

function totalsMapToRow(seasonId, teamAbbr, tm, gp, totalMin) {
  return [
    seasonId, teamAbbr,
    gp, null, totalMin !== null ? Math.round(totalMin) : null,
    tm.fieldGoalsMade, tm.fieldGoalsAttempted, tm.fieldGoalPct,
    tm.threePointFieldGoalsMade, tm.threePointFieldGoalsAttempted, tm.threePointFieldGoalPct,
    tm.freeThrowsMade, tm.freeThrowsAttempted, tm.freeThrowPct,
    tm.offensiveRebounds, tm.defensiveRebounds, tm.totalRebounds,
    tm.assists, tm.steals, tm.blocks, tm.turnovers, tm.fouls, tm.points,
  ];
}

function per36MapToRow(seasonId, teamAbbr, tm, gp, totalMin) {
  const p = v => (v !== null && totalMin > 0) ? (v / totalMin) * 36 : null;
  return [
    seasonId, teamAbbr,
    gp, null, 36,
    p(tm.fieldGoalsMade), p(tm.fieldGoalsAttempted), tm.fieldGoalPct,
    p(tm.threePointFieldGoalsMade), p(tm.threePointFieldGoalsAttempted), tm.threePointFieldGoalPct,
    p(tm.freeThrowsMade), p(tm.freeThrowsAttempted), tm.freeThrowPct,
    p(tm.offensiveRebounds), p(tm.defensiveRebounds), p(tm.totalRebounds),
    p(tm.assists), p(tm.steals), p(tm.blocks), p(tm.turnovers), p(tm.fouls), p(tm.points),
  ];
}

function parseESPNSeasonData(data, teamsById) {
  if (!data?.categories) return null;
  const avgCat = data.categories.find(c => c.name === 'averages');
  const totCat = data.categories.find(c => c.name === 'totals');
  if (!avgCat || !totCat) return null;

  const avgByYear = {};
  avgCat.statistics.forEach(entry => {
    const year = String(entry.season.year);
    avgByYear[year] = {
      map: parseStatMap(avgCat.names, entry.stats),
      teamAbbr: teamsById[entry.teamId]?.abbreviation || '',
    };
  });

  const totByYear = {};
  totCat.statistics.forEach(entry => {
    const year = String(entry.season.year);
    totByYear[year] = {
      map: parseStatMap(totCat.names, entry.stats),
      teamAbbr: teamsById[entry.teamId]?.abbreviation || '',
    };
  });

  const years = [...new Set([...Object.keys(avgByYear), ...Object.keys(totByYear)])].sort();

  const pgRows = [], totRows = [], p36Rows = [];
  years.forEach(year => {
    const avg = avgByYear[year];
    const tot = totByYear[year];
    if (avg) pgRows.push(avgMapToRow(year, avg.teamAbbr, avg.map));
    if (avg && tot) {
      const totalMin = (avg.map.avgMinutes || 0) * (avg.map.gamesPlayed || 0);
      totRows.push(totalsMapToRow(year, tot.teamAbbr, tot.map, avg.map.gamesPlayed, totalMin));
      p36Rows.push(per36MapToRow(year, tot.teamAbbr, tot.map, avg.map.gamesPlayed, totalMin));
    }
  });

  const avgCareer = parseStatMap(avgCat.names, avgCat.totals);
  const totCareer = parseStatMap(totCat.names, totCat.totals);
  const careerGp = avgCareer.gamesPlayed;
  const careerTotalMin = Object.values(avgByYear).reduce(
    (s, a) => s + (a.map.avgMinutes || 0) * (a.map.gamesPlayed || 0), 0
  );

  const makeTable = rows => rows.length ? { headers: ESPN_DETAILED_HEADERS, rows } : null;
  const makeCareer = row => ({ headers: ESPN_DETAILED_HEADERS, rows: [row] });

  return {
    pg:  { table: makeTable(pgRows),  career: makeCareer(avgMapToRow('Career', '', avgCareer)) },
    tot: { table: makeTable(totRows), career: makeCareer(totalsMapToRow('Career', '', totCareer, careerGp, careerTotalMin)) },
    p36: { table: makeTable(p36Rows), career: makeCareer(per36MapToRow('Career', '', totCareer, careerGp, careerTotalMin)) },
  };
}

function buildDetailedStats(regData, postData, teamsById) {
  const reg = parseESPNSeasonData(regData, teamsById);
  const post = parseESPNSeasonData(postData, teamsById);
  const makeSplit = getter => ({
    regular:       reg  ? getter(reg).table  : null,
    regularCareer: reg  ? getter(reg).career : null,
    playoffs:      post ? getter(post).table  : null,
    playoffCareer: post ? getter(post).career : null,
  });
  return {
    source: 'espn',
    perGame: makeSplit(r => r.pg),
    totals:  makeSplit(r => r.tot),
    per36:   makeSplit(r => r.p36),
    per100:  null,
  };
}

// ── Startup prefetch ─────────────────────────────────────────────────────────
getTeams()
  .then(teams => Promise.all(
    teams.map(t => getRoster(t.id, t.name).catch(err => console.error(`Roster failed ${t.name}:`, err.message)))
  ))
  .catch(err => console.error('Startup prefetch failed:', err.message));

// ── Routes ───────────────────────────────────────────────────────────────────
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

router.get('/status', (req, res) => {
  res.json({
    status: 'ok',
    app: 'KnowTheW',
    teamsLoaded: teamsPromise !== null,
    rostersCached: Object.keys(rosterData).length,
    playersCached: Object.keys(playerById).length,
  });
});

module.exports = router;
