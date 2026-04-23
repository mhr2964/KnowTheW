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

// ── WNBA league averages per season (computed from ESPN team stats) ───────────
// Per-game per-team averages across all WNBA teams for each season.
// Used to compute advanced stats that need league context.
const WNBA_LG = {
  '2018': { pts:82.8087, fgm:30.6391, fga:68.8155, fg3m:6.7259,  fg3a:19.5009, ftm:14.8045, fta:18.6572, orb:8.9044,  drb:25.5599, trb:34.4643, ast:19.1863, stl:6.9276, blk:3.7346, tov:12.678,  pf:18.1987 },
  '2019': { pts:78.701,  fgm:29.098,  fga:68.5735, fg3m:6.7623,  fg3a:20.0294, ftm:13.7426, fta:17.2549, orb:9.0343,  drb:25.7696, trb:34.8039, ast:18.8333, stl:7.4485, blk:4.1765, tov:13.4877, pf:17.4804 },
  '2020': { pts:83.0606, fgm:30.4356, fga:68.2045, fg3m:7.3068,  fg3a:21.1553, ftm:14.8826, fta:18.447,  orb:8.2576,  drb:25.8409, trb:34.0985, ast:19.1023, stl:7.7462, blk:3.5,    tov:13.7159, pf:17.9432 },
  '2021': { pts:80.6615, fgm:29.0104, fga:67.7474, fg3m:7.2656,  fg3a:21.1641, ftm:13.9531, fta:17.2604, orb:8.125,   drb:26.6563, trb:34.7813, ast:18.9063, stl:7.0078, blk:4.1406, tov:13.138,  pf:17.4453 },
  '2022': { pts:82.2685, fgm:30.0579, fga:67.9954, fg3m:7.7338,  fg3a:22.3773, ftm:14.419,  fta:18.169,  orb:8.1528,  drb:26.0972, trb:34.25,   ast:20.2315, stl:7.4907, blk:3.7153, tov:13.6829, pf:17.6713 },
  '2023': { pts:82.7354, fgm:30.0646, fga:68.2958, fg3m:7.6646,  fg3a:22.1021, ftm:14.825,  fta:18.5375, orb:8.0146,  drb:26.3354, trb:34.35,   ast:19.8479, stl:7.0896, blk:3.9042, tov:13.2167, pf:17.8792 },
  '2024': { pts:81.6667, fgm:29.7125, fga:68.1104, fg3m:7.7229,  fg3a:22.8354, ftm:14.1604, fta:18.0271, orb:8.2021,  drb:26.1625, trb:34.3646, ast:20.5104, stl:7.4458, blk:4.1292, tov:13.2625, pf:17.2125 },
  '2025': { pts:81.6993, fgm:29.5909, fga:67.3689, fg3m:8.1836,  fg3a:24.2238, ftm:14.3339, fta:18.215,  orb:8.4161,  drb:25.5262, trb:33.9423, ast:20.3304, stl:7.3794, blk:3.9283, tov:12.9038, pf:17.4633 },
};

// ── Team season stats cache ───────────────────────────────────────────────────
const teamSeasonStatsCache = {};

async function fetchTeamStats(teamId, year) {
  const key = `${teamId}-${year}`;
  if (key in teamSeasonStatsCache) return teamSeasonStatsCache[key];
  try {
    const res = await fetch(`${ESPN}/teams/${teamId}/statistics?season=${year}&seasontype=2`);
    if (!res.ok) return (teamSeasonStatsCache[key] = null);
    const data = await res.json();
    const cats = data.results?.stats?.categories;
    if (!cats) return (teamSeasonStatsCache[key] = null);
    const off = cats.find(c => c.name === 'offensive');
    const def = cats.find(c => c.name === 'defensive');
    const g = (cat, name) => cat?.stats.find(s => s.name === name)?.value ?? null;
    return (teamSeasonStatsCache[key] = {
      fgaPg: g(off, 'avgFieldGoalsAttempted'),
      fgmPg: g(off, 'avgFieldGoalsMade'),
      ftaPg: g(off, 'avgFreeThrowsAttempted'),
      orbPg: g(off, 'avgOffensiveRebounds'),
      drbPg: g(def, 'avgDefensiveRebounds'),
      tovPg: g(off, 'avgTurnovers'),
      astPg: g(off, 'avgAssists'),
    });
  } catch {
    return (teamSeasonStatsCache[key] = null);
  }
}

function extractTeamIdByYear(data) {
  if (!data?.categories) return {};
  const avgCat = data.categories.find(c => c.name === 'averages');
  if (!avgCat) return {};
  const map = {};
  for (const entry of avgCat.statistics) {
    map[String(entry.season.year)] = String(entry.teamId);
  }
  return map;
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

// ── Advanced stats computation ────────────────────────────────────────────────
const ADV_HEADERS_SRV = [
  'SEASON_ID', 'TEAM_ABBREVIATION', 'GP',
  'TS_PCT', 'EFG_PCT', 'TPAr', 'FTr', 'TOV_PCT',
  'USG_PCT', 'AST_PCT',
  'ORB_PCT', 'DRB_PCT', 'TRB_PCT',
  'STL_PCT', 'BLK_PCT',
  'PER',
];

function advancedRow(row, I, tm, lg) {
  const fga = row[I.FGA] ?? 0,  fgm = row[I.FGM] ?? 0;
  const fg3m = row[I.FG3M] ?? 0, fg3a = row[I.FG3A] ?? 0;
  const fta = row[I.FTA] ?? 0,  ftm = row[I.FTM] ?? 0;
  const orb = row[I.OREB] ?? 0, drb = row[I.DREB] ?? 0, trb = row[I.REB] ?? 0;
  const ast = row[I.AST] ?? 0,  stl = row[I.STL] ?? 0, blk = row[I.BLK] ?? 0;
  const tov = row[I.TOV] ?? 0,  pf  = row[I.PF]  ?? 0;
  const pts = row[I.PTS] ?? 0,  mp  = row[I.MIN] ?? 0;

  // Player-only stats (always computable)
  const ts     = (fga + 0.44*fta) > 0 ? pts / (2*(fga + 0.44*fta)) : null;
  const efg    = fga > 0 ? (fgm + 0.5*fg3m) / fga : null;
  const tpar   = fga > 0 ? fg3a / fga : null;
  const ftr    = fga > 0 ? fta / fga : null;
  const poss   = fga + 0.44*fta + tov;
  const tovPct = poss > 0 ? tov / poss : null;

  let usgPct=null, astPct=null, orbPct=null, drbPct=null, trbPct=null;
  let stlPct=null, blkPct=null, per=null;

  if (tm && lg && mp > 0) {
    const M = 40; // WNBA regulation minutes per game

    // USG%: share of team possessions used by player while on floor
    const tmPoss = tm.fgaPg + 0.44*tm.ftaPg + tm.tovPg;
    if (tmPoss > 0) usgPct = (fga + 0.44*fta + tov) * M / (mp * tmPoss);

    // AST%: % of team FGM assisted by player while on floor
    const onFloorFgm = (mp / M) * tm.fgmPg;
    if (onFloorFgm > fgm) astPct = ast / (onFloorFgm - fgm);

    // ORB%: OppDRB ≈ TmFGA - TmFGM - TmORB (misses not offensively rebounded)
    const tmMissed = tm.fgaPg - tm.fgmPg;
    if (tmMissed > 0) orbPct = orb * M / (mp * tmMissed);

    // DRB%: OppORB ≈ lgORB (league average)
    const drbD = tm.drbPg + lg.orb;
    if (drbD > 0) drbPct = drb * M / (mp * drbD);

    // TRB%: total boards ≈ TmMissedFG + lgMissedFG (opponent's)
    const trbD = tmMissed + (lg.fga - lg.fgm);
    if (trbD > 0) trbPct = trb * M / (mp * trbD);

    // STL%: OppPoss ≈ league average possessions per game
    const lgPoss = lg.fga + 0.44*lg.fta + lg.tov - lg.orb;
    if (lgPoss > 0) stlPct = stl * M / (mp * lgPoss);

    // BLK%: Opp2PA ≈ lgFGA - lg3PA (opponent 2-point attempts)
    const lg2PA = lg.fga - lg.fg3a;
    if (lg2PA > 0) blkPct = blk * M / (mp * lg2PA);

    // PER (Hollinger) — full formula with pace adjustment and normalization
    const tmRatio = tm.astPg / tm.fgmPg;
    const factor  = (2/3) - (0.5 * lg.ast/lg.fgm) / (2 * lg.fgm/lg.ftm);
    const VOP     = lg.pts / (lg.fga - lg.orb + lg.tov + 0.44*lg.fta);
    const DRBP    = lg.drb / lg.trb;

    const uPER = (1/mp) * (
      fg3m
      + (2/3)*ast
      + (2 - factor*tmRatio)*fgm
      + ftm * 0.5 * (1 + (1-tmRatio) + (2/3)*tmRatio)
      - VOP * tov
      - VOP * DRBP * (fga - fgm)
      - VOP * 0.44 * (0.44 + 0.56*DRBP) * (fta - ftm)
      + VOP * (1-DRBP) * (trb - orb)
      + VOP * DRBP * orb
      + VOP * stl
      + VOP * DRBP * blk
      - pf * (lg.ftm/lg.pf - 0.44*(lg.fta/lg.pf)*VOP)
    );

    const lgPace = lg.fga - lg.orb + lg.tov + 0.44*lg.fta;
    const tmPace = tm.fgaPg - tm.orbPg + tm.tovPg + 0.44*tm.ftaPg;
    const aPER   = (lgPace / tmPace) * uPER;

    // lgUPER: uPER for a player producing exactly league-average per-minute stats
    // (1/5 of team totals per 40 min). This normalizes PER so league average = 15.
    const lgTmR  = lg.ast / lg.fgm;
    const lgFact = (2/3) - (0.5*lgTmR) / (2*lg.fgm/lg.ftm);
    const s = n => n / 5;
    const lgUPER = (1/M) * (
      s(lg.fg3m)
      + (2/3)*s(lg.ast)
      + (2 - lgFact*lgTmR)*s(lg.fgm)
      + s(lg.ftm) * 0.5 * (1 + (1-lgTmR) + (2/3)*lgTmR)
      - VOP * s(lg.tov)
      - VOP * DRBP * (s(lg.fga) - s(lg.fgm))
      - VOP * 0.44 * (0.44 + 0.56*DRBP) * (s(lg.fta) - s(lg.ftm))
      + VOP * (1-DRBP) * s(lg.drb)
      + VOP * DRBP * s(lg.orb)
      + VOP * s(lg.stl)
      + VOP * DRBP * s(lg.blk)
      - s(lg.pf) * (lg.ftm/lg.pf - 0.44*(lg.fta/lg.pf)*VOP)
    );

    if (lgUPER > 0) per = (15 / lgUPER) * aPER;
  }

  return [
    row[I.SEASON_ID], row[I.TEAM_ABBREVIATION], row[I.GP],
    ts, efg, tpar, ftr, tovPct,
    usgPct, astPct, orbPct, drbPct, trbPct, stlPct, blkPct, per,
  ];
}

function buildAdvancedSplit(src, teamIdByYear, cache) {
  if (!src?.rows) return null;
  const I = Object.fromEntries(src.headers.map((h, i) => [h, i]));
  const rows = src.rows.map(row => {
    const year = String(row[I.SEASON_ID]);
    const tid  = teamIdByYear[year];
    const tm   = tid ? (cache[`${tid}-${year}`] ?? null) : null;
    const lg   = WNBA_LG[year] ?? null;
    return advancedRow(row, I, tm, lg);
  });
  return { headers: ADV_HEADERS_SRV, rows };
}

function buildAdvancedCareer(src) {
  if (!src?.rows?.[0]) return null;
  const I = Object.fromEntries(src.headers.map((h, i) => [h, i]));
  const row = src.rows[0];
  const fga = row[I.FGA] ?? 0, fgm = row[I.FGM] ?? 0;
  const fg3m = row[I.FG3M] ?? 0, fg3a = row[I.FG3A] ?? 0;
  const fta = row[I.FTA] ?? 0, pts = row[I.PTS] ?? 0, tov = row[I.TOV] ?? 0;
  const ts     = (fga + 0.44*fta) > 0 ? pts / (2*(fga + 0.44*fta)) : null;
  const efg    = fga > 0 ? (fgm + 0.5*fg3m) / fga : null;
  const tpar   = fga > 0 ? fg3a / fga : null;
  const ftr    = fga > 0 ? fta / fga : null;
  const poss   = fga + 0.44*fta + tov;
  const tovPct = poss > 0 ? tov / poss : null;
  return { headers: ADV_HEADERS_SRV, rows: [
    [row[I.SEASON_ID], row[I.TEAM_ABBREVIATION], row[I.GP],
     ts, efg, tpar, ftr, tovPct,
     null, null, null, null, null, null, null, null],
  ]};
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

    // Fetch team stats for advanced computation (parallel, cached)
    const regTidByYear  = extractTeamIdByYear(regData);
    const postTidByYear = extractTeamIdByYear(postData);
    const allPairs = new Map([
      ...Object.entries(regTidByYear).map(([y, t])  => [`${t}-${y}`,  { t, y }]),
      ...Object.entries(postTidByYear).map(([y, t]) => [`${t}-${y}`,  { t, y }]),
    ]);
    await Promise.all([...allPairs.values()].map(({ t, y }) => fetchTeamStats(t, y)));

    result.advanced = {
      regular:       buildAdvancedSplit(result.perGame.regular,      regTidByYear,  teamSeasonStatsCache),
      regularCareer: buildAdvancedCareer(result.perGame.regularCareer),
      playoffs:      buildAdvancedSplit(result.perGame.playoffs,     postTidByYear, teamSeasonStatsCache),
      playoffCareer: buildAdvancedCareer(result.perGame.playoffCareer),
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
