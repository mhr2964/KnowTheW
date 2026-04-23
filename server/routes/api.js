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
  // 1998–2017: computed from ESPN team stats, averaged across all active teams per season.
  // 2005 is interpolated (avg of 2004+2006) — ESPN API returns corrupted FGM/FGA for that year.
  '1998': { pts:69.76,   fgm:25.5533, fga:61.6667, fg3m:3.6267, fg3a:11.6867, ftm:15.0267, fta:21.3667, orb:11.0267, drb:21.68,   trb:32.7067, ast:15.7133, stl:8.4733, blk:3.2667, tov:17.0,    pf:21.2933 },
  '1999': { pts:68.5885, fgm:24.7396, fga:60.2031, fg3m:4.651,  fg3a:14.0052, ftm:14.4583, fta:19.8594, orb:10.0781, drb:20.7969, trb:30.875,  ast:15.9531, stl:7.3333, blk:3.1094, tov:14.7917, pf:21.2969 },
  '2000': { pts:68.3958, fgm:24.8264, fga:57.6424, fg3m:4.3229, fg3a:12.9826, ftm:14.4201, fta:19.5035, orb:9.0972,  drb:20.0243, trb:29.1215, ast:15.3403, stl:8.1076, blk:3.2569, tov:15.2639, pf:20.8021 },
  '2001': { pts:65.7535, fgm:23.9028, fga:58.7708, fg3m:4.5625, fg3a:13.6181, ftm:13.3854, fta:18.2743, orb:9.6701,  drb:20.8333, trb:30.5035, ast:14.9792, stl:7.9479, blk:3.6285, tov:14.6319, pf:19.1979 },
  '2002': { pts:67.4605, fgm:24.7655, fga:59.0842, fg3m:4.7686, fg3a:13.9102, ftm:13.161,  fta:17.9259, orb:9.9791,  drb:21.0242, trb:31.0032, ast:15.3959, stl:7.7406, blk:3.6711, tov:14.9033, pf:19.3017 },
  '2003': { pts:68.9,    fgm:25.2294, fga:60.4618, fg3m:4.6441, fg3a:13.8029, ftm:13.7971, fta:18.5176, orb:10.1324, drb:21.6382, trb:31.7706, ast:15.5971, stl:7.4118, blk:3.8088, tov:14.1265, pf:19.2676 },
  '2004': { pts:67.8353, fgm:24.75,   fga:58.9265, fg3m:4.3235, fg3a:12.4059, ftm:14.0118, fta:18.8765, orb:9.6294,  drb:21.3618, trb:30.9912, ast:15.8676, stl:7.8706, blk:3.7971, tov:14.3353, pf:19.3176 },
  '2005': { pts:71.9578, fgm:26.256,  fga:62.0582, fg3m:4.7299, fg3a:13.8888, ftm:14.7078, fta:19.6267, orb:9.8936,  drb:22.5699, trb:32.4635, ast:16.0729, stl:7.8377, blk:3.6686, tov:14.4885, pf:19.5318 },
  '2006': { pts:76.0802, fgm:27.762,  fga:65.1898, fg3m:5.1364, fg3a:15.3717, ftm:15.4037, fta:20.377,  orb:10.1578, drb:23.7781, trb:33.9358, ast:16.2781, stl:7.8048, blk:3.5401, tov:14.6417, pf:19.746  },
  '2007': { pts:77.0615, fgm:27.8422, fga:66.1872, fg3m:5.8048, fg3a:16.7005, ftm:15.5722, fta:20.0695, orb:10.1043, drb:24.0321, trb:34.1364, ast:16.5668, stl:7.8422, blk:3.7567, tov:15.5802, pf:19.7326 },
  '2008': { pts:76.4632, fgm:27.5,    fga:65.2941, fg3m:5.3652, fg3a:15.9363, ftm:16.098,  fta:21.4461, orb:10.3211, drb:23.8995, trb:34.2206, ast:16.2843, stl:7.9069, blk:4.098,  tov:15.0368, pf:20.7672 },
  '2009': { pts:78.4779, fgm:28.3897, fga:66.3922, fg3m:5.7328, fg3a:16.6422, ftm:15.9657, fta:20.6299, orb:9.8603,  drb:24.0245, trb:33.8848, ast:16.2328, stl:8.1569, blk:3.8799, tov:14.9363, pf:20.0098 },
  '2010': { pts:80.3211, fgm:29.2647, fga:66.4093, fg3m:5.8529, fg3a:16.7868, ftm:15.9387, fta:20.5711, orb:9.8505,  drb:23.8701, trb:33.7206, ast:17.5074, stl:8.2549, blk:3.7255, tov:14.8578, pf:19.1838 },
  '2011': { pts:77.2941, fgm:28.598,  fga:65.6912, fg3m:5.5784, fg3a:15.8211, ftm:14.5196, fta:18.848,  orb:9.4902,  drb:23.8333, trb:33.3235, ast:16.8676, stl:7.8725, blk:3.9387, tov:14.2868, pf:18.2598 },
  '2012': { pts:77.5809, fgm:28.6005, fga:66.6373, fg3m:6.2377, fg3a:17.6912, ftm:14.1422, fta:18.5368, orb:10.1642, drb:23.8186, trb:33.9828, ast:16.8971, stl:8.3652, blk:3.8725, tov:14.7794, pf:17.8162 },
  '2013': { pts:75.6471, fgm:28.1201, fga:66.402,  fg3m:4.6789, fg3a:14.3603, ftm:14.7279, fta:18.8603, orb:9.7892,  drb:24.6618, trb:34.451,  ast:16.0025, stl:7.7034, blk:4.1029, tov:13.4853, pf:17.7868 },
  '2014': { pts:77.1225, fgm:28.9926, fga:66.3211, fg3m:4.6176, fg3a:14.0539, ftm:14.5196, fta:18.6275, orb:9.3235,  drb:24.3873, trb:33.7108, ast:17.1029, stl:7.6176, blk:3.7353, tov:13.3015, pf:18.326  },
  '2015': { pts:75.1422, fgm:27.7843, fga:65.402,  fg3m:4.8113, fg3a:14.7941, ftm:14.7574, fta:18.5539, orb:8.8113,  drb:24.7745, trb:33.5858, ast:16.3284, stl:7.1863, blk:4.3186, tov:12.9093, pf:18.4951 },
  '2016': { pts:81.8897, fgm:29.7892, fga:67.4828, fg3m:5.4044, fg3a:16.0809, ftm:16.9069, fta:21.1814, orb:9.1054,  drb:24.6814, trb:33.7868, ast:17.6324, stl:7.3358, blk:4.0417, tov:12.848,  pf:19.6544 },
  '2017': { pts:81.451,  fgm:29.9485, fga:67.9534, fg3m:5.9118, fg3a:17.4828, ftm:15.6422, fta:19.6275, orb:8.8382,  drb:25.0147, trb:33.8529, ast:17.8824, stl:7.0441, blk:3.8799, tov:12.9338, pf:18.8603 },
  // 2018–2025: computed the same way
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

// ── Game summary cache (for PBP lineup reconstruction) ───────────────────────
const gameSummaryCache = {};

async function fetchGameSummary(eventId) {
  if (eventId in gameSummaryCache) return gameSummaryCache[eventId];
  try {
    const res = await fetch(`${ESPN}/summary?event=${eventId}`);
    if (!res.ok) return (gameSummaryCache[eventId] = null);
    return (gameSummaryCache[eventId] = await res.json());
  } catch {
    return (gameSummaryCache[eventId] = null);
  }
}

// Walk ESPN PBP to accumulate team and opponent stats while target player is on court.
// Returns { fga, fgm, fg3a, ftm, fta, orb, drb, tov, ast,
//           oFga, oFgm, oFg3a, oFta, oOrb, oDrb, oTov } or null if player not found.
function computeOnCourtStats(summary, targetPlayerId) {
  const pid = String(targetPlayerId);

  // Identify player's team from boxscore
  let targetTeamId = null;
  for (const teamData of summary.boxscore?.players ?? []) {
    for (const sg of teamData.statistics ?? []) {
      if (sg.athletes?.some(a => String(a.athlete.id) === pid)) {
        targetTeamId = String(teamData.team.id);
        break;
      }
    }
    if (targetTeamId) break;
  }
  if (!targetTeamId) return null;

  // Build starting lineups per team from boxscore
  const onCourt = {};
  for (const teamData of summary.boxscore?.players ?? []) {
    const tid = String(teamData.team.id);
    onCourt[tid] = new Set();
    for (const sg of teamData.statistics ?? []) {
      for (const athlete of sg.athletes ?? []) {
        if (athlete.starter) onCourt[tid].add(String(athlete.athlete.id));
      }
    }
  }

  const oc = {
    fga: 0, fgm: 0, fg3a: 0, fta: 0, ftm: 0, orb: 0, drb: 0, tov: 0, ast: 0,
    oFga: 0, oFgm: 0, oFg3a: 0, oFta: 0, oOrb: 0, oDrb: 0, oTov: 0,
  };

  const plays = [...(summary.plays ?? [])].sort(
    (a, b) => parseInt(a.sequenceNumber) - parseInt(b.sequenceNumber)
  );

  for (const play of plays) {
    const playTeam = String(play.team?.id ?? '');
    const parts = play.participants ?? [];

    if (play.type?.text === 'Substitution' && parts.length >= 2) {
      if (onCourt[playTeam]) {
        onCourt[playTeam].add(String(parts[0].athlete.id));    // entering
        onCourt[playTeam].delete(String(parts[1].athlete.id)); // leaving
      }
      continue;
    }

    // Only attribute plays when target player is on court
    if (!onCourt[targetTeamId]?.has(pid)) continue;

    // WNBA PBP: field goals use shootingPlay+scoreValue; pointsAttempted=1 only for FTs
    const isFT  = play.pointsAttempted === 1;
    const isFGA = play.shootingPlay && !isFT;
    const made  = play.scoringPlay;
    const sv    = play.scoreValue ?? 0;
    const is3   = isFGA && (sv === 3 || play.text?.toLowerCase().includes('three point'));

    if (playTeam === targetTeamId) {
      if (isFGA) { oc.fga++; if (is3) oc.fg3a++; if (made) oc.fgm++; }
      else if (isFT) { oc.fta++; if (made) oc.ftm++; }
      if (play.type?.text === 'Offensive Rebound')      oc.orb++;
      else if (play.type?.text === 'Defensive Rebound') oc.drb++;
      if (play.type?.text?.includes('Turnover'))        oc.tov++;
      if (isFGA && made && parts.length >= 2)           oc.ast++;
    } else {
      if (isFGA) { oc.oFga++; if (is3) oc.oFg3a++; if (made) oc.oFgm++; }
      else if (isFT) oc.oFta++;
      if (play.type?.text === 'Offensive Rebound')      oc.oOrb++;
      else if (play.type?.text === 'Defensive Rebound') oc.oDrb++;
      if (play.type?.text?.includes('Turnover'))        oc.oTov++;
    }
  }

  return oc;
}

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

    // tm.oFgaPg is set only when PBP on-court data is available.
    // On-court stats are already scaled to the player's playing time, so the M/mp
    // factor that appears in approximation formulas cancels out.
    const hasPBP = tm.oFgaPg !== undefined;

    if (hasPBP) {
      // ── PBP-exact path ───────────────────────────────────────────────────────
      // tm.* = team on-court per-game stats while player was on floor
      // tm.o* = opponent on-court per-game stats while player was on floor

      // USG%: player poss / on-court team poss (M/mp cancels since both scaled to player's time)
      const tmPoss = tm.fgaPg + 0.44*tm.ftaPg + tm.tovPg;
      if (tmPoss > 0) usgPct = (fga + 0.44*fta + tov) / tmPoss;

      // AST%: player AST / (on-court TmFGM - player FGM)
      const tmFgmAdj = tm.fgmPg - fgm;
      if (tmFgmAdj > 0) astPct = ast / tmFgmAdj;

      // ORB%: player ORB / all offensive board opportunities while on floor
      // (TmORB + OppDRB = all occasions the team missed and a board was contested)
      const orbD = tm.orbPg + tm.oDrbPg;
      if (orbD > 0) orbPct = orb / orbD;

      // DRB%: player DRB / all defensive board opportunities while on floor
      // (TmDRB + OppORB = all occasions the opponent missed and a board was contested)
      const drbD = tm.drbPg + tm.oOrbPg;
      if (drbD > 0) drbPct = drb / drbD;

      // TRB%: player TRB / all rebounds while on floor
      const trbD = tm.orbPg + tm.drbPg + tm.oOrbPg + tm.oDrbPg;
      if (trbD > 0) trbPct = trb / trbD;

      // STL%: player STL / on-court opp possessions (M/mp cancels)
      const oppPoss = tm.oFgaPg + 0.44*tm.oFtaPg + tm.oTovPg - tm.oOrbPg;
      if (oppPoss > 0) stlPct = stl / oppPoss;

      // BLK%: player BLK / on-court opp 2PA (M/mp cancels)
      const opp2PA = tm.oFgaPg - tm.oFg3aPg;
      if (opp2PA > 0) blkPct = blk / opp2PA;

      // PER: use on-court tm ratio and pace for better accuracy
      const tmRatio = tm.fgmPg > 0 ? tm.astPg / tm.fgmPg : 0;
      const factor  = (2/3) - (0.5 * lg.ast/lg.fgm) / (2 * lg.fgm/lg.ftm);
      const VOP     = lg.pts / (lg.fga - lg.orb + lg.tov + 0.44*lg.fta);
      const DRBP    = lg.drb / lg.trb;
      const uPER = (1/mp) * (
        fg3m + (2/3)*ast + (2 - factor*tmRatio)*fgm
        + ftm * 0.5 * (1 + (1-tmRatio) + (2/3)*tmRatio)
        - VOP*tov - VOP*DRBP*(fga-fgm)
        - VOP*0.44*(0.44+0.56*DRBP)*(fta-ftm)
        + VOP*(1-DRBP)*(trb-orb) + VOP*DRBP*orb
        + VOP*stl + VOP*DRBP*blk
        - pf*(lg.ftm/lg.pf - 0.44*(lg.fta/lg.pf)*VOP)
      );
      const lgPace  = lg.fga - lg.orb + lg.tov + 0.44*lg.fta;
      // tmPace is on-court pace per game-played (player's playing time, not 40 min).
      // Normalize to per-40-min so it's on the same scale as lgPace before taking the ratio.
      const tmPace  = (tm.fgaPg - tm.orbPg + tm.tovPg + 0.44*tm.ftaPg) * (M / mp);
      const aPER    = tmPace > 0 ? (lgPace / tmPace) * uPER : uPER;
      const lgTmR   = lg.ast / lg.fgm;
      const lgFact  = (2/3) - (0.5*lgTmR) / (2*lg.fgm/lg.ftm);
      const s = n => n / 5;
      const lgUPER  = (1/M) * (
        s(lg.fg3m) + (2/3)*s(lg.ast) + (2-lgFact*lgTmR)*s(lg.fgm)
        + s(lg.ftm)*0.5*(1+(1-lgTmR)+(2/3)*lgTmR)
        - VOP*s(lg.tov) - VOP*DRBP*(s(lg.fga)-s(lg.fgm))
        - VOP*0.44*(0.44+0.56*DRBP)*(s(lg.fta)-s(lg.ftm))
        + VOP*(1-DRBP)*s(lg.drb) + VOP*DRBP*s(lg.orb)
        + VOP*s(lg.stl) + VOP*DRBP*s(lg.blk)
        - s(lg.pf)*(lg.ftm/lg.pf - 0.44*(lg.fta/lg.pf)*VOP)
      );
      if (lgUPER > 0) per = (15 / lgUPER) * aPER;

    } else {
      // ── Approximation path (season-average team stats) ───────────────────────
      // tm.* = full-season per-game team averages (not on-court specific)

      const tmPoss = tm.fgaPg + 0.44*tm.ftaPg + tm.tovPg;
      if (tmPoss > 0) usgPct = (fga + 0.44*fta + tov) * M / (mp * tmPoss);

      const onFloorFgm = (mp / M) * tm.fgmPg;
      if (onFloorFgm > fgm) astPct = ast / (onFloorFgm - fgm);

      // ORB%: OppDRB ≈ TmFGA - TmFGM
      const tmMissed = tm.fgaPg - tm.fgmPg;
      if (tmMissed > 0) orbPct = orb * M / (mp * tmMissed);

      // DRB%: OppORB ≈ lgORB
      const drbD = tm.drbPg + lg.orb;
      if (drbD > 0) drbPct = drb * M / (mp * drbD);

      // TRB%: TmMissedFG + lgMissedFG
      const trbD = tmMissed + (lg.fga - lg.fgm);
      if (trbD > 0) trbPct = trb * M / (mp * trbD);

      // STL%: OppPoss ≈ league average
      const lgPoss = lg.fga + 0.44*lg.fta + lg.tov - lg.orb;
      if (lgPoss > 0) stlPct = stl * M / (mp * lgPoss);

      // BLK%: Opp2PA ≈ lgFGA - lg3PA
      const lg2PA = lg.fga - lg.fg3a;
      if (lg2PA > 0) blkPct = blk * M / (mp * lg2PA);

      // PER (Hollinger)
      const tmRatio = tm.astPg / tm.fgmPg;
      const factor  = (2/3) - (0.5 * lg.ast/lg.fgm) / (2 * lg.fgm/lg.ftm);
      const VOP     = lg.pts / (lg.fga - lg.orb + lg.tov + 0.44*lg.fta);
      const DRBP    = lg.drb / lg.trb;
      const uPER = (1/mp) * (
        fg3m + (2/3)*ast + (2 - factor*tmRatio)*fgm
        + ftm * 0.5 * (1 + (1-tmRatio) + (2/3)*tmRatio)
        - VOP*tov - VOP*DRBP*(fga-fgm)
        - VOP*0.44*(0.44+0.56*DRBP)*(fta-ftm)
        + VOP*(1-DRBP)*(trb-orb) + VOP*DRBP*orb
        + VOP*stl + VOP*DRBP*blk
        - pf*(lg.ftm/lg.pf - 0.44*(lg.fta/lg.pf)*VOP)
      );
      const lgPace = lg.fga - lg.orb + lg.tov + 0.44*lg.fta;
      const tmPace = tm.fgaPg - tm.orbPg + tm.tovPg + 0.44*tm.ftaPg;
      const aPER   = (lgPace / tmPace) * uPER;
      const lgTmR  = lg.ast / lg.fgm;
      const lgFact = (2/3) - (0.5*lgTmR) / (2*lg.fgm/lg.ftm);
      const s = n => n / 5;
      const lgUPER = (1/M) * (
        s(lg.fg3m) + (2/3)*s(lg.ast) + (2-lgFact*lgTmR)*s(lg.fgm)
        + s(lg.ftm)*0.5*(1+(1-lgTmR)+(2/3)*lgTmR)
        - VOP*s(lg.tov) - VOP*DRBP*(s(lg.fga)-s(lg.fgm))
        - VOP*0.44*(0.44+0.56*DRBP)*(s(lg.fta)-s(lg.ftm))
        + VOP*(1-DRBP)*s(lg.drb) + VOP*DRBP*s(lg.orb)
        + VOP*s(lg.stl) + VOP*DRBP*s(lg.blk)
        - s(lg.pf)*(lg.ftm/lg.pf - 0.44*(lg.fta/lg.pf)*VOP)
      );
      if (lgUPER > 0) per = (15 / lgUPER) * aPER;
    }
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

const PBP_OC_KEYS = ['fga','fgm','fg3a','fta','ftm','orb','drb','tov','ast',
                     'oFga','oFgm','oFg3a','oFta','oOrb','oDrb','oTov'];

async function computeSeasonPBP(playerId, season, playerRow, I) {
  const glData = await fetch(
    `${ESPN_WEB}/athletes/${playerId}/gamelog?season=${season}&seasontype=2`
  ).then(r => r.ok ? r.json() : null);
  if (!glData) return null;

  const eventIds = [];
  (glData.seasonTypes || []).forEach(st => {
    if (!st.displayName?.includes('Regular Season')) return;
    (st.categories || []).forEach(cat => {
      (cat.events || []).forEach(evt => { if (evt.eventId) eventIds.push(evt.eventId); });
    });
  });
  if (!eventIds.length) return null;

  const summaries = await Promise.all(eventIds.map(id => fetchGameSummary(id)));
  const totOC = Object.fromEntries(PBP_OC_KEYS.map(k => [k, 0]));
  let pbpGames = 0;
  for (const summary of summaries) {
    if (!summary) continue;
    const oc = computeOnCourtStats(summary, playerId);
    if (!oc) continue;
    pbpGames++;
    for (const k of PBP_OC_KEYS) totOC[k] += oc[k];
  }
  if (!pbpGames) return null;

  const g = pbpGames;
  const tmOC = {
    fgaPg:   totOC.fga  / g, fgmPg:   totOC.fgm  / g,
    fg3aPg:  totOC.fg3a / g, ftaPg:   totOC.fta  / g, ftmPg:  totOC.ftm / g,
    orbPg:   totOC.orb  / g, drbPg:   totOC.drb  / g,
    tovPg:   totOC.tov  / g, astPg:   totOC.ast  / g,
    oFgaPg:  totOC.oFga  / g, oFgmPg: totOC.oFgm  / g,
    oFg3aPg: totOC.oFg3a / g, oFtaPg: totOC.oFta  / g,
    oOrbPg:  totOC.oOrb  / g, oDrbPg: totOC.oDrb  / g,
    oTovPg:  totOC.oTov  / g,
  };

  const lg = WNBA_LG[season] ?? null;
  return { row: advancedRow(playerRow, I, tmOC, lg), pbpGames };
}

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

    // All seasons that have both a player row and a WNBA_LG entry
    const seasons = [...new Set(pgTable.rows.map(r => String(r[I.SEASON_ID])))]
      .filter(s => WNBA_LG[s]);

    const results = await Promise.all(seasons.map(async season => {
      const playerRow = pgTable.rows.find(r => String(r[I.SEASON_ID]) === season);
      if (!playerRow) return null;
      const result = await computeSeasonPBP(req.params.id, season, playerRow, I);
      return result ? { season, row: result.row, pbpGames: result.pbpGames } : null;
    }));

    const valid = results.filter(Boolean);
    res.json({
      headers: ADV_HEADERS_SRV,
      rows: valid.map(r => r.row),
      pbpGamesBySeason: Object.fromEntries(valid.map(r => [r.season, r.pbpGames])),
    });
  } catch (err) {
    console.error('advanced-pbp-all:', err.message);
    res.status(500).json({ error: 'failed to compute advanced stats' });
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
