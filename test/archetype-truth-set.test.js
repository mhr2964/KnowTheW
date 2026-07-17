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

// Captured 2026-07-17 against master (post archetype-tuning commits 1099ca4/779949c/44cb40f), from
// a live dev server sweep at commit d6062c1.
const CAPTURED_AXES_VERSION = 2;

// [{name, axes, pos, seasonsCovered, totalMinutes, dimensions, expectKey?, notKey?}]
const TRUTH_SET = [
  {
    "name": "A'ja Wilson",
    "axes": { "scoringVolume": 97, "finishing": 81, "threeVolume": 14, "threeAccuracy": 50, "rimPressure": 99, "playmaking": 38, "ballSecurity": 69, "offRebounding": 76, "defRebounding": 94, "steals": 63, "rimProtection": 95, "ftShooting": 60, "workload": 85 },
    "pos": "C", "seasonsCovered": 8, "totalMinutes": 8332,
    "dimensions": [{ "key": "scoring", "value": 92 }, { "key": "shooting", "value": 41 }, { "key": "playmaking", "value": 35 }, { "key": "rebounding", "value": 85 }, { "key": "defense", "value": 84 }],
    "expectKey": "interior-anchor"
  },
  {
    "name": "Aliyah Boston",
    "axes": { "scoringVolume": 74, "finishing": 94, "threeVolume": 12, "threeAccuracy": 42, "rimPressure": 68, "playmaking": 58, "ballSecurity": 54, "offRebounding": 91, "defRebounding": 80, "steals": 55, "rimProtection": 83, "ftShooting": 32, "workload": 78 },
    "pos": "C", "seasonsCovered": 3, "totalMinutes": 3813,
    "dimensions": [{ "key": "scoring", "value": 79 }, { "key": "shooting", "value": 29 }, { "key": "playmaking", "value": 51 }, { "key": "rebounding", "value": 86 }, { "key": "defense", "value": 73 }],
    "expectKey": "interior-anchor"
  },
  {
    "name": "Kamilla Cardoso",
    "axes": { "scoringVolume": 64, "finishing": 91, "threeVolume": 1, "threeAccuracy": 55, "rimPressure": 71, "playmaking": 35, "ballSecurity": 34, "offRebounding": 96, "defRebounding": 85, "steals": 2, "rimProtection": 89, "ftShooting": 27, "workload": 66 },
    "pos": "C", "seasonsCovered": 2, "totalMinutes": 1981,
    "dimensions": [{ "key": "scoring", "value": 75 }, { "key": "shooting", "value": 28 }, { "key": "playmaking", "value": 26 }, { "key": "rebounding", "value": 91 }, { "key": "defense", "value": 59 }],
    "expectKey": "interior-anchor"
  },
  {
    "name": "Shakira Austin",
    "axes": { "scoringVolume": 72, "finishing": 77, "threeVolume": 6, "threeAccuracy": 4, "rimPressure": 92, "playmaking": 21, "ballSecurity": 23, "offRebounding": 82, "defRebounding": 93, "steals": 65, "rimProtection": 88, "ftShooting": 12, "workload": 43 },
    "pos": "C", "seasonsCovered": 4, "totalMinutes": 2331,
    "dimensions": [{ "key": "scoring", "value": 80 }, { "key": "shooting", "value": 7 }, { "key": "playmaking", "value": 13 }, { "key": "rebounding", "value": 88 }, { "key": "defense", "value": 80 }],
    "expectKey": "interior-anchor"
  },
  {
    "name": "Kiah Stokes",
    "axes": { "scoringVolume": 5, "finishing": 60, "threeVolume": 18, "threeAccuracy": 8, "rimPressure": 16, "playmaking": 8, "ballSecurity": 87, "offRebounding": 76, "defRebounding": 92, "steals": 25, "rimProtection": 90, "ftShooting": 16, "workload": 40 },
    "pos": "C", "seasonsCovered": 10, "totalMinutes": 6019,
    "dimensions": [{ "key": "scoring", "value": 27 }, { "key": "shooting", "value": 14 }, { "key": "playmaking", "value": 8 }, { "key": "rebounding", "value": 84 }, { "key": "defense", "value": 67 }],
    "expectKey": "interior-anchor"
  },
  {
    "name": "Napheesa Collier",
    "axes": { "scoringVolume": 86, "finishing": 73, "threeVolume": 50, "threeAccuracy": 60, "rimPressure": 82, "playmaking": 75, "ballSecurity": 42, "offRebounding": 53, "defRebounding": 58, "steals": 81, "rimProtection": 74, "ftShooting": 73, "workload": 98 },
    "pos": "F", "seasonsCovered": 6, "totalMinutes": 6373,
    "dimensions": [{ "key": "scoring", "value": 80 }, { "key": "shooting", "value": 61 }, { "key": "playmaking", "value": 56 }, { "key": "rebounding", "value": 56 }, { "key": "defense", "value": 76 }],
    "expectKey": "two-way-forward"
  },
  {
    "name": "Natasha Howard",
    "axes": { "scoringVolume": 77, "finishing": 65, "threeVolume": 44, "threeAccuracy": 36, "rimPressure": 74, "playmaking": 50, "ballSecurity": 13, "offRebounding": 74, "defRebounding": 59, "steals": 80, "rimProtection": 77, "ftShooting": 39, "workload": 62 },
    "pos": "F", "seasonsCovered": 12, "totalMinutes": 8793,
    "dimensions": [{ "key": "scoring", "value": 72 }, { "key": "shooting", "value": 40 }, { "key": "playmaking", "value": 30 }, { "key": "rebounding", "value": 67 }, { "key": "defense", "value": 78 }],
    "expectKey": "two-way-forward"
  },
  {
    "name": "Dearica Hamby",
    "axes": { "scoringVolume": 68, "finishing": 66, "threeVolume": 38, "threeAccuracy": 49, "rimPressure": 82, "playmaking": 57, "ballSecurity": 30, "offRebounding": 54, "defRebounding": 72, "steals": 65, "rimProtection": 25, "ftShooting": 21, "workload": 69 },
    "pos": "F", "seasonsCovered": 11, "totalMinutes": 9125,
    "dimensions": [{ "key": "scoring", "value": 72 }, { "key": "shooting", "value": 36 }, { "key": "playmaking", "value": 39 }, { "key": "rebounding", "value": 63 }, { "key": "defense", "value": 39 }],
    "expectKey": "two-way-forward"
  },
  {
    "name": "Nneka Ogwumike",
    "axes": { "scoringVolume": 88, "finishing": 89, "threeVolume": 41, "threeAccuracy": 72, "rimPressure": 73, "playmaking": 58, "ballSecurity": 54, "offRebounding": 56, "defRebounding": 75, "steals": 81, "rimProtection": 48, "ftShooting": 75, "workload": 82 },
    "pos": "F", "seasonsCovered": 14, "totalMinutes": 13080,
    "dimensions": [{ "key": "scoring", "value": 83 }, { "key": "shooting", "value": 63 }, { "key": "playmaking", "value": 42 }, { "key": "rebounding", "value": 66 }, { "key": "defense", "value": 60 }],
    "expectKey": "two-way-forward"
  },
  {
    "name": "Breanna Stewart",
    "axes": { "scoringVolume": 96, "finishing": 58, "threeVolume": 79, "threeAccuracy": 66, "rimPressure": 96, "playmaking": 84, "ballSecurity": 52, "offRebounding": 26, "defRebounding": 90, "steals": 71, "rimProtection": 84, "ftShooting": 76, "workload": 93 },
    "pos": "F", "seasonsCovered": 9, "totalMinutes": 9490,
    "dimensions": [{ "key": "scoring", "value": 83 }, { "key": "shooting", "value": 74 }, { "key": "playmaking", "value": 68 }, { "key": "rebounding", "value": 58 }, { "key": "defense", "value": 79 }],
    "expectKey": "two-way-forward"
  },
  {
    "name": "Brittney Griner",
    "axes": { "scoringVolume": 91, "finishing": 94, "threeVolume": 8, "threeAccuracy": 27, "rimPressure": 86, "playmaking": 33, "ballSecurity": 36, "offRebounding": 67, "defRebounding": 85, "steals": 6, "rimProtection": 98, "ftShooting": 49, "workload": 79 },
    "pos": "C", "seasonsCovered": 12, "totalMinutes": 10375,
    "dimensions": [{ "key": "scoring", "value": 90 }, { "key": "shooting", "value": 28 }, { "key": "playmaking", "value": 21 }, { "key": "rebounding", "value": 76 }, { "key": "defense", "value": 66 }],
    "expectKey": "glass-cleaning-big"
  },
  {
    "name": "Jonquel Jones",
    "axes": { "scoringVolume": 84, "finishing": 86, "threeVolume": 58, "threeAccuracy": 75, "rimPressure": 76, "playmaking": 44, "ballSecurity": 28, "offRebounding": 88, "defRebounding": 93, "steals": 39, "rimProtection": 91, "ftShooting": 48, "workload": 63 },
    "pos": "C", "seasonsCovered": 9, "totalMinutes": 7844,
    "dimensions": [{ "key": "scoring", "value": 82 }, { "key": "shooting", "value": 60 }, { "key": "playmaking", "value": 30 }, { "key": "rebounding", "value": 91 }, { "key": "defense", "value": 73 }],
    "expectKey": "glass-cleaning-big"
  },
  {
    "name": "Sabrina Ionescu",
    "axes": { "scoringVolume": 85, "finishing": 46, "threeVolume": 90, "threeAccuracy": 47, "rimPressure": 72, "playmaking": 89, "ballSecurity": 13, "offRebounding": 67, "defRebounding": 92, "steals": 37, "rimProtection": 62, "ftShooting": 88, "workload": 81 },
    "pos": "G", "seasonsCovered": 5, "totalMinutes": 5610,
    "dimensions": [{ "key": "scoring", "value": 68 }, { "key": "shooting", "value": 75 }, { "key": "playmaking", "value": 79 }, { "key": "rebounding", "value": 80 }, { "key": "defense", "value": 46 }],
    "expectKey": "combo-guard"
  },
  {
    "name": "Kelsey Plum",
    "axes": { "scoringVolume": 78, "finishing": 67, "threeVolume": 74, "threeAccuracy": 75, "rimPressure": 69, "playmaking": 72, "ballSecurity": 39, "offRebounding": 18, "defRebounding": 32, "steals": 34, "rimProtection": 14, "ftShooting": 79, "workload": 78 },
    "pos": "G", "seasonsCovered": 8, "totalMinutes": 8277,
    "dimensions": [{ "key": "scoring", "value": 71 }, { "key": "shooting", "value": 76 }, { "key": "playmaking", "value": 66 }, { "key": "rebounding", "value": 25 }, { "key": "defense", "value": 27 }],
    "expectKey": "three-level-scorer"
  },
  {
    "name": "Kelsey Mitchell",
    "axes": { "scoringVolume": 92, "finishing": 69, "threeVolume": 81, "threeAccuracy": 75, "rimPressure": 72, "playmaking": 36, "ballSecurity": 54, "offRebounding": 27, "defRebounding": 6, "steals": 19, "rimProtection": 23, "ftShooting": 52, "workload": 82 },
    "pos": "G", "seasonsCovered": 8, "totalMinutes": 8469,
    "dimensions": [{ "key": "scoring", "value": 78 }, { "key": "shooting", "value": 69 }, { "key": "playmaking", "value": 35 }, { "key": "rebounding", "value": 17 }, { "key": "defense", "value": 20 }],
    "expectKey": "three-level-scorer"
  },
  {
    "name": "Kayla McBride",
    "axes": { "scoringVolume": 78, "finishing": 59, "threeVolume": 71, "threeAccuracy": 71, "rimPressure": 72, "playmaking": 26, "ballSecurity": 71, "offRebounding": 33, "defRebounding": 54, "steals": 51, "rimProtection": 22, "ftShooting": 83, "workload": 81 },
    "pos": "G", "seasonsCovered": 12, "totalMinutes": 11335,
    "dimensions": [{ "key": "scoring", "value": 70 }, { "key": "shooting", "value": 75 }, { "key": "playmaking", "value": 30 }, { "key": "rebounding", "value": 44 }, { "key": "defense", "value": 41 }],
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
    "axes": { "scoringVolume": 96, "finishing": 91, "threeVolume": 4, "threeAccuracy": 24, "rimPressure": 91, "playmaking": 58, "ballSecurity": 30, "offRebounding": 59, "defRebounding": 50, "steals": 50, "rimProtection": 57, "ftShooting": 31, "workload": 46 },
    "pos": "G", "seasonsCovered": 4, "totalMinutes": 1939,
    "dimensions": [{ "key": "scoring", "value": 93 }, { "key": "shooting", "value": 20 }, { "key": "playmaking", "value": 48 }, { "key": "rebounding", "value": 55 }, { "key": "defense", "value": 52 }],
    "expectKey": "slashing-creator"
  },
  {
    "name": "Alyssa Thomas",
    "axes": { "scoringVolume": 61, "finishing": 69, "threeVolume": 8, "threeAccuracy": 3, "rimPressure": 81, "playmaking": 89, "ballSecurity": 18, "offRebounding": 59, "defRebounding": 72, "steals": 83, "rimProtection": 25, "ftShooting": 22, "workload": 86 },
    "pos": "F", "seasonsCovered": 11, "totalMinutes": 10946,
    "dimensions": [{ "key": "scoring", "value": 70 }, { "key": "shooting", "value": 11 }, { "key": "playmaking", "value": 75 }, { "key": "rebounding", "value": 66 }, { "key": "defense", "value": 45 }],
    "expectKey": "point-forward"
  },
  {
    "name": "Sue Bird",
    "axes": { "scoringVolume": 54, "finishing": 66, "threeVolume": 73, "threeAccuracy": 75, "rimPressure": 23, "playmaking": 91, "ballSecurity": 39, "offRebounding": 10, "defRebounding": 26, "steals": 52, "rimProtection": 26, "ftShooting": 67, "workload": 83 },
    "pos": "G", "seasonsCovered": 19, "totalMinutes": 18081,
    "dimensions": [{ "key": "scoring", "value": 48 }, { "key": "shooting", "value": 72 }, { "key": "playmaking", "value": 85 }, { "key": "rebounding", "value": 18 }, { "key": "defense", "value": 43 }],
    "expectKey": "playmaker"
  },
  {
    "name": "Courtney Vandersloot",
    "axes": { "scoringVolume": 44, "finishing": 77, "threeVolume": 33, "threeAccuracy": 51, "rimPressure": 40, "playmaking": 97, "ballSecurity": 16, "offRebounding": 37, "defRebounding": 63, "steals": 70, "rimProtection": 80, "ftShooting": 47, "workload": 70 },
    "pos": "G", "seasonsCovered": 14, "totalMinutes": 12020,
    "dimensions": [{ "key": "scoring", "value": 54 }, { "key": "shooting", "value": 44 }, { "key": "playmaking", "value": 93 }, { "key": "rebounding", "value": 50 }, { "key": "defense", "value": 74 }],
    "expectKey": "playmaker"
  },
  {
    "name": "Angel Reese",
    "axes": { "scoringVolume": 68, "finishing": 28, "threeVolume": 15, "threeAccuracy": 18, "rimPressure": 95, "playmaking": 52, "ballSecurity": 14, "offRebounding": 98, "defRebounding": 98, "steals": 63, "rimProtection": 43, "ftShooting": 43, "workload": 92 },
    "pos": "F", "seasonsCovered": 2, "totalMinutes": 2053,
    "dimensions": [{ "key": "scoring", "value": 64 }, { "key": "shooting", "value": 25 }, { "key": "playmaking", "value": 33 }, { "key": "rebounding", "value": 98 }, { "key": "defense", "value": 50 }],
    "expectKey": "rebounding-specialist"
  },
  {
    "name": "Chelsea Gray",
    "axes": { "scoringVolume": 62, "finishing": 85, "threeVolume": 32, "threeAccuracy": 70, "rimPressure": 48, "playmaking": 85, "ballSecurity": 25, "offRebounding": 33, "defRebounding": 63, "steals": 65, "rimProtection": 59, "ftShooting": 72, "workload": 76 },
    "pos": "G", "seasonsCovered": 11, "totalMinutes": 10426,
    "dimensions": [{ "key": "scoring", "value": 65 }, { "key": "shooting", "value": 58 }, { "key": "playmaking", "value": 78 }, { "key": "rebounding", "value": 48 }, { "key": "defense", "value": 63 }],
    "notKey": "three-level-scorer"
  },
  {
    "name": "Rhyne Howard",
    "axes": { "scoringVolume": 83, "finishing": 23, "threeVolume": 90, "threeAccuracy": 45, "rimPressure": 82, "playmaking": 44, "ballSecurity": 75, "offRebounding": 61, "defRebounding": 76, "steals": 79, "rimProtection": 90, "ftShooting": 43, "workload": 93 },
    "pos": "G", "seasonsCovered": 4, "totalMinutes": 4520,
    "dimensions": [{ "key": "scoring", "value": 63 }, { "key": "shooting", "value": 59 }, { "key": "playmaking", "value": 52 }, { "key": "rebounding", "value": 69 }, { "key": "defense", "value": 83 }],
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
