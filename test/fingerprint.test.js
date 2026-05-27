// Unit tests for the player-fingerprint backbone. Exercises the PURE core (axis extraction,
// minutes-weighted aggregation, sample gating, distance) with synthetic percentile/season inputs —
// no provider, no network. The known-player accuracy truth set is a separate, later test that lands
// with the archetype-assignment module (it needs the prototypes).

process.env.NODE_ENV = 'test';

const { test } = require('node:test');
const assert = require('node:assert');

const {
  AXIS_KEYS,
  buildSeasonFingerprint,
  aggregateFingerprint,
  buildFingerprint,
  fingerprintDistance,
  buildDimensions,
  normalizeAstTo,
} = require('../server/lib/analysis/playerFingerprint');

// A season percentile object with every axis populated to distinct values, so a wrong stat/mode
// wiring shows up as a swapped number.
const FULL_SEASON = {
  perGame: { FG_PCT: 60, FG3_PCT: 70, FT_PCT: 80, MIN: 90 },
  per36:   { PTS: 95, FG3A: 40, FTA: 55, AST: 88, TOV: 65, OREB: 30, DREB: 50, STL: 77, BLK: 20 },
};

test('buildSeasonFingerprint — pulls each axis from the right stat + mode', () => {
  assert.deepStrictEqual(buildSeasonFingerprint(FULL_SEASON), {
    scoringVolume: 95, finishing: 60, threeVolume: 40, threeAccuracy: 70, rimPressure: 55,
    playmaking: 88, ballSecurity: 65, offRebounding: 30, defRebounding: 50, steals: 77,
    rimProtection: 20, ftShooting: 80, workload: 90,
  });
});

test('buildSeasonFingerprint — missing mode block yields null for those axes only', () => {
  const fp = buildSeasonFingerprint({ perGame: FULL_SEASON.perGame }); // no per36
  assert.strictEqual(fp.finishing, 60);        // perGame-sourced survives
  assert.strictEqual(fp.workload, 90);
  assert.strictEqual(fp.scoringVolume, null);  // per36-sourced -> null
  assert.strictEqual(fp.playmaking, null);
});

test('buildSeasonFingerprint — null/undefined input is all-null, never throws', () => {
  const fp = buildSeasonFingerprint(null);
  for (const key of AXIS_KEYS) assert.strictEqual(fp[key], null);
});

test('aggregateFingerprint — minutes-weighted mean', () => {
  const seasonFps = [
    { minutes: 100, fingerprint: { scoringVolume: 40 } },
    { minutes: 300, fingerprint: { scoringVolume: 80 } },
  ];
  // (40*100 + 80*300) / 400 = 70
  assert.strictEqual(aggregateFingerprint(seasonFps).scoringVolume, 70);
});

test('aggregateFingerprint — null axis values are skipped, not counted as 0', () => {
  const seasonFps = [
    { minutes: 100, fingerprint: { scoringVolume: null } }, // skipped
    { minutes: 300, fingerprint: { scoringVolume: 80 } },
  ];
  assert.strictEqual(aggregateFingerprint(seasonFps).scoringVolume, 80);
});

test('aggregateFingerprint — axis with no data in any season is null', () => {
  const seasonFps = [{ minutes: 100, fingerprint: { scoringVolume: 50 } }];
  assert.strictEqual(aggregateFingerprint(seasonFps).playmaking, null);
});

test('buildFingerprint — assembles axes + coverage when above the minutes floor', () => {
  const result = buildFingerprint({
    percentiles: { 2024: FULL_SEASON },
    seasonAverages: { statsByModeBySeason: { 2024: { Totals: { MIN: 800 } } } },
  });
  assert.strictEqual(result.insufficient, undefined);
  assert.strictEqual(result.seasonsCovered, 1);
  assert.strictEqual(result.totalMinutes, 800);
  assert.strictEqual(result.axes.scoringVolume, 95);
  assert.strictEqual(result.perSeason[0].season, '2024');
});

test('buildFingerprint — below the minutes floor is gated insufficient', () => {
  const result = buildFingerprint({
    percentiles: { 2024: FULL_SEASON },
    seasonAverages: { statsByModeBySeason: { 2024: { Totals: { MIN: 200 } } } }, // < 500
  });
  assert.strictEqual(result.insufficient, true);
  assert.strictEqual(result.reason, 'sample');
});

test('buildFingerprint — a season with no minutes weight is dropped', () => {
  const result = buildFingerprint({
    percentiles: { 2023: FULL_SEASON, 2024: FULL_SEASON },
    seasonAverages: {
      statsByModeBySeason: {
        2023: { Totals: { MIN: null } }, // dropped
        2024: { Totals: { MIN: 600 } },
      },
    },
  });
  assert.strictEqual(result.seasonsCovered, 1);
  assert.strictEqual(result.totalMinutes, 600);
});

test('buildFingerprint — missing inputs return insufficient no-data, never throw', () => {
  assert.strictEqual(buildFingerprint({}).reason, 'no-data');
  assert.strictEqual(buildFingerprint().reason, 'no-data');
});

test('fingerprintDistance — identical vectors are distance 0 / similarity 100', () => {
  const v = { scoringVolume: 50, playmaking: 70 };
  assert.deepStrictEqual(fingerprintDistance(v, v), { distance: 0, similarity: 100, axesUsed: 2 });
});

test('fingerprintDistance — RMS over shared axes, symmetric', () => {
  const a = { scoringVolume: 50, playmaking: 50 };
  const b = { scoringVolume: 60, playmaking: 40 }; // both diffs 10 -> rms 10 -> similarity 90
  const ab = fingerprintDistance(a, b);
  assert.strictEqual(ab.distance, 10);
  assert.strictEqual(ab.similarity, 90);
  assert.strictEqual(ab.axesUsed, 2);
  assert.deepStrictEqual(fingerprintDistance(b, a), ab);
});

test('fingerprintDistance — only axes present in BOTH count', () => {
  const a = { scoringVolume: 50, playmaking: 50 };
  const b = { scoringVolume: 60, defRebounding: 99 }; // only scoringVolume overlaps
  const res = fingerprintDistance(a, b);
  assert.strictEqual(res.axesUsed, 1);
  assert.strictEqual(res.distance, 10);
});

test('fingerprintDistance — no overlap returns nulls', () => {
  const res = fingerprintDistance({ scoringVolume: 50 }, { playmaking: 50 });
  assert.deepStrictEqual(res, { distance: null, similarity: null, axesUsed: 0 });
});

test('buildDimensions — 5 play dimensions (no Activity); Defense position-aware, Playmaking=assists', () => {
  const axes = {
    scoringVolume: 60, finishing: 90, rimPressure: 30,   // scoring  -> mean 60
    threeVolume: 10, threeAccuracy: 20, ftShooting: 60,  // shooting -> mean 30
    playmaking: 80, ballSecurity: 40,                    // playmaking -> 80 (assists; TOV ignored, no advanced)
    offRebounding: 70, defRebounding: 50,                // rebounding -> mean 60
    steals: 88, rimProtection: 12,                       // defense (guard) -> 0.65*88 + 0.35*12 = 61
    workload: 75,                                        // NOT a dimension anymore (stays a 13-bar axis)
  };
  assert.deepStrictEqual(buildDimensions(axes, {}, 'G'), [
    { key: 'scoring',    label: 'Scoring',    value: 60 },
    { key: 'shooting',   label: 'Shooting',   value: 30 },
    { key: 'playmaking', label: 'Playmaking', value: 80 },
    { key: 'rebounding', label: 'Rebounding', value: 60 },
    { key: 'defense',    label: 'Defense',    value: 61 },
  ]);
});

test('buildDimensions — Defense leads with the position\'s tool (guard steals vs big blocks)', () => {
  const axes = { steals: 88, rimProtection: 12 };
  const defOf = (pos) => buildDimensions(axes, {}, pos).find(d => d.key === 'defense').value;
  assert.strictEqual(defOf('G'), 61); // 0.65*88 + 0.35*12
  assert.strictEqual(defOf('C'), 39); // 0.65*12 + 0.35*88
});

test('buildDimensions — skips null members; all-null dimension is null', () => {
  const dims = buildDimensions({ offRebounding: 70, defRebounding: null }); // one rebounding member
  const byKey = Object.fromEntries(dims.map(d => [d.key, d.value]));
  assert.strictEqual(byKey.rebounding, 70);  // averages the one non-null member
  assert.strictEqual(byKey.scoring, null);   // no scoring axes present at all
});

test('buildDimensions — Playmaking blends assist volume with AST/TO quality when provided', () => {
  const pm = (dims) => dims.find(d => d.key === 'playmaking').value;
  // 0.6*80 (volume) + 0.4*90 (quality) = 84
  assert.strictEqual(pm(buildDimensions({ playmaking: 80 }, { playmakingQuality: 90 })), 84);
  // No advanced signal -> falls back to the assist-volume axis alone.
  assert.strictEqual(pm(buildDimensions({ playmaking: 80 })), 80);
});

test('normalizeAstTo — maps AST/TO to 0-100 on the fixed scale, clamped', () => {
  assert.strictEqual(normalizeAstTo(0.8), 0);     // low anchor
  assert.strictEqual(normalizeAstTo(2.8), 100);   // high anchor
  assert.strictEqual(normalizeAstTo(1.8), 50);    // midpoint
  assert.strictEqual(normalizeAstTo(0.4), 0);     // clamp low
  assert.strictEqual(normalizeAstTo(4.0), 100);   // clamp high
  assert.strictEqual(normalizeAstTo(null), null);
  assert.strictEqual(normalizeAstTo(Infinity), null);
});

test('buildFingerprint — computes career AST/TO + playmakingQuality from season totals', () => {
  const result = buildFingerprint({
    percentiles: { 2024: FULL_SEASON },
    seasonAverages: { statsByModeBySeason: { 2024: { Totals: { MIN: 800, AST: 200, TOV: 80 } } } },
  });
  assert.strictEqual(result.advanced.astTo, 2.5);             // 200 / 80
  assert.strictEqual(result.advanced.playmakingQuality, 85);  // (2.5-0.8)/2.0*100
});

test('buildFingerprint — zero turnovers leaves AST/TO + quality null (no divide-by-zero)', () => {
  const result = buildFingerprint({
    percentiles: { 2024: FULL_SEASON },
    seasonAverages: { statsByModeBySeason: { 2024: { Totals: { MIN: 800, AST: 200, TOV: 0 } } } },
  });
  assert.strictEqual(result.advanced.astTo, null);
  assert.strictEqual(result.advanced.playmakingQuality, null);
});
