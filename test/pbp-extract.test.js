// Characterization tests for the PBP/boxscore extraction moved into the ESPN provider (M5).
// These lock the WNBA-specific detection rules and on-court accounting that are easy to break
// silently: FT vs FGA (pointsAttempted===1), 3PT detection, team-rebound exclusion (no
// participants), opponent split, assist counting, and substitution-driven on-court membership.

process.env.NODE_ENV = 'test';

const { test } = require('node:test');
const assert = require('node:assert');

const {
  computeOnCourtStats,
  extractBoxscoreTeamStats,
} = require('../server/providers/espn/gameSummary');
const { extractGameLogEvents } = require('../server/providers/espn/gamelog');

// Target player 100 on team 1 (starters 100,101; bench 102). Opponent team 2 (starters 200,201).
const SUMMARY = {
  boxscore: {
    players: [
      { team: { id: '1' }, statistics: [{ athletes: [
        { athlete: { id: '100' }, starter: true },
        { athlete: { id: '101' }, starter: true },
        { athlete: { id: '102' }, starter: false },
      ] }] },
      { team: { id: '2' }, statistics: [{ athletes: [
        { athlete: { id: '200' }, starter: true },
        { athlete: { id: '201' }, starter: true },
      ] }] },
    ],
    teams: [
      { team: { id: '1' }, statistics: [
        { name: 'fieldGoalsMade-fieldGoalsAttempted', displayValue: '30-70' },
        { name: 'threePointFieldGoalsMade-threePointFieldGoalsAttempted', displayValue: '8-20' },
        { name: 'freeThrowsMade-freeThrowsAttempted', displayValue: '14-18' },
        { name: 'offensiveRebounds', displayValue: '10' },
        { name: 'defensiveRebounds', displayValue: '28' },
        { name: 'totalTurnovers', displayValue: '12' },
        { name: 'assists', displayValue: '20' },
      ] },
      { team: { id: '2' }, statistics: [
        { name: 'fieldGoalsMade-fieldGoalsAttempted', displayValue: '28-66' },
        { name: 'threePointFieldGoalsMade-threePointFieldGoalsAttempted', displayValue: '6-18' },
        { name: 'freeThrowsMade-freeThrowsAttempted', displayValue: '10-14' },
        { name: 'offensiveRebounds', displayValue: '8' },
        { name: 'defensiveRebounds', displayValue: '26' },
        { name: 'totalTurnovers', displayValue: '14' },
        { name: 'assists', displayValue: '18' },
      ] },
    ],
  },
  // Listed out of sequence to also exercise the sequenceNumber sort (sub at seq 1 must apply
  // before the seq-2 field goal it precedes).
  plays: [
    { sequenceNumber: '2', team: { id: '1' }, type: { text: 'Jump Shot' }, shootingPlay: true, scoringPlay: true,  scoreValue: 2, participants: [{ athlete: { id: '100' } }, { athlete: { id: '102' } }] },
    { sequenceNumber: '1', team: { id: '1' }, type: { text: 'Substitution' }, participants: [{ athlete: { id: '102' } }, { athlete: { id: '101' } }] },
    { sequenceNumber: '3', team: { id: '1' }, type: { text: 'Jump Shot' }, shootingPlay: true, scoringPlay: false, scoreValue: 3, participants: [{ athlete: { id: '100' } }], text: 'three point jumper' },
    { sequenceNumber: '4', team: { id: '1' }, type: { text: 'Free Throw' }, shootingPlay: true, scoringPlay: true, pointsAttempted: 1, participants: [{ athlete: { id: '100' } }] },
    { sequenceNumber: '5', team: { id: '1' }, type: { text: 'Offensive Rebound' }, participants: [{ athlete: { id: '100' } }] },
    { sequenceNumber: '6', team: { id: '1' }, type: { text: 'Defensive Rebound' }, participants: [] },
    { sequenceNumber: '7', team: { id: '1' }, type: { text: 'Bad Pass Turnover' }, participants: [{ athlete: { id: '100' } }] },
    { sequenceNumber: '8', team: { id: '2' }, type: { text: 'Layup' }, shootingPlay: true, scoringPlay: true, scoreValue: 2, participants: [{ athlete: { id: '200' } }] },
    { sequenceNumber: '9', team: { id: '2' }, type: { text: 'Offensive Rebound' }, participants: [{ athlete: { id: '201' } }] },
    { sequenceNumber: '10', team: { id: '1' }, type: { text: 'Substitution' }, participants: [{ athlete: { id: '101' } }, { athlete: { id: '100' } }] },
    { sequenceNumber: '11', team: { id: '1' }, type: { text: 'Jump Shot' }, shootingPlay: true, scoringPlay: true, scoreValue: 2, participants: [{ athlete: { id: '101' } }] },
  ],
};

test('computeOnCourtStats applies WNBA detection rules + on-court gating', () => {
  assert.deepStrictEqual(computeOnCourtStats(SUMMARY, '100'), {
    fga: 2, fgm: 1, fg3a: 1, fg3m: 0, fta: 1, ftm: 1, orb: 1, drb: 0, tov: 1, ast: 1,
    oFga: 1, oFgm: 1, oFg3a: 0, oFta: 0, oOrb: 1, oDrb: 0, oTov: 0,
    pts: 3, oPts: 2,
    badPassTov: 1, lostBallTov: 0,
    foulCommitShoot: 0, foulCommitOff: 0,
    foulDrawnShoot: 0, foulDrawnOff: 0,
    pga: 2, and1: 0, blkd: 0,
  });
});

test('computeOnCourtStats returns null when the player is not in the boxscore', () => {
  assert.strictEqual(computeOnCourtStats(SUMMARY, '999'), null);
});

test('extractBoxscoreTeamStats reads team totals + opponent points', () => {
  assert.deepStrictEqual(extractBoxscoreTeamStats(SUMMARY, '100'), {
    tm:  { fgm: 30, fga: 70, fg3m: 8, ftm: 14, fta: 18, orb: 10, drb: 28, tov: 12, ast: 20, pts: 82 },
    oppPts: 72,
    opp: { fgm: 28, fga: 66, fg3m: 6, ftm: 10, fta: 14, orb:  8, drb: 26, tov: 14, ast: 18, pts: 72 },
  });
});

test('extractGameLogEvents flattens per-event metadata for PBP selection', () => {
  const events = extractGameLogEvents({
    events: {
      10: { eventNote: '', opponent: { id: '2' } },
      11: { eventNote: 'WNBA All-Star', opponent: { id: '999' } },
      12: { opponent: { id: '3' } },
    },
    seasonTypes: [
      { displayName: '2024 Regular Season', categories: [{ events: [{ eventId: 10 }, { eventId: 11 }] }] },
      { displayName: '2024 Postseason', categories: [{ events: [{ eventId: 12 }] }] },
    ],
  });
  assert.deepStrictEqual(events, [
    { eventId: 10, seasonTypeName: '2024 Regular Season', eventNote: '', opponentId: '2' },
    { eventId: 11, seasonTypeName: '2024 Regular Season', eventNote: 'WNBA All-Star', opponentId: '999' },
    { eventId: 12, seasonTypeName: '2024 Postseason', eventNote: '', opponentId: '3' },
  ]);
});
