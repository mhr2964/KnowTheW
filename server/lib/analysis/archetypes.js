// Archetype assignment — turns a continuous fingerprint (see playerFingerprint.js) into a readable
// badge. WHY the design is shaped this way (it's a direct response to the failure modes of the
// Reddit roles paper this feature is inspired by):
//
//   - Prototype-ANCHORED, not bucketed. Each archetype is an anchor point defined only on its few
//     DEFINING axes (a sparse target vector). A player is assigned the nearest anchor — but only if
//     they're actually close (ASSIGN_MAX_DISTANCE). This is what stops dissimilar players being
//     forced into one cryptic bucket: if nobody's prototype fits, you fall through to the ladder
//     rather than getting mislabeled.
//   - No blanket weaknesses. We never tag a player with something they're bad at. The label states
//     what they ARE (nearest prototype) and trait MODIFIERS add what they're elite at — strengths
//     only. A prototype's low-axis targets are used to DISTINGUISH it (a Sharpshooter is low rim
//     pressure), never surfaced as "this player is weak at X".
//   - Tiered fallback for thin / undifferentiated profiles (the rookie / low-usage question):
//       insufficient sample          -> null badge (don't assert what we can't support)
//       elevated on multiple axes     -> 'Versatile' (earned — multi-skill, no textbook bucket)
//       flat / low across the board   -> 'Role Player' (so 'Versatile' never flatters a bench piece)
//   - Confidence is reported, not hidden. A one-season rookie gets a badge tagged 'low' confidence
//     so the UI can show "small sample" rather than withholding or over-claiming.
//
// Pure module: assignArchetype takes a fingerprint object (the buildFingerprint result) and returns
// a plain descriptor. No I/O. The known-player truth set (incl. Alyssa Thomas) validates it against
// live data as a pre-ship gate; the unit tests here lock the assignment LOGIC with synthetic axes.

'use strict';

const { AXES, fingerprintDistance } = require('./playerFingerprint');

const AXIS_LABEL = Object.fromEntries(AXES.map(a => [a.key, a.label]));

// Target levels for a prototype's defining axes. H/L are what the archetype is known FOR / known to
// LACK (the lack only sharpens the match, it's never shown as a weakness); M is a mild lean.
const H = 80;
const M = 55;
const L = 20;

// The prototype roster. Each lists ONLY its defining axes — distance is measured over those axes
// alone, so an archetype isn't penalized on dimensions it doesn't define. `pos` gates eligibility
// by position group (G/F/C): the percentiles are position-POOLED, so a guard's axis value is
// relative to guards — matching a guard against a "Big" prototype is both semantically wrong and
// statistically apples-to-oranges. Gating is what stopped a guard reading as a Stretch Big and a
// scoring forward reading as a Floor General (the truth-set misses that drove this).
const PROTOTYPES = [
  { key: 'three-level-scorer', name: 'Three-Level Scorer', pos: ['G', 'F'],
    target: { scoringVolume: H, finishing: H, threeAccuracy: H, rimPressure: H } },
  { key: 'floor-general', name: 'Floor General', pos: ['G'],
    target: { playmaking: H, scoringVolume: L } },
  { key: 'combo-guard', name: 'Combo Guard', pos: ['G'],
    target: { scoringVolume: H, playmaking: H, threeVolume: H, threeAccuracy: M } },
  { key: 'three-and-d-wing', name: '3-and-D Wing', pos: ['G', 'F'],
    target: { threeVolume: H, threeAccuracy: H, steals: H, scoringVolume: L } },
  { key: 'sharpshooter', name: 'Sharpshooter', pos: ['G', 'F'],
    target: { threeVolume: H, threeAccuracy: H, ftShooting: H, playmaking: L, rimPressure: L } },
  { key: 'slashing-creator', name: 'Slashing Creator', pos: ['G', 'F'],
    target: { scoringVolume: H, rimPressure: H, playmaking: H, threeVolume: L } },
  { key: 'connector', name: 'Connector', pos: ['G', 'F'],
    target: { playmaking: H, ballSecurity: H, steals: H, scoringVolume: L } },
  { key: 'two-way-forward', name: 'Two-Way Forward', pos: ['F'],
    target: { scoringVolume: H, steals: H, defRebounding: H, finishing: H } },
  { key: 'point-forward', name: 'Point Forward', pos: ['F'],
    target: { playmaking: H, defRebounding: H, steals: H, scoringVolume: M, threeVolume: L } },
  { key: 'interior-anchor', name: 'Interior Anchor', pos: ['F', 'C'],
    target: { rimProtection: H, defRebounding: H, finishing: H, threeVolume: L } },
  { key: 'stretch-big', name: 'Stretch Big', pos: ['F', 'C'],
    target: { threeVolume: H, threeAccuracy: H, defRebounding: H, rimProtection: M } },
  { key: 'glass-cleaning-big', name: 'Glass-Cleaning Big', pos: ['F', 'C'],
    target: { offRebounding: H, defRebounding: H, rimProtection: H, rimPressure: H, threeVolume: L } },
];

// Prototypes a player at `pos` can be assigned. Unknown/unparseable position -> no gating (rank all,
// so the system degrades gracefully rather than returning nothing).
function eligiblePrototypes(pos) {
  const letters = String(pos ?? '').toUpperCase().match(/[GFC]/g);
  if (!letters || !letters.length) return PROTOTYPES;
  const set = new Set(letters);
  const filtered = PROTOTYPES.filter(p => p.pos.some(x => set.has(x)));
  return filtered.length ? filtered : PROTOTYPES;
}

// Assignment knobs (tunable against the truth set — the whole point of keeping them as named data).
const ASSIGN_MAX_DISTANCE = 20;  // RMS over a prototype's defining axes; beyond this, no prototype fits.
                                 // Tightened from 25 so loose mis-fits fall to the dimension-driven
                                 // fallback (Specialist/Versatile/Role Player) instead of a wrong bucket.
const STRONG_DIM = 65;           // a play DIMENSION at/above this is a genuine strength. Drives BOTH
                                 // the fallback ladder and the descriptor, so they can't contradict.
const ELITE_AXIS = 85;           // standout AXES surfaced as trait modifiers (detail highlights).
const MAX_MODIFIERS = 2;

// Each prototype's PRIMARY play dimension — what it's fundamentally about. A prototype match is
// rejected if the player's top dimension beats this primary by >= PRIMARY_GAP, i.e. the label would
// misrepresent them (a rebounding-dominant forward isn't a "Slashing Creator"; a defense-first wing
// whose shooting is weak isn't a "3-and-D Wing"). Rejected players fall to the dimension fallback.
const PROTOTYPE_PRIMARY = {
  'three-level-scorer': 'scoring',
  'floor-general': 'playmaking',
  'combo-guard': 'scoring',
  'three-and-d-wing': 'shooting',
  'sharpshooter': 'shooting',
  'slashing-creator': 'scoring',
  'connector': 'playmaking',
  'two-way-forward': 'scoring',
  'point-forward': 'playmaking',
  'interior-anchor': 'rebounding',
  'stretch-big': 'shooting',
  'glass-cleaning-big': 'rebounding',
};
const PRIMARY_GAP = 25;

const FALLBACK_VERSATILE = { key: 'versatile', name: 'Versatile' };
const FALLBACK_ROLE = { key: 'role-player', name: 'Role Player' };
// When no prototype fits and exactly ONE dimension is strong, the player is a specialist named by
// that dimension (gives defensive guards / pure rebounders a real home instead of "Versatile").
const SPECIALIST_BY_DIM = {
  scoring:    { key: 'volume-scorer',         name: 'Volume Scorer' },
  shooting:   { key: 'floor-spacer',          name: 'Floor Spacer' },
  playmaking: { key: 'playmaker',             name: 'Playmaker' },
  rebounding: { key: 'rebounding-specialist', name: 'Rebounding Specialist' },
  defense:    { key: 'defensive-specialist',  name: 'Defensive Specialist' },
};

/**
 * Distance from a player's axes to one prototype, measured ONLY over the prototype's defining axes.
 * Reuses fingerprintDistance by projecting both vectors onto the target's axis set.
 */
function distanceToPrototype(axes, target) {
  const a = {};
  const b = {};
  for (const key of Object.keys(target)) {
    if (typeof axes[key] === 'number') {
      a[key] = axes[key];
      b[key] = target[key];
    }
  }
  return fingerprintDistance(a, b); // { distance, similarity, axesUsed }
}

/** Confidence in the read, from career sample size. Reported so the UI can caveat thin samples. */
function confidenceFor({ totalMinutes, seasonsCovered }) {
  if (totalMinutes >= 3000 && seasonsCovered >= 3) return 'high';
  if (totalMinutes >= 1200) return 'medium';
  return 'low';
}

/** Up to MAX_MODIFIERS strengths (axes >= ELITE_AXIS), strongest first — strengths only, never weaknesses. */
function traitModifiers(axes) {
  return Object.entries(axes)
    .filter(([, v]) => typeof v === 'number' && v >= ELITE_AXIS)
    .sort((x, y) => y[1] - x[1])
    .slice(0, MAX_MODIFIERS)
    .map(([key]) => ({ key, label: AXIS_LABEL[key] }));
}

/** Play dimensions at/above STRONG_DIM, strongest first (the shared notion of a "strength"). */
function strongDimensions(dimensions) {
  return (dimensions ?? [])
    .filter(d => typeof d.value === 'number' && d.value >= STRONG_DIM)
    .sort((a, b) => b.value - a.value);
}

/**
 * Assign an archetype to a fingerprint, using the 5 play dimensions for the fallback so the label
 * and the descriptor (which reads the same dimensions) can never contradict.
 * @param {Object} fingerprint  buildFingerprint() result ({ axes, pos, totalMinutes, ... } or
 *   { insufficient, reason }).
 * @param {Array<{key,value}>} dimensions  buildDimensions() output for this player.
 * @returns {{archetype:null, reason:string}
 *   | {archetype:{key,name}, fallback:boolean, confidence:string, distance:number|null,
 *      modifiers:Array<{key,label}>, runnerUp:{key,name,distance:number}|null}}
 */
function assignArchetype(fingerprint, dimensions) {
  if (!fingerprint || fingerprint.insufficient || !fingerprint.axes) {
    return { archetype: null, reason: fingerprint?.reason ?? 'no-data' };
  }

  const { axes } = fingerprint;
  const confidence = confidenceFor(fingerprint);
  const modifiers = traitModifiers(axes);

  // Rank position-eligible prototypes by distance over their own defining axes; ignore any we
  // couldn't measure.
  const ranked = eligiblePrototypes(fingerprint.pos)
    .map(p => ({ proto: p, ...distanceToPrototype(axes, p.target) }))
    .filter(r => r.distance !== null)
    .sort((a, b) => a.distance - b.distance);

  const best = ranked[0] ?? null;

  // Dominant-dimension consistency: skip a prototype whose primary theme is far below what the
  // player is actually best at, so the nearest *credible* prototype wins (not just the nearest).
  const dimVal = (k) => {
    const d = (dimensions ?? []).find(x => x.key === k);
    return typeof d?.value === 'number' ? d.value : null;
  };
  const topDim = Math.max(0, ...(dimensions ?? []).map(d => (typeof d.value === 'number' ? d.value : 0)));
  const consistent = (proto) => {
    const primary = PROTOTYPE_PRIMARY[proto.key];
    if (!primary) return true;
    return topDim - (dimVal(primary) ?? 0) < PRIMARY_GAP;
  };

  const matchIdx = ranked.findIndex(r => r.distance <= ASSIGN_MAX_DISTANCE && consistent(r.proto));
  if (matchIdx !== -1) {
    const m = ranked[matchIdx];
    const ru = ranked[matchIdx + 1];
    return {
      archetype: { key: m.proto.key, name: m.proto.name },
      fallback: false,
      confidence,
      distance: round1(m.distance),
      modifiers,
      runnerUp: ru ? { key: ru.proto.key, name: ru.proto.name, distance: round1(ru.distance) } : null,
    };
  }

  // No prototype fits — label by dimensional strengths: 2+ -> Versatile, exactly 1 -> Specialist
  // named by that dimension, 0 -> Role Player.
  const strengths = strongDimensions(dimensions);
  let fb;
  if (strengths.length >= 2) fb = FALLBACK_VERSATILE;
  else if (strengths.length === 1) fb = SPECIALIST_BY_DIM[strengths[0].key] ?? FALLBACK_VERSATILE;
  else fb = FALLBACK_ROLE;

  return {
    archetype: { key: fb.key, name: fb.name },
    fallback: true,
    confidence,
    distance: best ? round1(best.distance) : null,
    modifiers,
    runnerUp: null,
  };
}

// Plain-language descriptor built from the 6 composite dimensions (see playerFingerprint.DIMENSIONS).
// Templated, not AI — must be instant and deterministic. 'Activity' is excluded (role size, not a
// playstyle trait). Limitations are stated ONLY when a dimension is genuinely low, framed as how the
// player plays ("rarely shoots from outside"), never an imposed/blanket weakness.
const STRENGTH_PHRASE = {
  scoring: 'scoring', shooting: 'outside shooting', playmaking: 'playmaking',
  rebounding: 'rebounding', defense: 'defense',
};
const LIMIT_PHRASE = {
  shooting: 'rarely shoots from outside', scoring: "isn't a volume scorer",
  playmaking: "isn't a primary creator", rebounding: "doesn't crash the glass",
  defense: 'low defensive activity',
};
const LIMIT_MAX = 28;     // a dimension at/below this is a genuine, statable limitation

function joinList(items) {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function tierWord(v) {
  return v >= 85 ? 'Elite' : v >= 72 ? 'Strong' : 'Solid';
}

/**
 * One-sentence playstyle descriptor from the composite dimensions. Reads the SAME dimensions +
 * STRONG_DIM threshold the archetype fallback uses, so the two can't contradict.
 * @param {Array<{key:string,value:number|null}>} dimensions  buildDimensions() output
 * @param {{archetype:{key:string}|null}} assignment  the assignArchetype() result
 * @returns {string}
 */
function buildDescriptor(dimensions, assignment) {
  const archetype = assignment?.archetype;
  if (!archetype) return '';

  const byStrong = (dimensions ?? [])
    .filter(d => typeof d.value === 'number')
    .sort((a, b) => b.value - a.value);
  let strengths = byStrong.filter(d => d.value >= STRONG_DIM);

  // Versatile fallback: multi-skill, no single dominant (≥2 strengths by construction).
  if (archetype.key === 'versatile') {
    const top = strengths.slice(0, 3).map(d => STRENGTH_PHRASE[d.key]);
    return top.length >= 2
      ? `Versatile across ${joinList(top)} with no single dominant skill.`
      : 'Versatile contributor with no single dominant skill.';
  }
  // Role Player: nothing stands out.
  if (archetype.key === 'role-player') {
    return 'Balanced contributor without a standout dimension.';
  }

  // Specialist or matched prototype: describe the strong dimensions. Consistency guard — a NAMED
  // archetype with no dimension ≥ STRONG_DIM still names its top dimension, so it never reads
  // "no standout" while wearing a specific label.
  if (!strengths.length) strengths = byStrong.slice(0, 1);
  if (!strengths.length) return 'Balanced contributor without a standout dimension.';
  strengths = strengths.slice(0, 3);

  const lead = `${tierWord(strengths[0].value)} ${joinList(strengths.map(d => STRENGTH_PHRASE[d.key]))}`;
  const limit = byStrong[byStrong.length - 1];
  if (limit && limit.value <= LIMIT_MAX && !strengths.includes(limit)) {
    return `${lead}, but ${LIMIT_PHRASE[limit.key]}.`;
  }
  return `${lead}.`;
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

module.exports = {
  PROTOTYPES,
  ASSIGN_MAX_DISTANCE,
  STRONG_DIM,
  ELITE_AXIS,
  SPECIALIST_BY_DIM,
  assignArchetype,
  buildDescriptor,
  // exported for tests / tuning
  eligiblePrototypes,
  distanceToPrototype,
  confidenceFor,
  traitModifiers,
};
