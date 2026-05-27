// Unit tests for Cross-Era Similarity ranking — synthetic fingerprint vectors, no I/O. Locks: the
// one-off position gate (axes are position-pooled, so a guard never matches a center), similarity
// sort order, the minimum-shared-axes gate, self-exclusion, the result cap, and shared-trait
// selection (a dimension counts only when BOTH players rate it highly).

process.env.NODE_ENV = 'test';

const { test } = require('node:test');
const assert = require('node:assert');

const { AXIS_KEYS } = require('../server/lib/analysis/playerFingerprint');
const {
  rankSimilar, positionsAdjacent, posRank, spreadSimilarity, confidenceFor, CONF_STRONG, CONF_MODERATE,
} = require('../server/lib/analysis/similarity');

// Full 13-axis vector at `base`, with per-axis overrides.
function axesWith(base, overrides = {}) {
  const a = {};
  for (const k of AXIS_KEYS) a[k] = base;
  return { ...a, ...overrides };
}
const c = (id, axes, pos, name) => ({ id, name: name ?? `p${id}`, pos, axes });

test('positionsAdjacent / posRank — G–F–C one-off line', () => {
  assert.strictEqual(posRank('G'), 0);
  assert.strictEqual(posRank('C'), 2);
  assert.strictEqual(posRank('G-F'), 0);   // first letter wins
  assert.strictEqual(posRank('X'), null);  // unknown
  assert.ok(positionsAdjacent('G', 'F'));
  assert.ok(positionsAdjacent('F', 'C'));
  assert.ok(positionsAdjacent('C', 'C'));
  assert.ok(!positionsAdjacent('G', 'C'));  // two steps — excluded
  assert.ok(positionsAdjacent('G', null));  // unknown never hides a match
});

test('rankSimilar — excludes a guard candidate for a center target (no G↔C)', () => {
  const target = { id: 'T', pos: 'C', axes: axesWith(60) };
  const res = rankSimilar(target, [
    c(1, axesWith(60), 'G'),
    c(2, axesWith(60), 'F'),
    c(3, axesWith(60), 'C'),
  ]);
  const ids = res.map(r => r.id);
  assert.ok(!ids.includes(1), 'guard should be gated out for a center');
  assert.ok(ids.includes(2) && ids.includes(3), 'forward + center stay');
});

test('rankSimilar — ranks the closer profile first', () => {
  const target = { id: 'T', pos: 'G', axes: axesWith(50, { scoringVolume: 90 }) };
  const near = c('near', axesWith(50, { scoringVolume: 88 }), 'G');
  const far = c('far', axesWith(50, { scoringVolume: 40 }), 'G');
  const res = rankSimilar(target, [far, near]);
  assert.strictEqual(res[0].id, 'near');
  assert.ok(res[0].similarity > res[1].similarity);
});

test('rankSimilar — drops candidates overlapping on too few axes', () => {
  const target = { id: 'T', pos: 'G', axes: axesWith(50) };
  // Only 5 numeric axes overlap -> below the default minAxes (8).
  const thin = c('thin', { scoringVolume: 50, finishing: 50, threeVolume: 50, playmaking: 50, steals: 50 }, 'G');
  const full = c('full', axesWith(50), 'G');
  const ids = rankSimilar(target, [thin, full]).map(r => r.id);
  assert.ok(!ids.includes('thin'));
  assert.ok(ids.includes('full'));
});

test('rankSimilar — never compares a player to themselves', () => {
  const target = { id: 'T', pos: 'F', axes: axesWith(55) };
  const ids = rankSimilar(target, [c('T', axesWith(55), 'F'), c('other', axesWith(55), 'F')]).map(r => r.id);
  assert.ok(!ids.includes('T'));
  assert.ok(ids.includes('other'));
});

test('rankSimilar — self-exclusion works when the target is shaped like getPlayerFingerprint (playerId)', () => {
  // The route threads in the raw fingerprint, whose id field is `playerId`, not `id`.
  const target = { playerId: '42', pos: 'G', axes: axesWith(50) };
  const ids = rankSimilar(target, [c('42', axesWith(50), 'G'), c('99', axesWith(50), 'G')]).map(r => r.id);
  assert.ok(!ids.includes('42'), 'target must not match itself via playerId');
  assert.ok(ids.includes('99'));
});

test('rankSimilar — respects the result limit', () => {
  const target = { id: 'T', pos: 'G', axes: axesWith(50) };
  const pool = Array.from({ length: 6 }, (_, i) => c(i, axesWith(50), 'G'));
  assert.strictEqual(rankSimilar(target, pool, { limit: 2 }).length, 2);
});

test('rankSimilar — skips candidates with no fingerprint, and returns [] for a thin target', () => {
  const target = { id: 'T', pos: 'G', axes: axesWith(50) };
  const ids = rankSimilar(target, [c('hasnull', null, 'G'), c('ok', axesWith(50), 'G')]).map(r => r.id);
  assert.ok(!ids.includes('hasnull'));
  assert.deepStrictEqual(rankSimilar({ id: 'T', pos: 'G', axes: null }, [c('ok', axesWith(50), 'G')]), []);
});

test('rankSimilar — sharedTraits lead with the shared STRENGTH, not a shared weakness', () => {
  const high = { scoringVolume: 90, finishing: 90, rimPressure: 90 }; // -> scoring dim high
  const low = { offRebounding: 20, defRebounding: 20 };               // -> rebounding dim low
  const target = { id: 'T', pos: 'G', axes: axesWith(50, { ...high, ...low }) };
  const cand = c('m', axesWith(50, { scoringVolume: 88, finishing: 88, rimPressure: 88, offRebounding: 22, defRebounding: 22 }), 'G');
  const [match] = rankSimilar(target, [cand]);
  const keys = match.sharedTraits.map(t => t.key);
  assert.strictEqual(keys[0], 'scoring', 'top shared trait is the shared strength');
  assert.ok(!keys.includes('rebounding'), 'a shared WEAKNESS (both ~20) is not a shared trait');
});

test('rankSimilar — sharedTraits never empty for two modest, overlapping role players', () => {
  // Both flat-ish (~50 everywhere) — the old "both >= 60" floor returned nothing; now they should
  // still surface their closest shared dimensions so the card always has a "Most alike on" line.
  const target = { id: 'T', pos: 'F', axes: axesWith(50) };
  const [match] = rankSimilar(target, [c('rp', axesWith(48), 'F')]);
  assert.ok(match.sharedTraits.length > 0, 'modest profiles still get a shared-traits line');
});

test('rankSimilar — sharedTraits fallback fires when every dimension is below the floor', () => {
  // Deep-bench case: all dims well under TRAIT_PRESENT_FLOOR (35) in both players — the floor filter
  // is empty, so the fallback names the single closest shared dimension (line is never empty).
  const target = { id: 'T', pos: 'F', axes: axesWith(20) };
  const [match] = rankSimilar(target, [c('bench', axesWith(22), 'F')]);
  assert.strictEqual(match.sharedTraits.length, 1, 'fallback gives exactly one shared dimension');
});

test('spreadSimilarity — perfect comp reads 100, monotonic, and widens the field', () => {
  assert.strictEqual(spreadSimilarity(100), 100, 'a perfect match still reads 100');
  assert.ok(spreadSimilarity(90) > spreadSimilarity(70), 'monotonic');
  // The compressed raw range is widened: a 20-point raw gap becomes a larger display gap.
  assert.ok(spreadSimilarity(90) - spreadSimilarity(70) > 90 - 70, 'spread amplifies differences');
});

test('rankSimilar — cross-position comps read lower than an identical same-position comp', () => {
  const ax = axesWith(50, { scoringVolume: 80 });
  const target = { id: 'T', pos: 'G', axes: ax };
  const res = rankSimilar(target, [c('g', ax, 'G'), c('f', ax, 'F')]); // identical axes, differ only in pos
  const g = res.find(r => r.id === 'g'), f = res.find(r => r.id === 'f');
  assert.strictEqual(g.similarity, 100, 'identical same-position comp reads 100');
  assert.ok(f.similarity < g.similarity, 'identical cross-position comp is docked below it');
  assert.strictEqual(res[0].id, 'g', 'same position leads');
});

test('rankSimilar — position penalty: same-pos wins a near-tie; a clearly-better cross-pos still leads', () => {
  const target = { id: 'T', pos: 'G', axes: axesWith(50, { scoringVolume: 80 }) };
  // Near-tie: the forward is marginally closer raw, but the penalty drops it below the guard.
  const sameNear = c('sameNear', axesWith(50, { scoringVolume: 74 }), 'G');
  const crossNear = c('crossNear', axesWith(50, { scoringVolume: 76 }), 'F');
  const near = rankSimilar(target, [crossNear, sameNear]);
  assert.strictEqual(near[0].id, 'sameNear', 'same position wins a near-tie');
  assert.ok(near.find(r => r.id === 'crossNear').similarity < near.find(r => r.id === 'sameNear').similarity,
    'cross-position similarity is docked below the same-position comp');

  // A clearly-better cross-pos (exact match) still beats a much worse same-pos comp despite the penalty.
  const sameFar = c('sameFar', axesWith(50, { scoringVolume: 50 }), 'G');
  const crossExact = c('crossExact', axesWith(50, { scoringVolume: 80 }), 'F');
  assert.strictEqual(rankSimilar(target, [sameFar, crossExact])[0].id, 'crossExact');
});

test('confidenceFor — tiers at the threshold boundaries', () => {
  assert.strictEqual(confidenceFor(CONF_STRONG), 'strong');
  assert.strictEqual(confidenceFor(CONF_STRONG - 1), 'moderate');
  assert.strictEqual(confidenceFor(CONF_MODERATE), 'moderate');
  assert.strictEqual(confidenceFor(CONF_MODERATE - 1), 'loose');
});

test('rankSimilar — every result carries a confidence tier', () => {
  const target = { id: 'T', pos: 'G', axes: axesWith(50, { scoringVolume: 85 }) };
  const res = rankSimilar(target, [c(1, axesWith(50, { scoringVolume: 84 }), 'G'), c(2, axesWith(20), 'G')]);
  assert.ok(res.every(r => ['strong', 'moderate', 'loose'].includes(r.confidence)));
});
