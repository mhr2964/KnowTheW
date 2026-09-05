// Single-game box score: final score, both teams' full stat lines, both teams' per-player rows,
// and a quarter-by-quarter score breakdown. BDL-only (this site's own schedule/game-log events ARE
// BDL game ids once BDL-sourced -- see schedule.js's header comment) -- no ESPN equivalent is
// attempted here, same scope limit as odds/plus-minus (regular season, season >= BDL_MIN_SEASON).
//
// Three independent per-game endpoints assembled together: /games/{id} (final score + team
// identity), /player_stats?game_ids[]= (every player's box line, already used elsewhere for the
// per-game roster -- see plays.js's fetchGameRoster), /team_stats?game_ids[]= (both teams' box
// line -- no `pts` field on this endpoint, computed the same way plays.js's toTeamStatsRow does).
// Quarter scores are NOT a stored field anywhere -- derived from /plays' running home_score/
// away_score, reading the last play's cumulative score within each period.
const { bdlFetch } = require('./client');
const { buildOpponentLookup } = require('./schedule');
const espn = require('../espn');
const { resolveEspnIdByName } = require('../../lib/playerNameIndex');

function toPlayerBoxRow(r) {
  const fgm = r.fgm ?? 0, fga = r.fga ?? 0;
  const fg3m = r.fg3m ?? 0, fg3a = r.fg3a ?? 0;
  const ftm = r.ftm ?? 0, fta = r.fta ?? 0;
  return {
    name: `${r.player.first_name} ${r.player.last_name}`,
    bdlTeamId: r.team.id,
    minutes: r.min ?? '0',
    points: r.pts ?? 0,
    rebounds: r.reb ?? 0,
    assists: r.ast ?? 0,
    steals: r.stl ?? 0,
    blocks: r.blk ?? 0,
    turnovers: r.turnover ?? 0,
    fouls: r.pf ?? 0,
    fgm, fga, fg3m, fg3a, ftm, fta,
    plusMinus: r.plus_minus ?? 0,
  };
}

// Same formula as plays.js's toTeamStatsRow -- WNBATeamStat has no `pts` field at all.
function toTeamBoxLine(r) {
  return {
    fgm: r.fgm ?? 0, fga: r.fga ?? 0, fgPct: r.fg_pct ?? null,
    fg3m: r.fg3m ?? 0, fg3a: r.fg3a ?? 0, fg3Pct: r.fg3_pct ?? null,
    ftm: r.ftm ?? 0, fta: r.fta ?? 0, ftPct: r.ft_pct ?? null,
    oreb: r.oreb ?? 0, dreb: r.dreb ?? 0, reb: r.reb ?? 0,
    ast: r.ast ?? 0, stl: r.stl ?? 0, blk: r.blk ?? 0,
    turnovers: r.turnovers ?? 0, fouls: r.fouls ?? 0,
    points: 2 * (r.fgm ?? 0) + (r.fg3m ?? 0) + (r.ftm ?? 0),
  };
}

// Pure: raw /plays rows (same shape as plays.js's untrimmed rows, NOT the trimmed cached shape
// gamePbpCache.js stores -- period/clock/home_score/away_score were deliberately stripped from
// that cache for storage-bloat reasons, see plays.js's trimPlay comment, so this reads a fresh,
// separate fetch, not that cache) -> [{period, home, away}] quarter-by-quarter score, each
// period's score being the DIFFERENCE from the prior period's cumulative running total (the running
// total itself, not a per-period delta, is what every play row carries).
function buildQuarterScores(playRows) {
  const lastByPeriod = new Map();
  for (const p of playRows ?? []) {
    if (p.period == null) continue;
    const prev = lastByPeriod.get(p.period);
    if (!prev || p.order > prev.order) lastByPeriod.set(p.period, p);
  }
  const periods = [...lastByPeriod.keys()].sort((a, b) => a - b);
  let prevHome = 0, prevAway = 0;
  return periods.map(period => {
    const { home_score, away_score } = lastByPeriod.get(period);
    const row = { period, home: home_score - prevHome, away: away_score - prevAway };
    prevHome = home_score;
    prevAway = away_score;
    return row;
  });
}

async function fetchGameBoxScoreRawBdl(bdlGameId) {
  const [gameData, playerStatsData, teamStatsData, playsData, espnTeams] = await Promise.all([
    bdlFetch(`/games/${bdlGameId}`, {}),
    bdlFetch('/player_stats', { 'game_ids[]': [bdlGameId], per_page: 100 }),
    bdlFetch('/team_stats', { 'game_ids[]': [bdlGameId] }),
    bdlFetch('/plays', { game_id: bdlGameId, per_page: 100 }),
    espn.getTeams(),
  ]);

  const game = gameData?.data;
  if (!game) return null;

  const opponentLookup = buildOpponentLookup(espnTeams);
  const homeEspn = opponentLookup.get(String(game.home_team?.abbreviation).toUpperCase());
  const awayEspn = opponentLookup.get(String(game.visitor_team?.abbreviation).toUpperCase());

  const teamStatsRows = teamStatsData?.data ?? [];
  const homeTeamStats = teamStatsRows.find(r => r.team?.id === game.home_team?.id);
  const awayTeamStats = teamStatsRows.find(r => r.team?.id === game.visitor_team?.id);

  const playerRows = (playerStatsData?.data ?? []).map(toPlayerBoxRow);
  const quarterScores = buildQuarterScores(playsData?.data);

  return {
    game: {
      id: game.id,
      date: game.date ?? null,
      status: game.status_state ?? null,
      postseason: !!game.postseason,
      home: { espnId: homeEspn?.id ?? null, abbreviation: game.home_team?.abbreviation ?? null, score: game.home_score ?? null },
      away: { espnId: awayEspn?.id ?? null, abbreviation: game.visitor_team?.abbreviation ?? null, score: game.away_score ?? null },
    },
    quarterScores,
    teamTotals: {
      home: homeTeamStats ? toTeamBoxLine(homeTeamStats) : null,
      away: awayTeamStats ? toTeamBoxLine(awayTeamStats) : null,
    },
    boxScores: {
      home: playerRows.filter(r => r.bdlTeamId === game.home_team?.id),
      away: playerRows.filter(r => r.bdlTeamId === game.visitor_team?.id),
    },
  };
}

// Resolves every player row's name to this site's ESPN id, batched once per unique name (same
// pattern as League Leaders/Injury Report) -- kept as a separate pass over the raw result so the
// assembly above stays unit-testable without a network call.
async function attachPlayerIds(result) {
  if (!result) return null;
  const names = new Set([...result.boxScores.home, ...result.boxScores.away].map(r => r.name));
  const idByName = new Map(await Promise.all(
    [...names].map(async name => [name, await resolveEspnIdByName(name)])
  ));
  const withIds = side => side.map(row => ({
    name: row.name, minutes: row.minutes, points: row.points, rebounds: row.rebounds,
    assists: row.assists, steals: row.steals, blocks: row.blocks, turnovers: row.turnovers,
    fouls: row.fouls, fgm: row.fgm, fga: row.fga, fg3m: row.fg3m, fg3a: row.fg3a,
    ftm: row.ftm, fta: row.fta, plusMinus: row.plusMinus,
    playerId: idByName.get(row.name) ?? null,
  }));
  return {
    ...result,
    boxScores: { home: withIds(result.boxScores.home), away: withIds(result.boxScores.away) },
  };
}

async function getGameBoxScoreBdl(bdlGameId) {
  const raw = await fetchGameBoxScoreRawBdl(bdlGameId);
  return attachPlayerIds(raw);
}

module.exports = {
  getGameBoxScoreBdl, fetchGameBoxScoreRawBdl, buildQuarterScores, toPlayerBoxRow, toTeamBoxLine,
};
