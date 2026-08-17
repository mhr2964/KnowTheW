// Characterization tests for server/providers/balldontlie/plays.js -- the text-based on-court
// reconstruction that stands in for ESPN's ID-based participants[] attribution (BDL's /plays has
// no structured player field, only free-text `text`; see the file's own header comment for why).
//
// The fixture below was cross-checked against live BDL data (game 3861, A'ja Wilson) during
// development: the blocked-shot case, substitution parsing, and buildBoxscoreFromRows's point
// totals all mirror real values pulled from the API, not just hand-picked numbers.

process.env.NODE_ENV = 'test';

const { test } = require('node:test');
const assert = require('node:assert');

const {
  computeOnCourtStatsBdl,
  buildBoxscoreFromRows,
  inferStartingFive,
} = require('../server/providers/balldontlie/plays');

// Target: Star Wilson (100, team 1). Teammates: Guard Gray (101, starts, subbed out then back in
// as the sub-in for Wilson later), Sixth Stokes (102, bench, subs in for Gray). Opponent: Ace Young
// (200, team 2, starts), Bench Nye (201, subs in for Young), Rim Blocker (202, blocks Wilson's shot).
const ROSTER = [
  { id: '100', name: 'Star Wilson', teamId: '1' },
  { id: '101', name: 'Guard Gray', teamId: '1' },
  { id: '102', name: 'Sixth Stokes', teamId: '1' },
  { id: '200', name: 'Ace Young', teamId: '2' },
  { id: '201', name: 'Bench Nye', teamId: '2' },
  { id: '202', name: 'Rim Blocker', teamId: '2' },
];

const PLAYS = [
  { order: 1, team: { id: '1' }, type: 'Jump Shot', text: "Star Wilson makes 10-foot jump shot (Guard Gray assists)", scoring_play: true, score_value: 2 },
  { order: 2, team: { id: '2' }, type: 'Layup Shot', text: "Ace Young makes layup", scoring_play: true, score_value: 2 },
  { order: 3, team: { id: '1' }, type: 'Substitution', text: "Sixth Stokes enters the game for Guard Gray" },
  { order: 4, team: { id: '2' }, type: 'Substitution', text: "Bench Nye enters the game for Ace Young" },
  // Blocked-shot regression case: BDL phrases this as "<blocker> blocks <shooter>'s ..." with no
  // "makes"/"misses" -- confirmed live to silently vanish from FGA counts before the fix (game
  // 3861: 7 blocked LV shots, undercounting on-court FGA by exactly 7 until isShotAttempt matched
  // "blocks" too). `play.team` stays the SHOOTER's team even though the blocker is named first.
  { order: 5, team: { id: '1' }, type: 'Driving Layup Shot', text: "Rim Blocker blocks Star Wilson's driving layup", scoring_play: false, score_value: 0 },
  { order: 6, team: { id: '1' }, type: 'Free Throw - 1 of 2', text: "Star Wilson misses free throw 1 of 2", scoring_play: false },
  { order: 7, team: { id: '1' }, type: 'Free Throw - 2 of 2', text: "Star Wilson makes free throw 2 of 2", scoring_play: true },
  { order: 8, team: { id: '1' }, type: 'Offensive Rebound', text: "Star Wilson offensive rebound" },
  // PascalCase (pre-~2020) taxonomy, opponent side -- team-wide, no actor gating.
  { order: 9, team: { id: '2' }, type: 'DefensiveRebound', text: "Bench Nye defensive rebound" },
  // Team rebound: no individual to attribute -- must be excluded even though it's the target's team.
  { order: 10, team: { id: '1' }, type: 'Offensive Rebound', text: "Aces offensive team rebound" },
  { order: 11, team: { id: '1' }, type: 'ShootingFoul', text: "Star Wilson shooting foul on Bench Nye" },
  // Literal-newline artifact, opponent side -- team-wide, no actor gating.
  { order: 12, team: { id: '2' }, type: 'Bad Pass\nTurnover', text: "Bench Nye bad pass turnover" },
  { order: 13, team: { id: '1' }, type: 'Lost Ball Turnover', text: "Star Wilson lost ball turnover" },
  // Wilson subbed out -- everything from here on must be excluded from her on-court numbers.
  { order: 14, team: { id: '1' }, type: 'Substitution', text: "Guard Gray enters the game for Star Wilson" },
  { order: 15, team: { id: '1' }, type: 'Jump Shot', text: "Guard Gray makes jump shot", scoring_play: true, score_value: 2 },
  { order: 16, team: { id: '2' }, type: 'Layup Shot', text: "Bench Nye makes layup", scoring_play: true, score_value: 2 },
];

test('computeOnCourtStatsBdl: shots, blocks, FTs, rebounds, turnovers, fouls, substitution gating', () => {
  assert.deepStrictEqual(computeOnCourtStatsBdl(PLAYS, '100', ROSTER), {
    fga: 2, fgm: 1, fg3a: 0, fg3m: 0, fta: 2, ftm: 1, orb: 1, drb: 0, tov: 1, ast: 1,
    oFga: 1, oFgm: 1, oFg3a: 0, oFta: 0, oOrb: 0, oDrb: 1, oTov: 1,
    pts: 3, oPts: 2,
    badPassTov: 0, lostBallTov: 1,
    foulCommitShoot: 1, foulCommitOff: 0,
    foulDrawnShoot: 1, foulDrawnOff: null,
    pga: 2, and1: 0, blkd: null,
  });
});

test('computeOnCourtStatsBdl: a blocked shot alone still counts as a made-team FGA (miss)', () => {
  const roster = [
    { id: '1', name: 'Shooter One', teamId: 'A' },
    { id: '2', name: 'Blocker Two', teamId: 'B' },
  ];
  const plays = [
    { order: 1, team: { id: 'A' }, type: 'Layup Shot', text: "Blocker Two blocks Shooter One's driving layup", scoring_play: false, score_value: 0 },
  ];
  const oc = computeOnCourtStatsBdl(plays, '1', roster);
  assert.strictEqual(oc.fga, 1);
  assert.strictEqual(oc.fgm, 0);
});

test('computeOnCourtStatsBdl: returns null when the target player is not on the game roster', () => {
  assert.strictEqual(computeOnCourtStatsBdl(PLAYS, '999', ROSTER), null);
});

test('inferStartingFive: seeds starters from pre-substitution mentions per team', () => {
  const sorted = [...PLAYS].sort((a, b) => a.order - b.order);
  const fives = inferStartingFive(sorted, ROSTER);
  assert.deepStrictEqual([...fives['1']].sort(), ['100', '101']);
  assert.deepStrictEqual([...fives['2']].sort(), ['200']);
});

test('buildBoxscoreFromRows maps /team_stats fields and derives pts from made shots', () => {
  // Real captured values from BDL game 3861 (LV @ NY, 2025-05-17) -- final score 78-92.
  const rows = [
    { team: { id: 8 }, fgm: 28, fga: 82, fg3m: 11, ftm: 11, fta: 13, oreb: 12, dreb: 29, turnovers: 10, ast: 18 },
    { team: { id: 1 }, fgm: 35, fga: 72, fg3m: 4, ftm: 18, fta: 21, oreb: 6, dreb: 37, turnover: 6, ast: 27 }, // singular "turnover" fallback
  ];
  assert.deepStrictEqual(buildBoxscoreFromRows(rows, '8'), {
    tm: { fgm: 28, fga: 82, fg3m: 11, ftm: 11, fta: 13, orb: 12, drb: 29, tov: 10, ast: 18, pts: 78 },
    oppPts: 92,
    opp: { fgm: 35, fga: 72, fg3m: 4, ftm: 18, fta: 21, orb: 6, drb: 37, tov: 6, ast: 27, pts: 92 },
  });
});

test('buildBoxscoreFromRows returns null when the target team has no row', () => {
  assert.strictEqual(buildBoxscoreFromRows([{ team: { id: 1 }, fgm: 1, fga: 1 }], '999'), null);
});
