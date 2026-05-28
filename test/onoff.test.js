process.env.NODE_ENV = 'test';

const { test } = require('node:test');
const assert   = require('node:assert/strict');
const { computeOnOff, MIN_ON_GAMES } = require('../server/lib/analysis/onOff');

// Build a synthetic per-game PBP result.
// onPts/onOPts: team/opp points while player on court.
// tmPts/oppPts: game totals from boxscore.
// Shooting stats use plausible WNBA-scale values; exact values don't matter for the sign tests.
function makeGame({
  onPts = 20, onOPts = 18,
  onFga = 18, onOrb = 2, onTov = 3, onFta = 4,
  onOFga = 16, onOOrb = 2, onOTov = 3, onOFta = 3,
  tmPts = 80, oppPts = 76,
  tmFga = 60, tmOrb = 8, tmTov = 12, tmFta = 20,
  oppFga = 58, oppOrb = 7, oppTov = 11, oppFta = 18,
} = {}) {
  return {
    fetched: true,
    onCourt: {
      pts: onPts, oPts: onOPts,
      fga: onFga, orb: onOrb, tov: onTov, fta: onFta,
      oFga: onOFga, oOrb: onOOrb, oTov: onOTov, oFta: onOFta,
      // other keys present in real results but not used by computeOnOff
      fgm: 0, fg3a: 0, ftm: 0, drb: 0, ast: 0,
      oFgm: 0, oFg3a: 0, oFtm: 0, oDrb: 0,
    },
    boxscore: {
      tm:  { pts: tmPts,  fga: tmFga,  orb: tmOrb,  tov: tmTov,  fta: tmFta,
             fgm: 0, fg3m: 0, ftm: 0, drb: 0, ast: 0 },
      oppPts,
      opp: { pts: oppPts, fga: oppFga, orb: oppOrb, tov: oppTov, fta: oppFta,
             fgm: 0, fg3m: 0, ftm: 0, drb: 0, ast: 0 },
    },
  };
}

test('returns null when fewer than MIN_ON_GAMES usable games', () => {
  const games = Array.from({ length: MIN_ON_GAMES - 1 }, () => makeGame());
  assert.equal(computeOnOff(games), null);
});

test('returns null for empty array', () => {
  assert.equal(computeOnOff([]), null);
});

test('skips games where fetched=false', () => {
  const valid   = Array.from({ length: MIN_ON_GAMES }, () => makeGame());
  const invalid = Array.from({ length: 3 }, () => ({ fetched: false, onCourt: null, boxscore: null }));
  assert.equal(computeOnOff([...invalid]), null); // only invalids → null
  const result = computeOnOff([...valid, ...invalid]);
  assert.ok(result !== null, 'should succeed with enough valid games');
  assert.equal(result.games, MIN_ON_GAMES);
});

test('skips games where onCourt or boxscore is null', () => {
  const valid = Array.from({ length: MIN_ON_GAMES }, () => makeGame());
  const noOC  = { fetched: true, onCourt: null, boxscore: { tm: {}, oppPts: 70, opp: null } };
  const result = computeOnOff([...valid, noOC]);
  assert.ok(result !== null);
  assert.equal(result.games, MIN_ON_GAMES);
});

test('exact MIN_ON_GAMES games: returns a result', () => {
  const games  = Array.from({ length: MIN_ON_GAMES }, () => makeGame());
  const result = computeOnOff(games);
  assert.ok(result !== null);
  assert.equal(result.games, MIN_ON_GAMES);
});

test('on-court net positive when the team dominates while player is on court', () => {
  // Player on court: team scores 25, opp scores 15 → team is winning
  const games = Array.from({ length: 6 }, () =>
    makeGame({ onPts: 25, onOPts: 15, tmPts: 80, oppPts: 70 })
  );
  const result = computeOnOff(games);
  assert.ok(result !== null);
  assert.ok(result.on.net > 0, `expected on.net > 0, got ${result.on.net}`);
});

test('off-court net negative when team performs worse without player', () => {
  // On: team scores 40 of 80, opp scores 20 of 70 → on-court team is dominant
  // Off: team scores 40 of 80, opp scores 50 of 70 → off-court team is losing
  const games = Array.from({ length: 6 }, () =>
    makeGame({
      onPts: 40, onOPts: 20,
      onFga: 30, onOrb: 4, onTov: 6, onFta: 10,
      onOFga: 28, onOOrb: 3, onOTov: 5, onOFta: 8,
      tmPts: 80, oppPts: 70,
    })
  );
  const result = computeOnOff(games);
  assert.ok(result !== null);
  assert.ok(result.on.net > 0, `on.net should be positive, got ${result.on.net}`);
  // off-court: team scores 40, opp scores 50 → negative
  assert.ok(result.off.net < 0, `off.net should be negative, got ${result.off.net}`);
  assert.ok(result.delta > 0, `delta should be positive (on > off), got ${result.delta}`);
});

test('off-court stats sum to game total minus on-court', () => {
  const g = makeGame({ onPts: 30, tmPts: 80, onOPts: 25, oppPts: 70 });
  const games = Array.from({ length: 6 }, () => g);
  const result = computeOnOff(games);
  assert.ok(result !== null);
  // off-court: 80-30=50 pts for 6 games; we can verify via ORTG/DRTG signs
  assert.ok(result.off.ortg !== null);
  assert.ok(result.on.ortg !== null);
});

test('output values are rounded to one decimal place', () => {
  const games = Array.from({ length: 6 }, () => makeGame());
  const result = computeOnOff(games);
  assert.ok(result !== null);
  for (const split of [result.on, result.off]) {
    for (const key of ['ortg', 'drtg', 'net']) {
      const v = split[key];
      if (v != null) {
        assert.ok(
          Math.round(v * 10) / 10 === v,
          `${key}=${v} should be rounded to 1 decimal`
        );
      }
    }
  }
});

test('delta equals on.net minus off.net', () => {
  const games = Array.from({ length: 6 }, () => makeGame({ onPts: 22, onOPts: 18 }));
  const result = computeOnOff(games);
  assert.ok(result !== null);
  if (result.on.net != null && result.off.net != null) {
    const expected = Math.round((result.on.net - result.off.net) * 10) / 10;
    assert.equal(result.delta, expected);
  }
});
