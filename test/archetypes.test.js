// Unit tests for archetype ASSIGNMENT LOGIC — synthetic axis vectors, no I/O. Locks: nearest-
// prototype matching, the distance threshold, the tiered fallback (insufficient -> null; elevated
// -> Versatile; flat -> Role Player), strengths-only trait modifiers, and confidence tiers.
//
// These are calibrated to ASSIGN_MAX_DISTANCE; vectors are built with comfortable margin so a small
// re-tune of the threshold won't flip them. The known-PLAYER accuracy truth set (real fingerprints,
// incl. Alyssa Thomas) is a separate live pre-ship gate.

process.env.NODE_ENV = 'test';

const { test } = require('node:test');
const assert = require('node:assert');

const { AXIS_KEYS } = require('../server/lib/analysis/playerFingerprint');
const { assignArchetype, confidenceFor } = require('../server/lib/analysis/archetypes');

// Full axis vector at a base level, with overrides — so a partial spec means "average elsewhere".
function axesWith(base, overrides = {}) {
  const axes = {};
  for (const key of AXIS_KEYS) axes[key] = base;
  return { ...axes, ...overrides };
}

// Wrap axes as a buildFingerprint-shaped result (high confidence unless overridden).
function fp(axes, extra = {}) {
  return { axes, totalMinutes: 4000, seasonsCovered: 5, ...extra };
}

test('assignArchetype — matches the nearest prototype when close on its defining axes', () => {
  const res = assignArchetype(fp(axesWith(50, {
    scoringVolume: 82, finishing: 84, threeAccuracy: 80, rimPressure: 78,
  })));
  assert.strictEqual(res.archetype.key, 'three-level-scorer');
  assert.strictEqual(res.fallback, false);
});

test('assignArchetype — Glass-Cleaning Big from rebounding + rim signature', () => {
  const res = assignArchetype(fp(axesWith(50, {
    offRebounding: 80, defRebounding: 82, rimProtection: 80, rimPressure: 78, threeVolume: 18,
  })));
  assert.strictEqual(res.archetype.key, 'glass-cleaning-big');
  assert.strictEqual(res.fallback, false);
});

test('assignArchetype — Floor General from playmaking + ball security + workload', () => {
  const res = assignArchetype(fp(axesWith(50, {
    playmaking: 82, ballSecurity: 80, workload: 80, scoringVolume: 55,
  })));
  assert.strictEqual(res.archetype.key, 'floor-general');
});

test('assignArchetype — reports a runnerUp prototype', () => {
  const res = assignArchetype(fp(axesWith(50, {
    scoringVolume: 82, finishing: 84, threeAccuracy: 80, rimPressure: 78,
  })));
  assert.ok(res.runnerUp);
  assert.notStrictEqual(res.runnerUp.key, res.archetype.key);
  assert.strictEqual(typeof res.runnerUp.distance, 'number');
});

test('assignArchetype — no prototype fits + multiple strengths => Versatile (earned)', () => {
  // Unusual strong trio (off-glass + steals + FT shooting) that no single prototype groups.
  const res = assignArchetype(fp(axesWith(45, {
    offRebounding: 72, steals: 72, ftShooting: 72,
  })));
  assert.strictEqual(res.archetype.key, 'versatile');
  assert.strictEqual(res.fallback, true);
});

test('assignArchetype — no prototype fits + flat/low profile => Role Player (not Versatile)', () => {
  const res = assignArchetype(fp(axesWith(45))); // nothing elevated, nothing close
  assert.strictEqual(res.archetype.key, 'role-player');
  assert.strictEqual(res.fallback, true);
});

test('assignArchetype — modifiers are strengths only (axes >= ELITE), strongest first', () => {
  const res = assignArchetype(fp(axesWith(50, {
    scoringVolume: 95, finishing: 88, threeAccuracy: 80, rimPressure: 78, defRebounding: 40,
  })));
  const keys = res.modifiers.map(m => m.key);
  assert.deepStrictEqual(keys, ['scoringVolume', 'finishing']); // 95 then 88; 40 never appears
  assert.ok(res.modifiers.every(m => typeof m.label === 'string'));
});

test('assignArchetype — insufficient sample yields no badge, carries the reason', () => {
  assert.deepStrictEqual(
    assignArchetype({ insufficient: true, reason: 'sample' }),
    { archetype: null, reason: 'sample' },
  );
  assert.strictEqual(assignArchetype({}).archetype, null);
  assert.strictEqual(assignArchetype().reason, 'no-data');
});

test('assignArchetype — confidence comes from sample size', () => {
  const axes = axesWith(50, { scoringVolume: 82, finishing: 84, threeAccuracy: 80, rimPressure: 78 });
  assert.strictEqual(assignArchetype(fp(axes, { totalMinutes: 4000, seasonsCovered: 5 })).confidence, 'high');
  assert.strictEqual(assignArchetype(fp(axes, { totalMinutes: 1500, seasonsCovered: 2 })).confidence, 'medium');
  assert.strictEqual(assignArchetype(fp(axes, { totalMinutes: 600, seasonsCovered: 1 })).confidence, 'low');
});

test('confidenceFor — tier boundaries', () => {
  assert.strictEqual(confidenceFor({ totalMinutes: 3000, seasonsCovered: 3 }), 'high');
  assert.strictEqual(confidenceFor({ totalMinutes: 3000, seasonsCovered: 2 }), 'medium'); // needs 3+ seasons
  assert.strictEqual(confidenceFor({ totalMinutes: 1200, seasonsCovered: 1 }), 'medium');
  assert.strictEqual(confidenceFor({ totalMinutes: 1199, seasonsCovered: 9 }), 'low');
});
