// Player fingerprint — the shared, era-normalized profile vector behind Archetype Badges and
// Cross-Era Similarity. WHY this shape:
//
//   - Era-normalization is the hard requirement (comparing a 2013 player to a 2025 one fairly).
//     The percentile system already solves it: getPlayerPercentiles returns each season's stats as
//     0-100 percentiles AGAINST THAT SEASON'S LEAGUE (position-pooled). So a fingerprint built from
//     those percentiles is era-fair by construction — no second normalization pipeline needed.
//   - Continuous, not bucketed. The fingerprint is 13 independent 0-100 axes. Archetype assignment
//     (a sibling module) reads this vector; it does NOT collapse players into binary axes first,
//     which is the failure mode of the Reddit roles paper (dissimilar players forced into one
//     cryptic bucket). Keeping the axes continuous is what lets the hover card SHOW the player's
//     own profile so the eventual label is visibly justified.
//   - Pure core, thin I/O. buildFingerprint / fingerprintDistance are pure functions over already-
//     fetched inputs, so the known-player truth set can test the math with synthetic vectors and no
//     network. getPlayerFingerprint is the only async part (it just fetches + delegates).
//
// Axes are sourced ONLY from stats the percentile pipeline already distributes (see
// percentileClient.PERCENTILE_STATS), so v1 adds zero new league-wide data plumbing. If the truth
// set later fails on playstyle nuance (e.g. high-volume-inefficient scorers, or usage), the planned
// upgrade is to add advanced-rate axes (USG%/TS%/AST%) — see the project plan's hybrid option.

'use strict';

const { getProvider } = require('../../providers');
const { getPlayerPercentiles, resolvePlayerPos } = require('../percentileClient');

// The 13 axes. `mode` keys match getPlayerPercentiles output ('perGame' | 'per36' | 'totals');
// `stat` is a PERCENTILE_STATS key. Per-36 is used for volume axes so a high-minute starter and a
// bench player are compared by RATE, not raw counting totals. TOV is already inverted upstream
// (INVERTED_STATS), so a high percentile means GOOD ball security — direction is correct as-is.
const AXES = [
  { key: 'scoringVolume', label: 'Scoring Volume',  stat: 'PTS',     mode: 'per36' },
  { key: 'finishing',     label: 'Finishing',       stat: 'FG_PCT',  mode: 'perGame' },
  { key: 'threeVolume',   label: '3PT Volume',      stat: 'FG3A',    mode: 'per36' },
  { key: 'threeAccuracy', label: '3PT Accuracy',    stat: 'FG3_PCT', mode: 'perGame' },
  { key: 'rimPressure',   label: 'Rim Pressure',    stat: 'FTA',     mode: 'per36' },
  { key: 'playmaking',    label: 'Playmaking',      stat: 'AST',     mode: 'per36' },
  { key: 'ballSecurity',  label: 'Ball Security',   stat: 'TOV',     mode: 'per36' },
  { key: 'offRebounding', label: 'Off. Rebounding', stat: 'OREB',    mode: 'per36' },
  { key: 'defRebounding', label: 'Def. Rebounding', stat: 'DREB',    mode: 'per36' },
  { key: 'steals',        label: 'Steals',          stat: 'STL',     mode: 'per36' },
  { key: 'rimProtection', label: 'Rim Protection',  stat: 'BLK',     mode: 'per36' },
  { key: 'ftShooting',    label: 'FT Shooting',     stat: 'FT_PCT',  mode: 'perGame' },
  { key: 'workload',      label: 'Workload',        stat: 'MIN',     mode: 'perGame' },
];

const AXIS_KEYS = AXES.map(a => a.key);

// Schema version of the cached similarity fingerprint. The cache (playerFingerprints, built by
// percentileClient.buildFingerprintIndex) stamps every doc with this; Cross-Era Similarity reads only
// docs matching the CURRENT version, so vectors built against an older definition fall out of use until
// re-seeded. BUMP THIS whenever the cached axes' MEANING changes — adding/removing/reordering an axis,
// changing a stat/mode, OR changing the percentile POOL the similarity fingerprint is built against.
// v2: similarity fingerprint switched from position-pooled to league-wide ('all') percentiles so
// matching reflects absolute playstyle (a guard's blocks aren't inflated "for a guard" and matched to a big).
// v3: aggregateFingerprint applies recency decay (see RECENCY_HALF_LIFE_YEARS) instead of a flat
// minutes-weighted mean, so a player whose role genuinely shifted (e.g. a scorer who became a
// playmaker) reads as their recent self instead of an averaged blend of every era they've played.
const AXES_VERSION = 3;

// Composite "play dimensions" — the 13 axes collapsed into 6 buckets for the radar so a profile
// reads as a SHAPE at a glance (13 equal bars have no gestalt). Order here is the radar's spoke
// order. 'Activity' (workload/role size) is a real signal but not a playstyle trait, so the
// descriptor (in archetypes.js) ignores it even though the radar shows it.
//
// Aggregation matters: a plain mean MASKS signature traits. Deliberate choices —
//   - Playmaking = assists only (volume), blended with assist-control quality (AST/TO). Pairing it
//     with raw turnover rate buried elite passers, so control enters via the AST/TO ratio instead.
//   - Defense = position-aware + tempered (agg:'defense'). Steals and blocks are positionally
//     exclusive (guards steal, bigs block), so the dimension leads with the player's expected tool
//     for their position; a plain `max` over-credited steal-happy gamblers as "elite defense".
//   - 'Activity'/workload is intentionally NOT a dimension — it's role size, not playstyle; it stays
//     a fingerprint axis (shown in the 13-bar detail), keeping the radar to 5 playstyle spokes.
// `agg` defaults to 'mean'.
const PLAYMAKING_VOLUME_WEIGHT = 0.6;  // 60% assist volume / 40% AST-to-TO control
const DEFENSE_DOMINANT_WEIGHT = 0.65;  // 65% the position's main defensive tool / 35% the other
const DIMENSIONS = [
  { key: 'scoring',    label: 'Scoring',    axes: ['scoringVolume', 'finishing', 'rimPressure'] },
  { key: 'shooting',   label: 'Shooting',   axes: ['threeVolume', 'threeAccuracy', 'ftShooting'] },
  { key: 'playmaking', label: 'Playmaking', axes: ['playmaking'],
    blend: { quality: 'playmakingQuality', volumeWeight: PLAYMAKING_VOLUME_WEIGHT } },
  { key: 'rebounding', label: 'Rebounding', axes: ['offRebounding', 'defRebounding'] },
  { key: 'defense',    label: 'Defense',    axes: ['steals', 'rimProtection'], agg: 'defense' },
];

/**
 * Defense dimension: lead with the position's expected tool (guards steal, bigs block), tempered so
 * one elite stat can't max it out. `0.65·dominant + 0.35·other`. Guard = pos contains 'G'.
 * @returns {number|null} 0-100, or null if neither steals nor blocks is present.
 */
function aggregateDefense(axes, pos) {
  const steals = axes?.steals;
  const blocks = axes?.rimProtection;
  const isGuard = /G/i.test(String(pos ?? ''));
  const [dominant, other] = isGuard ? [steals, blocks] : [blocks, steals];
  const d = typeof dominant === 'number' ? dominant : null;
  const o = typeof other === 'number' ? other : null;
  if (d === null && o === null) return null;
  if (d === null) return Math.round(o);
  if (o === null) return Math.round(d);
  return Math.round(DEFENSE_DOMINANT_WEIGHT * d + (1 - DEFENSE_DOMINANT_WEIGHT) * o);
}

/**
 * Collapse a career axis vector into the 5 composite play dimensions (radar spokes).
 * @param {Object<string, number|null>} axes  the `axes` field of a fingerprint
 * @param {Object<string, number|null>} [advanced]  advanced signals (e.g. playmakingQuality) used by
 *   dimensions with a `blend`; when absent, those dimensions fall back to their axis aggregate.
 * @param {string} [pos]  position abbreviation (G/F/C) — used by the position-aware Defense agg.
 * @returns {Array<{key:string, label:string, value:number|null}>} in DIMENSIONS order; value is the
 *   rounded aggregate (mean, or the position-aware Defense blend) of member axes — then, for a
 *   `blend` dimension with its quality signal present, a weighted mix of that aggregate (volume) and
 *   the signal (quality). null if no member axis is present.
 */
function buildDimensions(axes, advanced = {}, pos = '') {
  return DIMENSIONS.map(dim => {
    let value;
    if (dim.agg === 'defense') {
      value = aggregateDefense(axes, pos);
    } else {
      const vals = dim.axes.map(k => axes?.[k]).filter(v => typeof v === 'number');
      value = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
    }
    // Blend in an advanced quality signal (e.g. playmaking: assist volume + AST/TO control).
    if (dim.blend && typeof value === 'number') {
      const quality = advanced?.[dim.blend.quality];
      if (typeof quality === 'number') {
        const w = dim.blend.volumeWeight;
        value = Math.round(w * value + (1 - w) * quality);
      }
    }
    return { key: dim.key, label: dim.label, value };
  });
}

// Career-level sample gate. Per-season samples are already gated upstream (the provider drops any
// season below 10 GP / 10 MPG before it ever reaches the percentile pipeline), so this floor only
// guards against a career too thin to characterize — a handful of qualifying minutes total.
const MIN_CAREER_MINUTES = 500;

// Recency half-life, in seasons, for aggregateFingerprint's decay weighting: a season's contribution
// halves every this-many-years back from the player's OWN last qualifying season (not today's date —
// see aggregateFingerprint). Tuned against a full-index live sweep (459 players): half-life 4 flipped
// 42 archetype labels (many long-career players with no real role change — just noise from
// discounting their early seasons too hard); half-life 8 only reduced that to 26, diminishing
// returns. 6 is the knee of that curve — 28 flips, same qualitative fix for the motivating case
// (Alyssa Thomas's playmaking axis rises to reflect her recent seasons) without over-discounting
// long careers.
const RECENCY_HALF_LIFE_YEARS = 6;

// Playmaking blends assist VOLUME (the era-normalized axis) with assist CONTROL (career assist-to-
// turnover ratio). Raw turnover rate alone unfairly punishes high-usage creators (their turnovers
// are the cost of their assists); AST/TO credits the assists, so an elite-volume passer who is also
// efficient reads as elite even with a high raw turnover count. AST/TO is mapped 0-100 on a fixed,
// era-stable scale (~0.8 → 0, ~2.8 → 100) — a later refinement could percentile it like the axes.
const AST_TO_LO = 0.8;
const AST_TO_HI = 2.8;

/** Map a career assist-to-turnover ratio to a 0-100 quality score (clamped), or null if unknown. */
function normalizeAstTo(astTo) {
  if (typeof astTo !== 'number' || !Number.isFinite(astTo)) return null;
  const pct = ((astTo - AST_TO_LO) / (AST_TO_HI - AST_TO_LO)) * 100;
  return Math.round(Math.max(0, Math.min(100, pct)));
}

/**
 * Pull each axis from the right mode's percentile vector for a single season.
 * @param {{perGame?:Object, per36?:Object, totals?:Object}|null} seasonPercentiles
 * @returns {Object<string, number|null>} axisKey -> 0-100, or null where the source was missing.
 */
function buildSeasonFingerprint(seasonPercentiles) {
  const fp = {};
  for (const axis of AXES) {
    const modeVec = seasonPercentiles?.[axis.mode] ?? null;
    const v = modeVec ? modeVec[axis.stat] : null;
    fp[axis.key] = typeof v === 'number' ? v : null;
  }
  return fp;
}

/**
 * Recency-decayed, minutes-weighted career vector across seasons. A bigger season pulls each axis
 * harder, same as before — but each season's minutes are also scaled down the further back it sits
 * from the player's OWN last qualifying season, so a genuine role shift (e.g. a scorer who became a
 * playmaker) reads as their recent self instead of an average of every era. The anchor is the
 * player's last season, not today's date, so a retired player's profile stops drifting once they
 * stop playing. Null axis values are skipped (don't dilute the mean toward 0); an axis with no data
 * in any season -> null.
 * @param {Array<{season:string|number, minutes:number, fingerprint:Object<string,number|null>}>} seasonFps
 * @returns {Object<string, number|null>}
 */
function aggregateFingerprint(seasonFps) {
  const seasonYears = seasonFps.map(s => Number(s.season)).filter(Number.isFinite);
  const lastSeason = seasonYears.length ? Math.max(...seasonYears) : null;
  const axes = {};
  for (const key of AXIS_KEYS) {
    let weighted = 0;
    let weight = 0;
    for (const s of seasonFps) {
      const v = s.fingerprint[key];
      const m = s.minutes;
      if (typeof v === 'number' && typeof m === 'number' && m > 0) {
        const age = lastSeason !== null && Number.isFinite(Number(s.season)) ? lastSeason - Number(s.season) : 0;
        const decay = 0.5 ** (age / RECENCY_HALF_LIFE_YEARS);
        weighted += v * m * decay;
        weight += m * decay;
      }
    }
    axes[key] = weight > 0 ? Math.round(weighted / weight) : null;
  }
  return axes;
}

/**
 * Assemble a career fingerprint from already-fetched inputs (pure — the testable core).
 * @param {{percentiles:Object|null, seasonAverages:{statsByModeBySeason:Object}|null}} input
 *   percentiles: getPlayerPercentiles output ({ [season]: {perGame,per36,totals} }).
 *   seasonAverages: getPlayerSeasonAverages output — used only for the per-season minutes weight.
 * @returns {{axes:Object, seasonsCovered:number, totalMinutes:number, perSeason:Array}
 *           | {insufficient:true, reason:string, totalMinutes:number, seasonsCovered:number}}
 */
function buildFingerprint({ percentiles, seasonAverages } = {}) {
  if (!percentiles || !seasonAverages) {
    return { insufficient: true, reason: 'no-data', totalMinutes: 0, seasonsCovered: 0 };
  }

  const totalsBySeason = seasonAverages.statsByModeBySeason ?? {};
  const seasonFps = [];
  let totalMinutes = 0;
  let careerAst = 0;
  let careerTov = 0;
  // Career counting totals + games, to derive headline per-game stats (PPG/RPG/APG) for the UI.
  let careerPts = 0;
  let careerReb = 0;
  let careerGames = 0;

  for (const season of Object.keys(percentiles)) {
    // Weight by actual minutes that season; without a minutes figure we can't weight it, so skip.
    const minutes = totalsBySeason[season]?.Totals?.MIN ?? null;
    if (typeof minutes !== 'number' || minutes <= 0) continue;
    seasonFps.push({ season, minutes, fingerprint: buildSeasonFingerprint(percentiles[season]) });
    totalMinutes += minutes;
    // Accumulate raw season totals for career AST/TO (the advanced playmaking-control signal) + the
    // headline per-game line. Games are derived as season minutes / MPG (GP isn't surfaced directly).
    const tot = totalsBySeason[season]?.Totals;
    const mpg = totalsBySeason[season]?.PerGame?.MIN;
    if (typeof tot?.AST === 'number') { careerAst += tot.AST; }
    if (typeof tot?.TOV === 'number') careerTov += tot.TOV;
    if (typeof tot?.PTS === 'number') careerPts += tot.PTS;
    if (typeof tot?.REB === 'number') careerReb += tot.REB;
    if (typeof mpg === 'number' && mpg > 0) careerGames += minutes / mpg;
  }

  if (!seasonFps.length || totalMinutes < MIN_CAREER_MINUTES) {
    return { insufficient: true, reason: 'sample', totalMinutes, seasonsCovered: seasonFps.length };
  }

  const astTo = careerTov > 0 ? careerAst / careerTov : null;
  const r1 = v => Math.round(v * 10) / 10;
  const stats = careerGames >= 1
    ? { ppg: r1(careerPts / careerGames), rpg: r1(careerReb / careerGames), apg: r1(careerAst / careerGames), gp: Math.round(careerGames) }
    : null;

  return {
    axes: aggregateFingerprint(seasonFps),
    advanced: { astTo, playmakingQuality: normalizeAstTo(astTo) },
    stats,
    seasonsCovered: seasonFps.length,
    totalMinutes,
    perSeason: seasonFps.map(s => ({ season: s.season, minutes: s.minutes, axes: s.fingerprint })),
  };
}

/**
 * Distance between two career axis vectors. RMS over the shared (both non-null) axes keeps the
 * result on the same 0-100 scale no matter how many axes overlapped — so a cross-era pair missing
 * a few axes (e.g. pre-3pt-era volume) isn't penalized just for having fewer comparable dimensions.
 * @param {Object<string,number|null>} a  axes vector (the `axes` field of a fingerprint)
 * @param {Object<string,number|null>} b
 * @returns {{distance:number|null, similarity:number|null, axesUsed:number}}
 *   distance 0 (identical) .. 100; similarity = 100 - distance (higher = more alike); both null if
 *   no axis overlapped.
 */
function fingerprintDistance(a, b) {
  let sumSq = 0;
  let used = 0;
  for (const key of AXIS_KEYS) {
    const va = a?.[key];
    const vb = b?.[key];
    if (typeof va === 'number' && typeof vb === 'number') {
      const d = va - vb;
      sumSq += d * d;
      used += 1;
    }
  }
  if (used === 0) return { distance: null, similarity: null, axesUsed: 0 };
  const rms = Math.sqrt(sumSq / used);
  return { distance: rms, similarity: Math.round(100 - rms), axesUsed: used };
}

// Cross-Era Similarity uses a SIGNATURE-weighted distance instead of the plain RMS above (which is
// kept as-is for archetype prototype matching). Plain RMS treats all 13 axes equally, so two players
// read "close" by sharing middling axes — a shooter ends up matched to rebounders on shared
// averageness, and scores compress. Weighting each axis by how far the TARGET sits from the 50th
// percentile makes the target's defining skills dominate the comparison ("players like X" = like X
// on what makes X distinctive). The floor keeps every axis contributing a little so two flat role
// players aren't compared on pure noise. Asymmetric (weights come from the target) — correct here.
const SALIENCE_FLOOR = 0.2;

/**
 * Signature-weighted distance from `target` to `cand` over their shared (both non-null) axes.
 * Weight per axis = SALIENCE_FLOOR + |target_i - 50| / 50, so the target's extreme (elite or low)
 * axes drive the match. Same 0-100 scale + return contract as fingerprintDistance.
 * @param {Object<string,number|null>} target  the reference player's axes (weights come from here)
 * @param {Object<string,number|null>} cand
 * @returns {{distance:number|null, similarity:number|null, axesUsed:number}}
 */
function weightedFingerprintDistance(target, cand) {
  let sumSq = 0;
  let sumW = 0;
  let used = 0;
  for (const key of AXIS_KEYS) {
    const vt = target?.[key];
    const vc = cand?.[key];
    if (typeof vt === 'number' && typeof vc === 'number') {
      const w = SALIENCE_FLOOR + Math.abs(vt - 50) / 50;
      const d = vt - vc;
      sumSq += w * d * d;
      sumW += w;
      used += 1;
    }
  }
  if (used === 0) return { distance: null, similarity: null, axesUsed: 0 };
  const rms = Math.sqrt(sumSq / sumW);
  return { distance: rms, similarity: Math.round(100 - rms), axesUsed: used };
}

/**
 * Fetch + assemble a player's career fingerprint via the active provider.
 * Note: getPlayerPercentiles already fetches season averages internally, so this makes a second
 * getPlayerSeasonAverages call for the minutes weights — a known minor redundancy. Threading
 * minutes out of the percentile call would remove it; deferred until it shows up as a hotspot.
 * @param {string|number} playerId
 * @param {{pool?: 'position'|'all'}} [opts] percentile pool: 'position' (default, for archetypes) or
 *   'all' (league-wide absolute playstyle, used to build the Cross-Era Similarity cache).
 * @returns {Promise<Object>} buildFingerprint result, plus { playerId, pos }.
 */
async function getPlayerFingerprint(playerId, { pool = 'position' } = {}) {
  const [percentiles, seasonAverages, pos] = await Promise.all([
    getPlayerPercentiles(playerId, { pool }),
    getProvider().getPlayerSeasonAverages(playerId),
    resolvePlayerPos(playerId), // stable G/F/C (playerIndex), NOT the prefetch-timing-dependent feed pos
  ]);
  const result = buildFingerprint({ percentiles, seasonAverages });
  return { playerId: String(playerId), pos: pos ?? null, ...result };
}

module.exports = {
  AXES,
  AXIS_KEYS,
  AXES_VERSION,
  DIMENSIONS,
  MIN_CAREER_MINUTES,
  RECENCY_HALF_LIFE_YEARS,
  buildDimensions,
  normalizeAstTo,
  buildSeasonFingerprint,
  aggregateFingerprint,
  buildFingerprint,
  fingerprintDistance,
  weightedFingerprintDistance,
  getPlayerFingerprint,
};
