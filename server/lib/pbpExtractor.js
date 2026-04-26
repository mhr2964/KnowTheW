const PBP_OC_KEYS = ['fga','fgm','fg3a','fta','ftm','orb','drb','tov','ast',
                     'oFga','oFgm','oFg3a','oFta','oOrb','oDrb','oTov'];

// Shared helper — find the team ID for the target player from the boxscore players array.
function findTargetTeamId(summary, pid) {
  for (const teamData of summary.boxscore?.players ?? []) {
    for (const sg of teamData.statistics ?? []) {
      if (sg.athletes?.some(a => String(a.athlete.id) === pid)) {
        return String(teamData.team.id);
      }
    }
  }
  return null;
}

// Walk ESPN PBP to accumulate team and opponent stats while target player is on court.
// Returns { fga, fgm, fg3a, ftm, fta, orb, drb, tov, ast,
//           oFga, oFgm, oFg3a, oFta, oOrb, oDrb, oTov } or null if player not found.
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
      if (isFGA) { oc.fga++; if (is3) oc.fg3a++; if (made) oc.fgm++; }
      else if (isFT) { oc.fta++; if (made) oc.ftm++; }
      if (isPlayerRebound) {
        if (play.type?.text === 'Offensive Rebound')      oc.orb++;
        else if (play.type?.text === 'Defensive Rebound') oc.drb++;
      }
      if (play.type?.text?.includes('Turnover'))          oc.tov++;
      if (isFGA && made && parts.length >= 2)             oc.ast++;
    } else {
      if (isFGA) { oc.oFga++; if (is3) oc.oFg3a++; if (made) oc.oFgm++; }
      else if (isFT) oc.oFta++;
      if (isPlayerRebound) {
        if (play.type?.text === 'Offensive Rebound')      oc.oOrb++;
        else if (play.type?.text === 'Defensive Rebound') oc.oDrb++;
      }
      if (play.type?.text?.includes('Turnover'))          oc.oTov++;
    }
  }

  return oc;
}

// Extract team and opponent stats from the official ESPN boxscore (not PBP).
// Unlike the PBP-based approach, boxscore data is complete regardless of play-log quality.
// Returns { tm: {fgm,fga,fg3m,ftm,fta,orb,drb,tov,ast,pts}, oppPts } or null.
function extractBoxscoreTeamStats(summary, targetPlayerId) {
  const pid = String(targetPlayerId);
  const targetTeamId = findTargetTeamId(summary, pid);
  if (!targetTeamId) return null;

  const boxTeams = summary.boxscore?.teams ?? [];
  const tmBox  = boxTeams.find(t => String(t.team.id) === targetTeamId);
  const oppBox = boxTeams.find(t => String(t.team.id) !== targetTeamId);
  if (!tmBox) return null;

  function readTeamBox(teamBox) {
    const byName = Object.fromEntries((teamBox.statistics ?? []).map(s => [s.name, s]));

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

  return { tm, oppPts: opp?.pts ?? null };
}

module.exports = { PBP_OC_KEYS, computeOnCourtStats, extractBoxscoreTeamStats };
