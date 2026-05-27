// Unit tests for archetype ASSIGNMENT + DESCRIPTOR — synthetic vectors, no I/O. Locks: nearest-
// prototype matching, the distance threshold, the dimension-driven fallback (insufficient -> null;
// 2+ strong dims -> Versatile; exactly 1 -> Specialist; 0 -> Role Player), the reconciled descriptor
// (same dimensions as the fallback, so they can't contradict), modifiers, and confidence tiers.
// The known-PLAYER accuracy truth set (real fingerprints) is a separate live pre-ship gate.

process.env.NODE_ENV = 'test';

const { test } = require('node:test');
const assert = require('node:assert');

const { AXIS_KEYS } = require('../server/lib/analysis/playerFingerprint');
const { assignArchetype, confidenceFor, buildDescriptor } = require('../server/lib/analysis/archetypes');

// Build the 5-dimension array (buildDimensions shape) from value overrides; unspecified -> null.
function dimsOf(overrides) {
  return ['scoring', 'shooting', 'playmaking', 'rebounding', 'defense']
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

// A flat axis vector matches no prototype within the threshold -> forces the fallback path.
const NO_MATCH = axesWith(45);

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
});

test('assignArchetype — Floor General = pass-first PG (elite assists + low scoring volume)', () => {
  // Low scoring on purpose — the prototype ({playmaking H, scoringVolume L}) captures the pure
  // orchestrator (Vandersloot type) that a scoring-volume requirement used to exclude.
  const res = assignArchetype(fp(axesWith(40, { playmaking: 90 }), { pos: 'G' }));
  assert.strictEqual(res.archetype.key, 'floor-general');
});

test('assignArchetype — reports a runnerUp prototype', () => {
  const res = assignArchetype(fp(axesWith(50, {
    scoringVolume: 82, finishing: 84, threeAccuracy: 80, rimPressure: 78,
  })));
  assert.ok(res.runnerUp);
  assert.notStrictEqual(res.runnerUp.key, res.archetype.key);
});

test('assignArchetype — no prototype + 2+ strong dimensions => Versatile', () => {
  const res = assignArchetype(fp(NO_MATCH), dimsOf({ rebounding: 72, defense: 70 }));
  assert.strictEqual(res.archetype.key, 'versatile');
  assert.strictEqual(res.fallback, true);
});

test('assignArchetype — no prototype + exactly 1 strong dimension => Specialist named by it', () => {
  assert.strictEqual(assignArchetype(fp(NO_MATCH), dimsOf({ defense: 80 })).archetype.key, 'defensive-specialist');
  assert.strictEqual(assignArchetype(fp(NO_MATCH), dimsOf({ rebounding: 78 })).archetype.key, 'rebounding-specialist');
  assert.strictEqual(assignArchetype(fp(NO_MATCH), dimsOf({ shooting: 75 })).archetype.key, 'floor-spacer');
  assert.strictEqual(assignArchetype(fp(NO_MATCH), dimsOf({ playmaking: 81 })).archetype.key, 'playmaker');
  assert.strictEqual(assignArchetype(fp(NO_MATCH), dimsOf({ scoring: 70 })).archetype.key, 'volume-scorer');
});

test('assignArchetype — no prototype + no strong dimension => Role Player', () => {
  const res = assignArchetype(fp(NO_MATCH), dimsOf({ scoring: 50, defense: 55 }));
  assert.strictEqual(res.archetype.key, 'role-player');
  assert.strictEqual(res.fallback, true);
});

test('assignArchetype — modifiers are strengths only (axes >= ELITE), strongest first', () => {
  const res = assignArchetype(fp(axesWith(50, {
    scoringVolume: 95, finishing: 88, threeAccuracy: 80, rimPressure: 78, defRebounding: 40,
  })));
  assert.deepStrictEqual(res.modifiers.map(m => m.key), ['scoringVolume', 'finishing']);
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
  const bigProfile = axesWith(45, {
    threeVolume: 80, threeAccuracy: 80, defRebounding: 80, rimProtection: 55,
  });
  assert.strictEqual(assignArchetype(fp(bigProfile, { pos: 'F' })).archetype.key, 'stretch-big');
  // A guard can't be a Stretch Big — no guard prototype fits -> falls to a fallback label.
  const asGuard = assignArchetype(fp(bigProfile, { pos: 'G' }), dimsOf({ shooting: 75, rebounding: 70 }));
  assert.notStrictEqual(asGuard.archetype.key, 'stretch-big');
});

test('assignArchetype — rejects a prototype when the top dimension contradicts its theme', () => {
  // Axes match Slashing Creator, but the dimensions say this player is rebounding-dominant
  // (the Angel Reese case): a rebounder shouldn't read as a Slashing Creator.
  const axes = axesWith(45, { scoringVolume: 82, rimPressure: 82, playmaking: 80, threeVolume: 18 });
  const dims = dimsOf({ scoring: 60, rebounding: 95, defense: 66 });
  const res = assignArchetype(fp(axes, { pos: 'F' }), dims);
  assert.notStrictEqual(res.archetype.key, 'slashing-creator');
  assert.strictEqual(res.fallback, true);
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

// ── buildDescriptor (reads the same dimensions; takes the assignment) ──────────────────────────

test('buildDescriptor — Elite tier, top-3 strengths, real limitation (the AT shape)', () => {
  const dims = dimsOf({ playmaking: 89, rebounding: 75, defense: 70, scoring: 55, shooting: 8 });
  assert.strictEqual(
    buildDescriptor(dims, { archetype: { key: 'point-forward' } }),
    'Elite playmaking, rebounding, and defense, but rarely shoots from outside.',
  );
});

test('buildDescriptor — no limitation clause when nothing is genuinely low', () => {
  const dims = dimsOf({ scoring: 90, shooting: 70, playmaking: 66, rebounding: 50, defense: 55 });
  assert.strictEqual(
    buildDescriptor(dims, { archetype: { key: 'three-level-scorer' } }),
    'Elite scoring, outside shooting, and playmaking.',
  );
});

test('buildDescriptor — Solid tier when the top strength is modest', () => {
  const dims = dimsOf({ defense: 67, rebounding: 66, scoring: 45, shooting: 40, playmaking: 45 });
  assert.strictEqual(
    buildDescriptor(dims, { archetype: { key: 'interior-anchor' } }),
    'Solid defense and rebounding.',
  );
});

test('buildDescriptor — Specialist (1 strong dim) names that strength', () => {
  assert.strictEqual(
    buildDescriptor(dimsOf({ defense: 80, scoring: 40 }), { archetype: { key: 'defensive-specialist' }, fallback: true }),
    'Strong defense.',
  );
});

test('buildDescriptor — Role Player / flat profile has no standout', () => {
  const dims = dimsOf({ scoring: 50, shooting: 45, playmaking: 48, rebounding: 52, defense: 50 });
  assert.strictEqual(
    buildDescriptor(dims, { archetype: { key: 'role-player' }, fallback: true }),
    'Balanced contributor without a standout dimension.',
  );
});

test('buildDescriptor — Versatile names its top dimensions, no dominant skill', () => {
  const dims = dimsOf({ playmaking: 70, rebounding: 68, defense: 66, scoring: 60, shooting: 30 });
  assert.strictEqual(
    buildDescriptor(dims, { archetype: { key: 'versatile' }, fallback: true }),
    'Versatile across playmaking, rebounding, and defense with no single dominant skill.',
  );
});

test('buildDescriptor — a named prototype with no >=65 dim still names its top dim (no "no standout")', () => {
  // Consistency guard: a Three-Level Scorer match that's only modestly strong shouldn't read as
  // "Balanced... without a standout dimension".
  const dims = dimsOf({ scoring: 60, defense: 55, shooting: 50 });
  assert.strictEqual(
    buildDescriptor(dims, { archetype: { key: 'three-level-scorer' } }),
    'Solid scoring.',
  );
});

test('confidenceFor — tier boundaries', () => {
  assert.strictEqual(confidenceFor({ totalMinutes: 3000, seasonsCovered: 3 }), 'high');
  assert.strictEqual(confidenceFor({ totalMinutes: 3000, seasonsCovered: 2 }), 'medium');
  assert.strictEqual(confidenceFor({ totalMinutes: 1200, seasonsCovered: 1 }), 'medium');
  assert.strictEqual(confidenceFor({ totalMinutes: 1199, seasonsCovered: 9 }), 'low');
});
