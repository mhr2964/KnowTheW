// Cross-Era Similarity — "players like X". Pure ranking over already-built career fingerprints
// (the candidate pool comes from percentileClient.loadFingerprintIndex; the target from
// getPlayerFingerprint). No network here, so the truth set can test the math with synthetic vectors.
//
// WHY position adjacency: the 13 axes are POSITION-POOLED percentiles (a guard's "scoring 80" is
// 80th-percentile among guards), so a raw guard↔center match compares unlike pools and reads as
// nonsense. The data only carries primary position G/F/C, so we order them G–F–C and allow a match
// within one step (G↔G, G↔F, F↔F, F↔C, C↔C) but never G↔C — "PGs get SGs, bigs get SFs" at the
// granularity we actually have. Unknown position on either side never hides a match.
//
// WHY signature-weighted distance: see weightedFingerprintDistance in playerFingerprint.js — plain
// RMS rewarded overall averageness (a shooter matched rebounders on shared middling axes), so we
// weight toward the target's defining skills. Same-position comps are then softly preferred so a
// player whose profile reads cross-position doesn't bury genuine same-position matches.

'use strict';

const { weightedFingerprintDistance, buildDimensions } = require('./playerFingerprint');

const POS_RANK = { G: 0, F: 1, C: 2 };

// Tuning knobs (named like archetypes.js so a sweep can adjust them in one place).
const SIMILAR_LIMIT = 8;        // how many comparables to return
const MIN_SHARED_AXES = 8;      // both players must overlap on >= this many of the 13 axes
const TRAIT_PRESENT_FLOOR = 35; // a dimension is eligible to be a "shared trait" only if both >= this
const MAX_SHARED_TRAITS = 3;    // cap on the "most alike on: …" list
// Cross-position matches ("positional analogues") are valid but a looser answer to "players like X",
// so dock the similarity score per step of position distance (one-off gate ⇒ gap is 0 or 1). This
// is baked into the DISPLAYED similarity (not just the sort), so same-position comps lead when they
// are competitive, the list stays monotonic in the shown %, and the confidence tier reflects the
// position mismatch. An all-around guard whose forward comps were only marginally closer now leads
// with guards; a true tweener (no strong same-position comp) still surfaces analogues, just lower.
const CROSS_POS_PENALTY = 7;
// Display spread: the raw signature-weighted similarity is naturally compressed (era-normalized
// percentiles cluster, so even loose comps sit ~70-92), which makes a weak match read deceptively
// high. Remap the meaningful range onto a wider, more intuitive 0-100 so a top comp reads ~90 and a
// weak one ~45. Monotonic ⇒ ranking is unchanged. SIM_SCALE is set so a perfect comp still reads 100
// ((100-SIM_FLOOR)*SIM_SCALE >= 100).
const SIM_FLOOR = 56;
const SIM_SCALE = 2.6;
// Confidence tiers on the SPREAD (displayed) similarity, so the tier word shown on each row matches
// the number. Tuned to the spread distribution (all-match p25/p75 ≈ 60/73): 'strong' ≈ top quarter
// (a genuinely good comp), 'loose' (<55) ≈ the weak tail that shouldn't masquerade as a real match.
const CONF_STRONG = 73;
const CONF_MODERATE = 55;

/** Primary-position rank from a position string ('G', 'F', 'C', or 'G-F' → first letter). null if unknown. */
function posRank(pos) {
  const first = String(pos ?? '').trim().charAt(0).toUpperCase();
  return Object.prototype.hasOwnProperty.call(POS_RANK, first) ? POS_RANK[first] : null;
}

/** True if two positions are within one step on the G–F–C line. Unknown pos ⇒ allowed (don't hide). */
function positionsAdjacent(a, b) {
  const ra = posRank(a);
  const rb = posRank(b);
  if (ra === null || rb === null) return true;
  return Math.abs(ra - rb) <= 1;
}

/** Remap a compressed raw similarity (~56-100) onto a spread, intuitive 0-100 display scale. Monotonic. */
function spreadSimilarity(raw) {
  return Math.max(0, Math.min(100, Math.round((raw - SIM_FLOOR) * SIM_SCALE)));
}

/** Match-strength tier from the (spread) similarity score, so the UI can flag loose comps honestly. */
function confidenceFor(similarity) {
  if (similarity >= CONF_STRONG) return 'strong';
  if (similarity >= CONF_MODERATE) return 'moderate';
  return 'loose';
}

/**
 * Dimensions two players are most alike on, ranked by SHARED STRENGTH = min(target, cand) — you're
 * alike on a trait only as much as the weaker of the two rates it. Keeps dims both rate at least
 * modestly (>= TRAIT_PRESENT_FLOOR); ties break toward the smaller gap. Always returns something for
 * overlapping profiles (the confidence tier conveys whether a modest shared trait is a real signal).
 * @returns {Array<{key:string, label:string}>}
 */
function sharedTraits(aDims, bDims, floor = TRAIT_PRESENT_FLOOR, max = MAX_SHARED_TRAITS) {
  const bByKey = new Map(bDims.map(d => [d.key, d]));
  // Every dimension both players rate (non-null), scored by shared strength = the weaker of the two.
  const present = aDims
    .map(d => {
      const o = bByKey.get(d.key);
      if (!o || typeof d.value !== 'number' || typeof o.value !== 'number') return null;
      return { key: d.key, label: d.label, strength: Math.min(d.value, o.value), gap: Math.abs(d.value - o.value) };
    })
    .filter(Boolean)
    .sort((x, y) => y.strength - x.strength || x.gap - y.gap);

  const strong = present.filter(p => p.strength >= floor).slice(0, max);
  // Fallback so the "Most alike on" line is never empty: if nothing clears the floor (deep-bench
  // players with no dimension >= 35 in both), name the single closest shared dimension. The
  // confidence tier still conveys that the overall match is loose.
  const chosen = strong.length ? strong : present.slice(0, 1);
  return chosen.map(({ key, label }) => ({ key, label }));
}

/**
 * Rank a candidate pool by signature-weighted fingerprint similarity to a target.
 * @param {{id?:(string|number), playerId?:(string|number), pos?:string, axes:Object, advanced?:Object}} target
 * @param {Array<{id, name?, pos?, axes:Object, advanced?:Object}>} candidates  pool (axes==null skipped)
 * @param {{limit?:number, minAxes?:number}} [opts]
 * @returns {Array<{id, name, pos, similarity, distance, axesUsed, confidence, dimensions, sharedTraits}>}
 *   sorted most-similar first (same-position preferred). `similarity` is position-adjusted (a
 *   cross-position analogue is docked CROSS_POS_PENALTY per step). Empty if the target isn't fingerprintable.
 */
function rankSimilar(target, candidates = [], { limit = SIMILAR_LIMIT, minAxes = MIN_SHARED_AXES } = {}) {
  if (!target || !target.axes) return [];
  const targetDims = buildDimensions(target.axes, target.advanced, target.pos);
  // getPlayerFingerprint returns the id as `playerId`; cached candidates use `id`. Accept either so
  // self-exclusion works whichever shape the caller threads in.
  const targetId = String(target.id ?? target.playerId);
  const targetRank = posRank(target.pos);

  const scored = [];
  for (const c of candidates) {
    if (!c || c.axes == null) continue;
    if (String(c.id) === targetId) continue;                 // never compare a player to themselves
    if (!positionsAdjacent(target.pos, c.pos)) continue;      // one-off position gate

    const { distance, similarity: raw, axesUsed } = weightedFingerprintDistance(target.axes, c.axes);
    if (raw === null || axesUsed < minAxes) continue;         // thin overlaps don't earn a match

    // Position-adjusted similarity: dock cross-position analogues so a competitive same-position comp
    // leads. posGap is 0 (same pos) or 1 (one-off G↔F / F↔C); unknown position on either side ⇒ 0.
    // Then spread the compressed raw range onto an intuitive 0-100 for display (monotonic, so the
    // penalty's ordering is preserved).
    const candRank = posRank(c.pos);
    const posGap = (targetRank !== null && candRank !== null) ? Math.abs(targetRank - candRank) : 0;
    const similarity = spreadSimilarity(raw - CROSS_POS_PENALTY * posGap);

    const dimensions = buildDimensions(c.axes, c.advanced, c.pos);
    scored.push({
      id: c.id,
      name: c.name ?? null,
      headshot: c.headshot ?? null,   // real headshot URL (null → client renders initials, no 404)
      pos: c.pos ?? null,
      archetype: c.archetype ?? null, // position-pooled label (matches the player's own badge)
      stats: c.stats ?? null,         // career per-game { ppg, rpg, apg, gp }
      similarity,
      distance: Math.round(distance * 10) / 10, // raw fingerprint distance (secondary sort; not shown)
      axesUsed,
      confidence: confidenceFor(similarity),
      dimensions,
      sharedTraits: sharedTraits(targetDims, dimensions),
    });
  }

  scored.sort((a, b) =>
    b.similarity - a.similarity ||
    a.distance - b.distance ||
    String(a.name).localeCompare(String(b.name)));
  return scored.slice(0, limit);
}

module.exports = {
  POS_RANK,
  SIMILAR_LIMIT,
  MIN_SHARED_AXES,
  CROSS_POS_PENALTY,
  CONF_STRONG,
  CONF_MODERATE,
  posRank,
  positionsAdjacent,
  spreadSimilarity,
  confidenceFor,
  sharedTraits,
  rankSimilar,
};
