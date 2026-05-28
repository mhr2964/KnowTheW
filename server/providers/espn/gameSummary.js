// ESPN play-by-play / boxscore extraction (absorbed from the former server/lib/pbpExtractor.js).
//
// These walk ESPN's raw game `summary` object, which must NOT escape the provider boundary — so the
// public method getGamePbpStats fetches the summary internally and returns only the derived numbers.
// The WNBA-specific play-detection rules (FT = pointsAttempted===1, FG = shootingPlay+scoreValue,
// 3PT via scoreValue/text, team-rebound exclusion when participants.length===0) are ESPN-PBP
// specifics and stay here verbatim; a future Sportradar provider must NOT assume them.
//
// computeOnCourtStats / extractBoxscoreTeamStats are exported for characterization testing against a
// captured summary fixture — that's the regression net for this numerically-sensitive code.

const espn = require('./client');

// Find the target player's team ID from the boxscore players array.
function findTargetTeamId(summary, pid) {
  for (const teamData of summary.boxscore?.players ?? []) {
    for (const sg of teamData.statistics ?? []) {
      if (sg.athletes?.some((a) => String(a.athlete.id) === pid)) {
        return String(teamData.team.id);
      }
    }
  }
  return null;
}

// Walk ESPN PBP to accumulate team and opponent stats while the target player is on court.
function computeOnCourtStats(summary, targetPlayerId) {
  const pid = String(targetPlayerId);
  const targetTeamId = findTargetTeamId(summary, pid);
  if (!targetTeamId) return null;

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
    fga: 0, fgm: 0, fg3a: 0, fg3m: 0, fta: 0, ftm: 0, orb: 0, drb: 0, tov: 0, ast: 0,
    oFga: 0, oFgm: 0, oFg3a: 0, oFta: 0, oOrb: 0, oDrb: 0, oTov: 0,
    pts: 0, oPts: 0,
  };

  const plays = [...(summary.plays ?? [])].sort(
    (a, b) => parseInt(a.sequenceNumber) - parseInt(b.sequenceNumber)
  );

  for (const play of plays) {
    const playTeam = String(play.team?.id ?? '');
    const parts = play.participants ?? [];

    if (play.type?.text === 'Substitution' && parts.length >= 2) {
      if (onCourt[playTeam]) {
        onCourt[playTeam].add(String(parts[0].athlete.id));
        onCourt[playTeam].delete(String(parts[1].athlete.id));
      }
      continue;
    }

    if (!onCourt[targetTeamId]?.has(pid)) continue;

    // WNBA PBP: field goals use shootingPlay+scoreValue; pointsAttempted=1 only for FTs
    const isFT  = play.pointsAttempted === 1;
    const isFGA = play.shootingPlay && !isFT;
    const made  = play.scoringPlay;
    const sv    = play.scoreValue ?? 0;
    const is3   = isFGA && (sv === 3 || play.text?.toLowerCase().includes('three point'));

    // Team rebounds (no participants = deadball, shot-clock, OOB) are not
    // contested by individuals — exclude them from all rebound tallies.
    const isPlayerRebound = parts.length > 0;

    if (playTeam === targetTeamId) {
      if (isFGA) { oc.fga++; if (is3) { oc.fg3a++; if (made) oc.fg3m++; } if (made) oc.fgm++; }
      else if (isFT) { oc.fta++; if (made) oc.ftm++; }
      if (isPlayerRebound) {
        if (play.type?.text === 'Offensive Rebound')      oc.orb++;
        else if (play.type?.text === 'Defensive Rebound') oc.drb++;
      }
      if (play.type?.text?.includes('Turnover'))          oc.tov++;
      if (isFGA && made && parts.length >= 2)             oc.ast++;
      if (made) oc.pts  += isFT ? 1 : sv;
    } else {
      if (isFGA) { oc.oFga++; if (is3) oc.oFg3a++; if (made) oc.oFgm++; }
      else if (isFT) oc.oFta++;
      if (isPlayerRebound) {
        if (play.type?.text === 'Offensive Rebound')      oc.oOrb++;
        else if (play.type?.text === 'Defensive Rebound') oc.oDrb++;
      }
      if (play.type?.text?.includes('Turnover'))          oc.oTov++;
      if (made) oc.oPts += isFT ? 1 : sv;
    }
  }

  return oc;
}

// Extract team and opponent stats from the official ESPN boxscore (not PBP).
function extractBoxscoreTeamStats(summary, targetPlayerId) {
  const pid = String(targetPlayerId);
  const targetTeamId = findTargetTeamId(summary, pid);
  if (!targetTeamId) return null;

  const boxTeams = summary.boxscore?.teams ?? [];
  const tmBox  = boxTeams.find((t) => String(t.team.id) === targetTeamId);
  const oppBox = boxTeams.find((t) => String(t.team.id) !== targetTeamId);
  if (!tmBox) return null;

  function readTeamBox(teamBox) {
    const byName = Object.fromEntries((teamBox.statistics ?? []).map((s) => [s.name, s]));

    function getMadeAtt(name) {
      const s = byName[name];
      if (!s) return null;
      const dv = String(s.displayValue ?? s.value ?? '');
      if (dv.includes('-')) {
        const [m, a] = dv.split('-').map(Number);
        if (!isNaN(m) && !isNaN(a)) return { made: m, att: a };
      }
      return null;
    }
    function getNum(name) {
      const s = byName[name];
      return s != null ? (parseFloat(s.displayValue ?? s.value) || 0) : 0;
    }

    const fg  = getMadeAtt('fieldGoalsMade-fieldGoalsAttempted');
    const fg3 = getMadeAtt('threePointFieldGoalsMade-threePointFieldGoalsAttempted');
    const ft  = getMadeAtt('freeThrowsMade-freeThrowsAttempted');
    if (!fg) return null;

    const fgm = fg.made, fga = fg.att;
    const fg3m = fg3?.made ?? 0;
    const ftm = ft?.made ?? 0, fta = ft?.att ?? 0;
    const orb = getNum('offensiveRebounds');
    const drb = getNum('defensiveRebounds');
    // totalTurnovers includes team turnovers; fall back to turnovers if absent
    const tov = getNum('totalTurnovers') || getNum('turnovers');
    const ast = getNum('assists');
    const pts = 2 * fgm + fg3m + ftm;

    return { fgm, fga, fg3m, ftm, fta, orb, drb, tov, ast, pts };
  }

  const tm = readTeamBox(tmBox);
  if (!tm) return null;
  const opp = oppBox ? readTeamBox(oppBox) : null;

  return { tm, oppPts: opp?.pts ?? null, opp: opp ?? null };
}

/**
 * Fetch one game summary and return the PBP-derived stats for the target player.
 * @returns {Promise<{fetched:boolean, onCourt:object|null, boxscore:object|null}>}
 *   fetched=false means the source returned no summary (ESPN failure); distinct from a fetched
 *   summary with no usable PBP (onCourt=null). The raw summary never leaves this function.
 */
async function getGamePbpStats(eventId, playerId) {
  const summary = await espn.fetchGameSummary(eventId);
  if (!summary) return { fetched: false, onCourt: null, boxscore: null };
  return {
    fetched: true,
    onCourt: computeOnCourtStats(summary, playerId),
    boxscore: extractBoxscoreTeamStats(summary, playerId),
  };
}

module.exports = {
  getGamePbpStats,
  // exported for characterization tests:
  computeOnCourtStats,
  extractBoxscoreTeamStats,
  findTargetTeamId,
};
