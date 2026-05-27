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
const { assignArchetype, confidenceFor, buildDescriptor } = require('../server/lib/analysis/archetypes');

// Build a 6-dimension array (buildDimensions shape) from value overrides; unspecified -> null.
function dimsOf(overrides) {
  return ['scoring', 'shooting', 'playmaking', 'rebounding', 'defense', 'activity']
    .map(key => ({ key, value: key in overrides ? overrides[key] : null }));
}

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

test('assignArchetype — position gates out cross-position prototypes', () => {
  // A big-shaped profile (3pt vol + rebounding + rim protection) that matches Stretch Big.
  const bigProfile = axesWith(45, {
    threeVolume: 80, threeAccuracy: 80, defRebounding: 80, rimProtection: 55,
  });
  // As a forward/center it reads Stretch Big...
  assert.strictEqual(assignArchetype(fp(bigProfile, { pos: 'F' })).archetype.key, 'stretch-big');
  // ...but a guard can never be a Stretch Big — it must land on a guard-eligible archetype instead.
  assert.notStrictEqual(assignArchetype(fp(bigProfile, { pos: 'G' })).archetype.key, 'stretch-big');
});

test('assignArchetype — Point Forward for a playmaking + rebounding forward (the AT shape)', () => {
  const res = assignArchetype(fp(axesWith(45, {
    playmaking: 89, defRebounding: 72, steals: 84, scoringVolume: 60, rimPressure: 82, threeVolume: 9,
  }), { pos: 'F' }));
  assert.strictEqual(res.archetype.key, 'point-forward');
});

test('assignArchetype — Combo Guard for a scoring + playmaking + shooting guard (the Ionescu shape)', () => {
  const res = assignArchetype(fp(axesWith(45, {
    scoringVolume: 80, playmaking: 89, threeVolume: 90, threeAccuracy: 75, ftShooting: 89,
  }), { pos: 'G' }));
  assert.strictEqual(res.archetype.key, 'combo-guard');
});

test('buildDescriptor — Elite tier, top-3 strengths, real limitation (the AT shape)', () => {
  const dims = dimsOf({ playmaking: 89, rebounding: 75, defense: 70, scoring: 55, shooting: 8, activity: 86 });
  assert.strictEqual(
    buildDescriptor(dims, { key: 'point-forward' }),
    'Elite playmaking, rebounding, and defense, but rarely shoots from outside.',
  );
});

test('buildDescriptor — no limitation clause when nothing is genuinely low', () => {
  const dims = dimsOf({ scoring: 90, shooting: 70, playmaking: 66, rebounding: 50, defense: 55, activity: 80 });
  assert.strictEqual(
    buildDescriptor(dims, { key: 'three-level-scorer' }),
    'Elite scoring, outside shooting, and playmaking.',
  );
});

test('buildDescriptor — Solid tier when the top strength is modest', () => {
  const dims = dimsOf({ defense: 67, rebounding: 66, scoring: 45, shooting: 40, playmaking: 45, activity: 60 });
  assert.strictEqual(buildDescriptor(dims, { key: 'interior-anchor' }), 'Solid defense and rebounding.');
});

test('buildDescriptor — Role Player / flat profile has no standout', () => {
  const dims = dimsOf({ scoring: 50, shooting: 45, playmaking: 48, rebounding: 52, defense: 50, activity: 55 });
  assert.strictEqual(
    buildDescriptor(dims, { key: 'role-player' }),
    'Balanced contributor without a standout dimension.',
  );
});

test('buildDescriptor — Versatile names its top dimensions, no dominant skill', () => {
  const dims = dimsOf({ playmaking: 70, rebounding: 68, defense: 66, scoring: 60, shooting: 30, activity: 50 });
  assert.strictEqual(
    buildDescriptor(dims, { key: 'versatile' }),
    'Versatile across playmaking, rebounding, and defense with no single dominant skill.',
  );
});

test('confidenceFor — tier boundaries', () => {
  assert.strictEqual(confidenceFor({ totalMinutes: 3000, seasonsCovered: 3 }), 'high');
  assert.strictEqual(confidenceFor({ totalMinutes: 3000, seasonsCovered: 2 }), 'medium'); // needs 3+ seasons
  assert.strictEqual(confidenceFor({ totalMinutes: 1200, seasonsCovered: 1 }), 'medium');
  assert.strictEqual(confidenceFor({ totalMinutes: 1199, seasonsCovered: 9 }), 'low');
});
