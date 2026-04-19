const express = require('express');
const router = express.Router();

const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/basketball/wnba';
const ESPN_WEB = 'https://site.web.api.espn.com/apis/common/v3/sports/basketball/wnba';
const BDL = 'https://api.balldontlie.io';

// ── Caches ───────────────────────────────────────────────────────────────────
let teamsPromise = null;
const rosterPromises = {};
const rosterData = {};
const playerById = {};
const bdlIdCache = {};

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

async function fetchPlayerStats(playerId) {
  const res = await fetch(`${ESPN_WEB}/athletes/${playerId}/overview`);
  if (!res.ok) return null;
  const data = await res.json();
  const s = data.statistics;
  if (!s || !s.labels) return null;
  return { labels: s.labels, names: s.names, displayNames: s.displayNames, splits: s.splits };
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

// ── ESPN stats → BRef-format converter (fallback) ────────────────────────────
const ESPN_TO_COL = {
  gamesPlayed: 'GP', gamesStarted: 'GS',
  avgMinutes: 'MIN', avgPoints: 'PTS',
  avgRebounds: 'REB', avgAssists: 'AST',
  avgSteals: 'STL', avgBlocks: 'BLK', avgTurnovers: 'TOV',
  fieldGoalsMade: 'FGM', fieldGoalsAttempted: 'FGA', fieldGoalPct: 'FG_PCT',
  threePointFieldGoalsMade: 'FG3M', threePointFieldGoalsAttempted: 'FG3A',
  threePointFieldGoalPct: 'FG3_PCT',
  freeThrowsMade: 'FTM', freeThrowsAttempted: 'FTA', freeThrowPct: 'FT_PCT',
  offRebounds: 'OREB', defRebounds: 'DREB', avgFouls: 'PF',
};

function espnToSplits(espnStats) {
  if (!espnStats?.splits?.length) return null;
  const headers = ['SEASON_ID', ...espnStats.names.map(n => ESPN_TO_COL[n] || n)];
  const regularRows = espnStats.splits
    .filter(s => s.displayName !== 'Career')
    .map(s => [s.displayName, ...s.stats]);
  const careerSplit = espnStats.splits.find(s => s.displayName === 'Career');
  return {
    regular: regularRows.length ? { headers, rows: regularRows } : null,
    regularCareer: careerSplit ? { headers, rows: [[careerSplit.displayName, ...careerSplit.stats]] } : null,
    playoffs: null,
    playoffCareer: null,
  };
}

// ── BallDontLie helpers ──────────────────────────────────────────────────────
function bdlAuthHeaders() {
  return { Authorization: process.env.BALLDONTLIE_KEY || '' };
}

async function resolveBDLId(playerName) {
  if (playerName in bdlIdCache) return bdlIdCache[playerName];
  try {
    const res = await fetch(
      `${BDL}/wnba/v1/players?search=${encodeURIComponent(playerName)}&per_page=10`,
      { headers: bdlAuthHeaders() }
    );
    if (!res.ok) { bdlIdCache[playerName] = null; return null; }
    const json = await res.json();
    const lower = playerName.toLowerCase();
    const match = (json.data || []).find(p =>
      `${p.first_name} ${p.last_name}`.toLowerCase() === lower
    ) || json.data?.[0] || null;
    const id = match?.id ?? null;
    bdlIdCache[playerName] = id;
    return id;
  } catch {
    bdlIdCache[playerName] = null;
    return null;
  }
}

async function fetchBDLSeasonStats(bdlId) {
  const params = new URLSearchParams({ 'player_ids[]': bdlId, per_page: 100 });
  const res = await fetch(`${BDL}/wnba/v1/player_season_stats?${params}`, { headers: bdlAuthHeaders() });
  if (!res.ok) return null;
  const json = await res.json();
  const data = json.data || [];
  if (json.meta?.next_cursor) {
    const p2 = new URLSearchParams({ 'player_ids[]': bdlId, per_page: 100, cursor: json.meta.next_cursor });
    const r2 = await fetch(`${BDL}/wnba/v1/player_season_stats?${p2}`, { headers: bdlAuthHeaders() });
    if (r2.ok) data.push(...((await r2.json()).data || []));
  }
  return data;
}

const BDL_COLS = ['SEASON_ID', 'TEAM_ABBREVIATION', 'GP', 'MIN',
  'FGM', 'FGA', 'FG_PCT', 'FG3M', 'FG3A', 'FG3_PCT',
  'FTM', 'FTA', 'FT_PCT', 'REB', 'AST', 'STL', 'BLK', 'TOV', 'PTS'];

function bdlSeasonRow(s, mode) {
  const gp = s.games_played || 0;
  const mpg = parseFloat(s.min) || 0;
  const totalMin = mpg * gp;
  const fgm = s.fgm || 0, fga = s.fga || 0;
  const fg3m = s.fg3m || 0, fg3a = s.fg3a || 0;
  const ftm = s.ftm || 0, fta = s.fta || 0;
  const fgPct = fga > 0 ? fgm / fga : null;
  const fg3Pct = fg3a > 0 ? fg3m / fg3a : null;
  const ftPct = fta > 0 ? ftm / fta : null;
  const reb = s.reb || 0, ast = s.ast || 0;
  const stl = s.stl || 0, blk = s.blk || 0;
  const tov = s.turnover || 0, pts = s.pts || 0;

  if (mode === 'perGame') {
    return [s.season, s.team.abbreviation, gp, mpg,
      fgm, fga, fgPct, fg3m, fg3a, fg3Pct, ftm, fta, ftPct,
      reb, ast, stl, blk, tov, pts];
  }
  if (mode === 'totals') {
    const t = v => Math.round(v * gp);
    return [s.season, s.team.abbreviation, gp, Math.round(totalMin),
      t(fgm), t(fga), fgPct, t(fg3m), t(fg3a), fg3Pct, t(ftm), t(fta), ftPct,
      t(reb), t(ast), t(stl), t(blk), t(tov), t(pts)];
  }
  // per36
  const p = v => totalMin > 0 ? (v * gp / totalMin) * 36 : null;
  return [s.season, s.team.abbreviation, gp, 36,
    p(fgm), p(fga), fgPct, p(fg3m), p(fg3a), fg3Pct, p(ftm), p(fta), ftPct,
    p(reb), p(ast), p(stl), p(blk), p(tov), p(pts)];
}

function bdlCareerRow(seasons, mode) {
  if (!seasons.length) return null;
  const gp = seasons.reduce((s, r) => s + (r.games_played || 0), 0);
  const totalMin = seasons.reduce((s, r) => s + (parseFloat(r.min) || 0) * (r.games_played || 0), 0);
  const sum = f => seasons.reduce((s, r) => s + (r[f] || 0) * (r.games_played || 0), 0);
  const fgm = sum('fgm'), fga = sum('fga');
  const fg3m = sum('fg3m'), fg3a = sum('fg3a');
  const ftm = sum('ftm'), fta = sum('fta');
  const fgPct = fga > 0 ? fgm / fga : null;
  const fg3Pct = fg3a > 0 ? fg3m / fg3a : null;
  const ftPct = fta > 0 ? ftm / fta : null;
  const reb = sum('reb'), ast = sum('ast');
  const stl = sum('stl'), blk = sum('blk');
  const tov = sum('turnover'), pts = sum('pts');

  if (mode === 'perGame') {
    return ['Career', '', gp, totalMin / gp,
      fgm / gp, fga / gp, fgPct, fg3m / gp, fg3a / gp, fg3Pct, ftm / gp, fta / gp, ftPct,
      reb / gp, ast / gp, stl / gp, blk / gp, tov / gp, pts / gp];
  }
  if (mode === 'totals') {
    return ['Career', '', gp, Math.round(totalMin),
      Math.round(fgm), Math.round(fga), fgPct, Math.round(fg3m), Math.round(fg3a), fg3Pct,
      Math.round(ftm), Math.round(fta), ftPct,
      Math.round(reb), Math.round(ast), Math.round(stl), Math.round(blk), Math.round(tov), Math.round(pts)];
  }
  // per36
  const p = v => totalMin > 0 ? (v / totalMin) * 36 : null;
  return ['Career', '', gp, 36,
    p(fgm), p(fga), fgPct, p(fg3m), p(fg3a), fg3Pct, p(ftm), p(fta), ftPct,
    p(reb), p(ast), p(stl), p(blk), p(tov), p(pts)];
}

function bdlToTable(seasons, mode) {
  if (!seasons.length) return null;
  return { headers: BDL_COLS, rows: [...seasons].sort((a, b) => a.season - b.season).map(s => bdlSeasonRow(s, mode)) };
}

function bdlToCareer(seasons, mode) {
  const row = bdlCareerRow(seasons, mode);
  return row ? { headers: BDL_COLS, rows: [row] } : null;
}

function bdlToDetailedStats(allSeasons) {
  const regular = allSeasons.filter(s => s.season_type === 2);
  const playoffs = allSeasons.filter(s => s.season_type === 3);
  const build = (reg, post, mode) => ({
    regular: bdlToTable(reg, mode),
    regularCareer: bdlToCareer(reg, mode),
    playoffs: bdlToTable(post, mode),
    playoffCareer: bdlToCareer(post, mode),
  });
  return {
    source: 'bdl',
    perGame: build(regular, playoffs, 'perGame'),
    totals: build(regular, playoffs, 'totals'),
    per36: build(regular, playoffs, 'per36'),
    per100: null,
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

    // 1. BallDontLie — primary source
    const bdlId = await resolveBDLId(player.name);
    if (bdlId) {
      const seasons = await fetchBDLSeasonStats(bdlId);
      if (seasons?.length) return res.json(bdlToDetailedStats(seasons));
    }

    // 2. ESPN fallback — Per Game only
    const espnStats = await fetchPlayerStats(req.params.id);
    const splits = espnToSplits(espnStats);
    if (!splits) return res.status(404).json({ error: 'no stats available for this player' });
    res.json({ source: 'espn', perGame: splits, totals: null, per36: null, per100: null });
  } catch (err) {
    console.error('detailed-stats:', err.message);
    res.status(500).json({ error: 'failed to load detailed stats' });
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
