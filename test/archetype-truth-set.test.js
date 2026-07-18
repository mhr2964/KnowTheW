// Known-player truth set — a pre-ship regression gate distinct from archetypes.test.js's synthetic
// logic-lock tests. archetypes.js documents this split explicitly: the truth set validates against
// REAL player data as a pre-ship gate, while archetypes.test.js locks the assignment LOGIC with
// hand-built axes. This file is that truth set, finally committed instead of a throwaway script.
//
// Each entry's axes/dimensions were captured once, by hand, from GET /players/:id/archetype against
// a running dev server on real cached fingerprints (position-pooled, per the HANDOFF trap) — not
// computed here. assignArchetype()/buildDimensions() are pure functions, so no ESPN/Mongo access is
// needed to replay them; this mirrors the inline-fixture convention used by
// gamelog-normalize.test.js and pbp-stats.test.js rather than introducing a fixtures/*.json file.
//
// AXES_VERSION guard: if the axis-building formula (playerFingerprint.js) ever changes, these
// captured numbers no longer represent what a live pipeline would produce. Rather than silently
// validating stale data, the whole suite skips with an explicit message telling a future session to
// re-capture against a live dev server.

process.env.NODE_ENV = 'test';

const { test } = require('node:test');
const assert = require('node:assert');

const { assignArchetype } = require('../server/lib/analysis/archetypes');
const { AXES_VERSION } = require('../server/lib/analysis/playerFingerprint');

// Re-captured 2026-07-17 after aggregateFingerprint switched to recency-decayed weighting
// (RECENCY_HALF_LIFE_YEARS=6, AXES_VERSION v3) — see playerFingerprint.js. Two players' expectKey
// changed from the prior capture, both reviewed as genuine improved fits, not regressions: Aliyah
// Boston (interior-anchor -> glass-cleaning-big, a close call between two defensible bigs archetypes
// for a 3-season career) and Sue Bird (playmaker -> floor-general, her low-scoring-volume playmaking
// profile now clears the Floor General prototype's threshold instead of falling to the generic
// fallback label).
const CAPTURED_AXES_VERSION = 3;

// [{name, axes, pos, seasonsCovered, totalMinutes, dimensions, expectKey?, notKey?}]
const TRUTH_SET = [
  {
    "name": "A'ja Wilson",
    "axes": { "scoringVolume": 97, "finishing": 83, "threeVolume": 16, "threeAccuracy": 56, "rimPressure": 99, "playmaking": 38, "ballSecurity": 68, "offRebounding": 76, "defRebounding": 95, "steals": 70, "rimProtection": 95, "ftShooting": 63, "workload": 86 },
    "pos": "C", "seasonsCovered": 8, "totalMinutes": 8332,
    "dimensions": [{ "key": "scoring", "value": 93 }, { "key": "shooting", "value": 45 }, { "key": "playmaking", "value": 35 }, { "key": "rebounding", "value": 86 }, { "key": "defense", "value": 86 }],
    "expectKey": "interior-anchor"
  },
  {
    "name": "Aliyah Boston",
    "axes": { "scoringVolume": 74, "finishing": 94, "threeVolume": 11, "threeAccuracy": 39, "rimPressure": 68, "playmaking": 59, "ballSecurity": 54, "offRebounding": 90, "defRebounding": 81, "steals": 54, "rimProtection": 83, "ftShooting": 33, "workload": 78 },
    "pos": "C", "seasonsCovered": 3, "totalMinutes": 3813,
    "dimensions": [{ "key": "scoring", "value": 79 }, { "key": "shooting", "value": 28 }, { "key": "playmaking", "value": 51 }, { "key": "rebounding", "value": 86 }, { "key": "defense", "value": 73 }],
    "expectKey": "glass-cleaning-big"
  },
  {
    "name": "Kamilla Cardoso",
    "axes": { "scoringVolume": 65, "finishing": 91, "threeVolume": 1, "threeAccuracy": 57, "rimPressure": 71, "playmaking": 36, "ballSecurity": 32, "offRebounding": 96, "defRebounding": 85, "steals": 2, "rimProtection": 89, "ftShooting": 27, "workload": 66 },
    "pos": "C", "seasonsCovered": 2, "totalMinutes": 1981,
    "dimensions": [{ "key": "scoring", "value": 76 }, { "key": "shooting", "value": 28 }, { "key": "playmaking", "value": 26 }, { "key": "rebounding", "value": 91 }, { "key": "defense", "value": 59 }],
    "expectKey": "interior-anchor"
  },
  {
    "name": "Shakira Austin",
    "axes": { "scoringVolume": 75, "finishing": 76, "threeVolume": 7, "threeAccuracy": 4, "rimPressure": 92, "playmaking": 24, "ballSecurity": 20, "offRebounding": 81, "defRebounding": 93, "steals": 67, "rimProtection": 88, "ftShooting": 12, "workload": 44 },
    "pos": "C", "seasonsCovered": 4, "totalMinutes": 2331,
    "dimensions": [{ "key": "scoring", "value": 81 }, { "key": "shooting", "value": 8 }, { "key": "playmaking", "value": 14 }, { "key": "rebounding", "value": 87 }, { "key": "defense", "value": 81 }],
    "expectKey": "interior-anchor"
  },
  {
    "name": "Kiah Stokes",
    "axes": { "scoringVolume": 3, "finishing": 48, "threeVolume": 20, "threeAccuracy": 10, "rimPressure": 11, "playmaking": 7, "ballSecurity": 90, "offRebounding": 72, "defRebounding": 93, "steals": 28, "rimProtection": 88, "ftShooting": 15, "workload": 35 },
    "pos": "C", "seasonsCovered": 10, "totalMinutes": 6019,
    "dimensions": [{ "key": "scoring", "value": 21 }, { "key": "shooting", "value": 15 }, { "key": "playmaking", "value": 7 }, { "key": "rebounding", "value": 83 }, { "key": "defense", "value": 67 }],
    "expectKey": "interior-anchor"
  },
  {
    "name": "Napheesa Collier",
    "axes": { "scoringVolume": 89, "finishing": 74, "threeVolume": 51, "threeAccuracy": 61, "rimPressure": 84, "playmaking": 75, "ballSecurity": 42, "offRebounding": 54, "defRebounding": 61, "steals": 82, "rimProtection": 76, "ftShooting": 75, "workload": 98 },
    "pos": "F", "seasonsCovered": 6, "totalMinutes": 6373,
    "dimensions": [{ "key": "scoring", "value": 82 }, { "key": "shooting", "value": 62 }, { "key": "playmaking", "value": 56 }, { "key": "rebounding", "value": 58 }, { "key": "defense", "value": 78 }],
    "expectKey": "two-way-forward"
  },
  {
    "name": "Natasha Howard",
    "axes": { "scoringVolume": 79, "finishing": 66, "threeVolume": 43, "threeAccuracy": 36, "rimPressure": 75, "playmaking": 54, "ballSecurity": 12, "offRebounding": 72, "defRebounding": 62, "steals": 79, "rimProtection": 73, "ftShooting": 41, "workload": 67 },
    "pos": "F", "seasonsCovered": 12, "totalMinutes": 8793,
    "dimensions": [{ "key": "scoring", "value": 73 }, { "key": "shooting", "value": 40 }, { "key": "playmaking", "value": 32 }, { "key": "rebounding", "value": 67 }, { "key": "defense", "value": 75 }],
    "expectKey": "two-way-forward"
  },
  {
    "name": "Dearica Hamby",
    "axes": { "scoringVolume": 72, "finishing": 71, "threeVolume": 36, "threeAccuracy": 47, "rimPressure": 83, "playmaking": 62, "ballSecurity": 28, "offRebounding": 51, "defRebounding": 73, "steals": 69, "rimProtection": 23, "ftShooting": 20, "workload": 74 },
    "pos": "F", "seasonsCovered": 11, "totalMinutes": 9125,
    "dimensions": [{ "key": "scoring", "value": 75 }, { "key": "shooting", "value": 34 }, { "key": "playmaking", "value": 42 }, { "key": "rebounding", "value": 62 }, { "key": "defense", "value": 39 }],
    "expectKey": "two-way-forward"
  },
  {
    "name": "Nneka Ogwumike",
    "axes": { "scoringVolume": 89, "finishing": 87, "threeVolume": 43, "threeAccuracy": 77, "rimPressure": 68, "playmaking": 58, "ballSecurity": 55, "offRebounding": 49, "defRebounding": 72, "steals": 80, "rimProtection": 43, "ftShooting": 76, "workload": 83 },
    "pos": "F", "seasonsCovered": 14, "totalMinutes": 13080,
    "dimensions": [{ "key": "scoring", "value": 81 }, { "key": "shooting", "value": 65 }, { "key": "playmaking", "value": 42 }, { "key": "rebounding", "value": 61 }, { "key": "defense", "value": 56 }],
    "expectKey": "two-way-forward"
  },
  {
    "name": "Breanna Stewart",
    "axes": { "scoringVolume": 96, "finishing": 56, "threeVolume": 77, "threeAccuracy": 62, "rimPressure": 96, "playmaking": 84, "ballSecurity": 57, "offRebounding": 27, "defRebounding": 88, "steals": 73, "rimProtection": 83, "ftShooting": 79, "workload": 92 },
    "pos": "F", "seasonsCovered": 9, "totalMinutes": 9490,
    "dimensions": [{ "key": "scoring", "value": 83 }, { "key": "shooting", "value": 73 }, { "key": "playmaking", "value": 68 }, { "key": "rebounding", "value": 58 }, { "key": "defense", "value": 80 }],
    "expectKey": "two-way-forward"
  },
  {
    "name": "Brittney Griner",
    "axes": { "scoringVolume": 91, "finishing": 94, "threeVolume": 10, "threeAccuracy": 36, "rimPressure": 85, "playmaking": 35, "ballSecurity": 36, "offRebounding": 67, "defRebounding": 84, "steals": 5, "rimProtection": 97, "ftShooting": 47, "workload": 75 },
    "pos": "C", "seasonsCovered": 12, "totalMinutes": 10375,
    "dimensions": [{ "key": "scoring", "value": 90 }, { "key": "shooting", "value": 31 }, { "key": "playmaking", "value": 22 }, { "key": "rebounding", "value": 76 }, { "key": "defense", "value": 65 }],
    "expectKey": "glass-cleaning-big"
  },
  {
    "name": "Jonquel Jones",
    "axes": { "scoringVolume": 83, "finishing": 87, "threeVolume": 59, "threeAccuracy": 76, "rimPressure": 73, "playmaking": 48, "ballSecurity": 23, "offRebounding": 85, "defRebounding": 95, "steals": 35, "rimProtection": 90, "ftShooting": 50, "workload": 64 },
    "pos": "C", "seasonsCovered": 9, "totalMinutes": 7844,
    "dimensions": [{ "key": "scoring", "value": 81 }, { "key": "shooting", "value": 62 }, { "key": "playmaking", "value": 32 }, { "key": "rebounding", "value": 90 }, { "key": "defense", "value": 71 }],
    "expectKey": "glass-cleaning-big"
  },
  {
    "name": "Sabrina Ionescu",
    "axes": { "scoringVolume": 87, "finishing": 47, "threeVolume": 91, "threeAccuracy": 46, "rimPressure": 73, "playmaking": 89, "ballSecurity": 14, "offRebounding": 67, "defRebounding": 92, "steals": 39, "rimProtection": 62, "ftShooting": 89, "workload": 82 },
    "pos": "G", "seasonsCovered": 5, "totalMinutes": 5610,
    "dimensions": [{ "key": "scoring", "value": 69 }, { "key": "shooting", "value": 75 }, { "key": "playmaking", "value": 79 }, { "key": "rebounding", "value": 80 }, { "key": "defense", "value": 47 }],
    "expectKey": "combo-guard"
  },
  {
    "name": "Kelsey Plum",
    "axes": { "scoringVolume": 83, "finishing": 70, "threeVolume": 76, "threeAccuracy": 73, "rimPressure": 74, "playmaking": 72, "ballSecurity": 36, "offRebounding": 14, "defRebounding": 30, "steals": 34, "rimProtection": 11, "ftShooting": 80, "workload": 83 },
    "pos": "G", "seasonsCovered": 8, "totalMinutes": 8277,
    "dimensions": [{ "key": "scoring", "value": 76 }, { "key": "shooting", "value": 76 }, { "key": "playmaking", "value": 66 }, { "key": "rebounding", "value": 22 }, { "key": "defense", "value": 26 }],
    "expectKey": "three-level-scorer"
  },
  {
    "name": "Kelsey Mitchell",
    "axes": { "scoringVolume": 92, "finishing": 74, "threeVolume": 80, "threeAccuracy": 78, "rimPressure": 73, "playmaking": 35, "ballSecurity": 57, "offRebounding": 29, "defRebounding": 5, "steals": 19, "rimProtection": 22, "ftShooting": 51, "workload": 84 },
    "pos": "G", "seasonsCovered": 8, "totalMinutes": 8469,
    "dimensions": [{ "key": "scoring", "value": 80 }, { "key": "shooting", "value": 70 }, { "key": "playmaking", "value": 34 }, { "key": "rebounding", "value": 17 }, { "key": "defense", "value": 20 }],
    "expectKey": "three-level-scorer"
  },
  {
    "name": "Kayla McBride",
    "axes": { "scoringVolume": 76, "finishing": 60, "threeVolume": 72, "threeAccuracy": 73, "rimPressure": 71, "playmaking": 29, "ballSecurity": 71, "offRebounding": 28, "defRebounding": 48, "steals": 52, "rimProtection": 20, "ftShooting": 84, "workload": 81 },
    "pos": "G", "seasonsCovered": 12, "totalMinutes": 11335,
    "dimensions": [{ "key": "scoring", "value": 69 }, { "key": "shooting", "value": 76 }, { "key": "playmaking", "value": 32 }, { "key": "rebounding", "value": 38 }, { "key": "defense", "value": 41 }],
    "expectKey": "three-level-scorer"
  },
  {
    "name": "Paige Bueckers",
    "axes": { "scoringVolume": 96, "finishing": 96, "threeVolume": 12, "threeAccuracy": 37, "rimPressure": 84, "playmaking": 82, "ballSecurity": 57, "offRebounding": 52, "defRebounding": 58, "steals": 84, "rimProtection": 80, "ftShooting": 88, "workload": 92 },
    "pos": "G", "seasonsCovered": 1, "totalMinutes": 1199,
    "dimensions": [{ "key": "scoring", "value": 92 }, { "key": "shooting", "value": 46 }, { "key": "playmaking", "value": 87 }, { "key": "rebounding", "value": 55 }, { "key": "defense", "value": 83 }],
    "expectKey": "slashing-creator"
  },
  {
    "name": "Chennedy Carter",
    "axes": { "scoringVolume": 96, "finishing": 92, "threeVolume": 3, "threeAccuracy": 23, "rimPressure": 91, "playmaking": 58, "ballSecurity": 34, "offRebounding": 60, "defRebounding": 54, "steals": 52, "rimProtection": 53, "ftShooting": 29, "workload": 47 },
    "pos": "G", "seasonsCovered": 4, "totalMinutes": 1939,
    "dimensions": [{ "key": "scoring", "value": 93 }, { "key": "shooting", "value": 18 }, { "key": "playmaking", "value": 48 }, { "key": "rebounding", "value": 57 }, { "key": "defense", "value": 52 }],
    "expectKey": "slashing-creator"
  },
  {
    "name": "Alyssa Thomas",
    "axes": { "scoringVolume": 62, "finishing": 73, "threeVolume": 6, "threeAccuracy": 2, "rimPressure": 80, "playmaking": 93, "ballSecurity": 13, "offRebounding": 57, "defRebounding": 76, "steals": 84, "rimProtection": 27, "ftShooting": 23, "workload": 89 },
    "pos": "F", "seasonsCovered": 11, "totalMinutes": 10946,
    "dimensions": [{ "key": "scoring", "value": 72 }, { "key": "shooting", "value": 10 }, { "key": "playmaking", "value": 77 }, { "key": "rebounding", "value": 67 }, { "key": "defense", "value": 47 }],
    "expectKey": "point-forward"
  },
  {
    "name": "Sue Bird",
    "axes": { "scoringVolume": 46, "finishing": 67, "threeVolume": 73, "threeAccuracy": 79, "rimPressure": 16, "playmaking": 91, "ballSecurity": 42, "offRebounding": 7, "defRebounding": 28, "steals": 50, "rimProtection": 26, "ftShooting": 59, "workload": 76 },
    "pos": "G", "seasonsCovered": 19, "totalMinutes": 18081,
    "dimensions": [{ "key": "scoring", "value": 43 }, { "key": "shooting", "value": 70 }, { "key": "playmaking", "value": 85 }, { "key": "rebounding", "value": 18 }, { "key": "defense", "value": 42 }],
    "expectKey": "floor-general"
  },
  {
    "name": "Courtney Vandersloot",
    "axes": { "scoringVolume": 45, "finishing": 82, "threeVolume": 33, "threeAccuracy": 49, "rimPressure": 42, "playmaking": 98, "ballSecurity": 14, "offRebounding": 42, "defRebounding": 66, "steals": 71, "rimProtection": 81, "ftShooting": 42, "workload": 70 },
    "pos": "G", "seasonsCovered": 14, "totalMinutes": 12020,
    "dimensions": [{ "key": "scoring", "value": 56 }, { "key": "shooting", "value": 41 }, { "key": "playmaking", "value": 93 }, { "key": "rebounding", "value": 54 }, { "key": "defense", "value": 75 }],
    "expectKey": "playmaker"
  },
  {
    "name": "Angel Reese",
    "axes": { "scoringVolume": 68, "finishing": 30, "threeVolume": 15, "threeAccuracy": 18, "rimPressure": 95, "playmaking": 54, "ballSecurity": 13, "offRebounding": 98, "defRebounding": 98, "steals": 63, "rimProtection": 44, "ftShooting": 43, "workload": 92 },
    "pos": "F", "seasonsCovered": 2, "totalMinutes": 2053,
    "dimensions": [{ "key": "scoring", "value": 64 }, { "key": "shooting", "value": 25 }, { "key": "playmaking", "value": 34 }, { "key": "rebounding", "value": 98 }, { "key": "defense", "value": 51 }],
    "expectKey": "rebounding-specialist"
  },
  {
    "name": "Chelsea Gray",
    "axes": { "scoringVolume": 60, "finishing": 83, "threeVolume": 31, "threeAccuracy": 69, "rimPressure": 49, "playmaking": 87, "ballSecurity": 21, "offRebounding": 31, "defRebounding": 64, "steals": 70, "rimProtection": 65, "ftShooting": 76, "workload": 77 },
    "pos": "G", "seasonsCovered": 11, "totalMinutes": 10426,
    "dimensions": [{ "key": "scoring", "value": 64 }, { "key": "shooting", "value": 59 }, { "key": "playmaking", "value": 79 }, { "key": "rebounding", "value": 48 }, { "key": "defense", "value": 68 }],
    "notKey": "three-level-scorer"
  },
  {
    "name": "Rhyne Howard",
    "axes": { "scoringVolume": 83, "finishing": 23, "threeVolume": 91, "threeAccuracy": 44, "rimPressure": 82, "playmaking": 45, "ballSecurity": 75, "offRebounding": 62, "defRebounding": 75, "steals": 79, "rimProtection": 90, "ftShooting": 45, "workload": 93 },
    "pos": "G", "seasonsCovered": 4, "totalMinutes": 4520,
    "dimensions": [{ "key": "scoring", "value": 63 }, { "key": "shooting", "value": 60 }, { "key": "playmaking", "value": 52 }, { "key": "rebounding", "value": 69 }, { "key": "defense", "value": 83 }],
    "notKey": "combo-guard"
  },
];

const shouldRun = AXES_VERSION === CAPTURED_AXES_VERSION;
const skipMsg = shouldRun ? false
  : `AXES_VERSION changed from ${CAPTURED_AXES_VERSION} to ${AXES_VERSION} — re-capture the truth-set fixture against a live dev server before trusting this test again`;

for (const player of TRUTH_SET) {
  const label = player.expectKey
    ? `truth set — ${player.name} assigns ${player.expectKey}`
    : `truth set — ${player.name} does not assign ${player.notKey}`;

  test(label, { skip: skipMsg }, () => {
    const fingerprint = { axes: player.axes, pos: player.pos, seasonsCovered: player.seasonsCovered, totalMinutes: player.totalMinutes };
    const result = assignArchetype(fingerprint, player.dimensions);
    if (player.expectKey) {
      assert.strictEqual(result.archetype?.key, player.expectKey);
    } else {
      assert.notStrictEqual(result.archetype?.key, player.notKey);
    }
  });
}
