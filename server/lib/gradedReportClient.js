// gradedReportClient.js — wraps Anthropic SDK to generate AI-graded player reports.
//
// Defensive init: checks ANTHROPIC_API_KEY at module load. Sets `enabled = false` and logs a
// warning when the key is absent. Route handler checks `enabled` before calling and returns
// 503 rather than letting the call reach here.
//
// Output is forced via tool_choice so the response is always structured JSON — no prose-parsing.
// System prompt is cached with cache_control: { type: 'ephemeral' } since it is identical for
// every player call.

'use strict';

// ---------------------------------------------------------------------------
// Defensive init
// ---------------------------------------------------------------------------

let anthropic = null;
let enabled   = false;

(function initClient() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    console.warn('[gradedReportClient] ANTHROPIC_API_KEY is not set — graded-report route will return 503');
    return;
  }
  try {
    const Anthropic = require('@anthropic-ai/sdk');
    anthropic = new Anthropic({ apiKey: key });
    enabled   = true;
  } catch (err) {
    console.error('[gradedReportClient] failed to initialise Anthropic SDK:', err.message);
  }
}());

// ---------------------------------------------------------------------------
// Tool definition — forces structured output
// ---------------------------------------------------------------------------

// Grade card schema inlined six times (JSON Schema $defs not guaranteed by Anthropic validator).
const GRADE_CARD = {
  type: 'object',
  properties: {
    grade: {
      type: 'string',
      description: 'Letter grade: A+, A, A-, B+, B, B-, C+, C, C-, D+, D, D-, F',
    },
    stats: {
      type: 'string',
      description: 'Key stat summary like "26.3 PPG, .478 FG%, .390 3P%". No commentary.',
    },
    context: {
      type: 'string',
      description: '1-2 sentences explaining the grade in WNBA-historical context. Under 220 chars.',
    },
  },
  required: ['grade', 'stats', 'context'],
};

const GRADED_REPORT_TOOL = {
  name: 'graded_player_report',
  description: 'Output a structured graded report for a WNBA player.',
  input_schema: {
    type: 'object',
    properties: {
      peakSeasons: {
        type: 'array',
        items: { type: 'integer' },
        description: 'Only for peak mode: the 3-5 consecutive seasons chosen as the player\'s prime, ascending.',
      },
      categories: {
        type: 'object',
        properties: {
          Scoring:    GRADE_CARD,
          Playmaking: GRADE_CARD,
          Rebounding: GRADE_CARD,
          Defense:    GRADE_CARD,
          Efficiency: GRADE_CARD,
          Longevity:  GRADE_CARD,
        },
        required: ['Scoring', 'Playmaking', 'Rebounding', 'Defense', 'Efficiency', 'Longevity'],
      },
      overall: {
        type: 'object',
        properties: {
          grade: {
            type: 'string',
            description: 'Letter grade: A+, A, A-, B+, B, B-, C+, C, C-, D+, D, D-, F',
          },
          summary: {
            type: 'string',
            description: '1-2 sentence synthesis. Under 280 chars.',
          },
        },
        required: ['grade', 'summary'],
      },
      volume: {
        type: 'object',
        properties: {
          gp:      { type: 'integer' },
          seasons: { type: 'integer' },
          minutes: { type: 'integer' },
        },
        required: ['gp', 'seasons'],
      },
    },
    required: ['categories', 'overall', 'volume'],
  },
};

// Bumped whenever the system prompt, tool schema, or model changes — included in the
// sourceHash so existing cached reports regenerate on the next request.
// v4: Bug fixes — longevity hard-cap enforcement, peak-mode accolade scoping,
//     playoffs peakSeasons removal, seasonsPlayed constraint for peakSeasons.
// v5: Add league-average scope clarification — per-team totals must not be compared
//     against per-player per-game stats.
// v6: Surface position-adjustment in Rebounding stats and context fields so viewers can
//     see why a guard's 2.5 RPG and a center's 6 RPG receive different grades.
const PROMPT_VERSION = 6;

// System prompt is static across all player calls so Anthropic can cache it.
const SYSTEM_PROMPT_TEXT =
  'You are a WNBA stat analyst who assigns letter grades to player performance based on ' +
  'box-score data, league context, and provided awards/championship data. ' +
  'Grade scale: A+ down to F (A+, A, A-, B+, B, B-, C+, C, C-, D+, D, D-, F). ' +
  'Grade contextually against the population of WNBA players who have played at least ' +
  '200 career games. Reserve A+ for top-5 all-time territory in that category. ' +
  'Most starting players should land in the B- to A- range. Most reserve players should land ' +
  'C+ to B. An overall grade of A is exceptional — roughly top-15 all-time. ' +
  'Most players\'s overall should fall C+ to A-. Do not inflate. A C is solid; below C is ' +
  'genuinely thin career data. ' +
  'Volume cap rule: per-game stats earned over a small sample cap at B+ regardless of rate. ' +
  'Small sample means under 50 GP for Peak/Playoffs modes, or under 100 GP for Career mode. ' +
  'Note the small-sample caveat in the context string when this cap applies. ' +
  'Position awareness: a guard with 6 RPG is exceptional; a center with 6 RPG is below average. ' +
  'Grade rebounding and defense with positional context when position is provided. ' +
  'REBOUNDING GRADE — weight OREB significantly more than DREB. Offensive rebounds reflect effort, ' +
  'positioning, and tenacity — a much stronger signal of "real rebounder" than DREB which is largely ' +
  'position-driven. Concrete rule: a player\'s OREB rate should drive the grade more than total RPG. ' +
  'A guard at 1.5 OREB is rare and approaches A-tier rebounding. A forward at 1.5+ OREB is HOF-tier ' +
  'hustle. Cite OREB/DREB split explicitly in the stats string AND context paragraph. ' +
  'Never grade rebounding A+ without elite OREB rate. ' +
  'REBOUNDING POSITION TAG — REQUIRED FOR NON-CENTERS: when the player\'s position is guard ' +
  '(G, PG, SG, or any guard designation), the Rebounding stats field MUST start with ' +
  '"(guard-adj)" and the context paragraph MUST open with "(guard-adjusted)". ' +
  'When the player\'s position is forward or wing (SF, PF, F, W, or any forward/wing designation) ' +
  'but NOT center, the stats field MUST start with "(forward-adj)" and the context paragraph ' +
  'MUST open with "(forward-adjusted)". ' +
  'For centers (C, or any center designation), omit all position tags — they are graded on raw output. ' +
  'These tags must appear even when the grade is high — a guard who is an elite rebounder still ' +
  'gets "(guard-adj)" so the viewer knows the bar was adjusted downward. ' +
  'Example stats field for a guard: "(guard-adj) 2.5 RPG, 0.4 OREB, 2.1 DREB". ' +
  'Example context opening for a guard: "(guard-adjusted) 2.5 RPG with 0.4 OREB is low even for a ' +
  'primary ball-handler; grade reflects limited expectations at the position." ' +
  'Example context opening for a forward: "(forward-adjusted) 5.5 RPG with solid OREB presence ' +
  'is above average for a wing; solid grade reflects positional context." ' +
  'Do NOT use any position tag for centers. ' +
  'Mode-specific weighting for Overall: for Career mode, weight Efficiency/Impact and Longevity ' +
  'most heavily. For Peak mode, weight Scoring and Efficiency. For Playoffs mode, weight ' +
  'Efficiency and the sample of high-leverage games played — championship context matters here. ' +
  'LONGEVITY IS A HARD-CAPPED GRADE. Apply the floors STRICTLY. If the player does not meet ' +
  'the AND/OR clause for a tier, that grade is UNAVAILABLE — drop one tier and re-check. ' +
  'Do NOT cite a threshold the player does not meet. Do NOT write "exceeds floor" for values below the floor. ' +
  'LONGEVITY GRADING SEQUENCE (Career and Playoffs modes only — not Peak mode): ' +
  'Walk this list top-down. Stop at the first tier the player meets. That is the grade. ' +
  '1. A+ requires 18+ seasons played AND 500+ GP. ' +
  '2. A requires 15+ seasons played OR 400+ GP. ' +
  '3. A- requires 12+ seasons played OR 320+ GP. ' +
  '4. B+ requires 9+ seasons played OR 240+ GP. ' +
  '5. B requires 6+ seasons played OR 160+ GP. ' +
  '6. C+ requires 4+ seasons OR 100+ GP. ' +
  '7. Otherwise C or below. ' +
  'The stats string must cite the actual GP and seasons, not the threshold. ' +
  'A player can score lower than their threshold tier if context warrants (e.g. 12 seasons but only ' +
  '200 GP due to chronic injury). ' +
  'PEAK MODE — LONGEVITY SPECIAL RULE: in peak mode, Longevity grades the peak window only ' +
  '(not the full career). A 4-season peak window caps at A- regardless of full-career length. ' +
  'A 3-season window caps at B+. State ONLY the peak-window GP and seasons in the stats string — ' +
  'never cite career totals here. ' +
  'PEAK MODE — CONSECUTIVE SEASONS RULE: the peak window MUST be 3 to 5 CONSECUTIVE seasons. ' +
  'A year is consecutive ONLY if it appears in the seasonsPlayed list provided. ' +
  'Do NOT include any year that is not in seasonsPlayed. If the player missed a year between two ' +
  'seasons, that breaks consecutiveness — do not bridge the gap. If a player has multiple distinct ' +
  'eras, pick the single best consecutive window within seasonsPlayed. ' +
  'Return those years ascending in peakSeasons. peakSeasons MUST be a strict subset of seasonsPlayed. ' +
  'AWARDS AND CHAMPIONSHIPS IN PEAK MODE — SCOPING RULE: when mode=peak, the Overall summary ' +
  'MUST ONLY cite championships and All-WNBA selections that occurred WITHIN the peakSeasons window. ' +
  'Championships and All-WNBA selections from before or after the peak window MUST NOT be mentioned. ' +
  'If the player won 0 championships in the peak window, do not write "champion" in Peak Overall. ' +
  'Count only the accolades that fall within the chosen peakSeasons range, not career totals. ' +
  'AWARDS AND CHAMPIONSHIPS IN CAREER AND PLAYOFFS MODES — MANDATORY USAGE: when the user message ' +
  'provides championships and accolades data, you MUST incorporate those facts into the relevant ' +
  'context paragraphs and overall summary. Do not ignore provided award data. A 4-time champion\'s ' +
  'Playoffs Overall must reflect that championship context — per-game numbers alone do not capture legacy. ' +
  'A player with multiple MVP awards or All-WNBA First Team selections has a higher floor for ' +
  'the Overall grade than raw stats suggest. Cite the specific awards briefly in the summary. ' +
  'Hallucination guard: use only the numbers, league averages, championships, and accolades ' +
  'provided in the user message. Do not invent statistics or awards beyond what is provided. ' +
  'If a stat is missing, omit it from the stats string. ' +
  'League average note: the leagueByYear values are PER-TEAM totals, not per-player averages. ' +
  'Never compare a player\'s per-game stat directly to a league-team aggregate. ' +
  'Only cite league context when you can derive a meaningful per-player comparison from the provided data. ' +
  'If you cannot derive a sound comparison, omit the league-average reference entirely. ' +
  'Playoffs note: if the user message specifies mode=playoffs and total GP is under 20, ' +
  'include a small-sample warning in the overall summary. ' +
  'Output discipline: output structured JSON via the graded_player_report tool only. ' +
  'Keep context strings under 220 characters each. Keep summary under 280 characters.';

// ---------------------------------------------------------------------------
// Shape validation
// ---------------------------------------------------------------------------

const VALID_GRADES = new Set(['A+','A','A-','B+','B','B-','C+','C','C-','D+','D','D-','F']);
const REQUIRED_CATEGORIES = ['Scoring', 'Playmaking', 'Rebounding', 'Defense', 'Efficiency', 'Longevity'];

/**
 * Validate the structured output Claude returns via the graded_player_report tool.
 * Throws a descriptive Error on any contract violation so callers surface a 502
 * rather than caching malformed data.
 * Logs warnings (does not throw) for soft-constraint violations that indicate prompt drift.
 *
 * @param {unknown} input        - toolUse.input from the Claude response
 * @param {string}  mode         - 'career' | 'peak' | 'playoffs'
 * @param {number[]} [seasonsPlayed] - actual season years from inputs (for peak subset check)
 */
function validateReportShape(input, mode, seasonsPlayed) {
  if (!input || typeof input !== 'object') {
    throw new Error('[gradedReportClient] tool output is not an object');
  }

  // categories
  if (!input.categories || typeof input.categories !== 'object') {
    throw new Error('[gradedReportClient] tool output missing: categories');
  }
  for (const cat of REQUIRED_CATEGORIES) {
    const card = input.categories[cat];
    if (!card || typeof card !== 'object') {
      throw new Error(`[gradedReportClient] categories.${cat} missing`);
    }
    if (!VALID_GRADES.has(card.grade)) {
      throw new Error(`[gradedReportClient] categories.${cat}.grade invalid: "${card.grade}"`);
    }
    if (typeof card.stats !== 'string' || card.stats.trim() === '') {
      throw new Error(`[gradedReportClient] categories.${cat}.stats missing or empty`);
    }
    if (typeof card.context !== 'string' || card.context.trim() === '') {
      throw new Error(`[gradedReportClient] categories.${cat}.context missing or empty`);
    }
  }

  // overall
  if (!input.overall || typeof input.overall !== 'object') {
    throw new Error('[gradedReportClient] tool output missing: overall');
  }
  if (!VALID_GRADES.has(input.overall.grade)) {
    throw new Error(`[gradedReportClient] overall.grade invalid: "${input.overall.grade}"`);
  }
  if (typeof input.overall.summary !== 'string' || input.overall.summary.trim() === '') {
    throw new Error('[gradedReportClient] overall.summary missing or empty');
  }

  // volume
  if (!input.volume || typeof input.volume !== 'object') {
    throw new Error('[gradedReportClient] tool output missing: volume');
  }
  if (!Number.isInteger(input.volume.gp)) {
    throw new Error(`[gradedReportClient] volume.gp must be an integer, got: ${input.volume.gp}`);
  }
  if (!Number.isInteger(input.volume.seasons)) {
    throw new Error(`[gradedReportClient] volume.seasons must be an integer, got: ${input.volume.seasons}`);
  }

  // Longevity grade soft-check (warn, don't throw) — catches prompt violations where the model
  // assigns A or A+ to a player whose volume doesn't meet those thresholds.
  // Thresholds: A requires 15+ seasons OR 400+ GP; A+ requires 18+ seasons AND 500+ GP.
  if (mode !== 'peak') {
    const lonGrade = input.categories?.Longevity?.grade;
    const gp      = input.volume.gp;
    const seasons = input.volume.seasons;
    if ((lonGrade === 'A+' || lonGrade === 'A') && gp < 400 && seasons < 15) {
      console.warn(
        `[gradedReportClient] Longevity grade "${lonGrade}" assigned but player has ${gp} GP and ${seasons} seasons — ` +
        'threshold for A is 15+ seasons OR 400+ GP. Possible prompt violation.'
      );
    }
  }

  // peakSeasons — required only for peak mode; must NOT appear in playoffs mode
  if (mode === 'playoffs') {
    if (input.peakSeasons != null) {
      console.warn(
        '[gradedReportClient] peakSeasons returned in playoffs mode — stripping before cache/response. ' +
        'Playoffs mode has no peak window concept.'
      );
      // Strip it so the cached doc never has peakSeasons for a playoff report
      delete input.peakSeasons;
    }
  } else if (mode === 'peak') {
    if (!Array.isArray(input.peakSeasons) || input.peakSeasons.length === 0) {
      throw new Error('[gradedReportClient] peakSeasons must be a non-empty array for mode=peak');
    }
    for (const yr of input.peakSeasons) {
      if (!Number.isInteger(yr) || yr < 1997) {
        throw new Error(`[gradedReportClient] peakSeasons contains invalid year: ${yr}`);
      }
    }
    const sorted = [...input.peakSeasons].sort((a, b) => a - b);

    // Warn if seasons are not consecutive — the report is still cached so the page can render,
    // but the warning surfaces in server logs so non-consecutive picks can be investigated.
    const isConsecutive = sorted.every((yr, i) => i === 0 || yr === sorted[i - 1] + 1);
    if (!isConsecutive) {
      console.warn(
        `[gradedReportClient] peakSeasons non-consecutive: [${sorted.join(', ')}] — prompt should enforce consecutive windows`
      );
    }

    // Warn if peakSeasons includes a year not in seasonsPlayed (AI invented a season).
    if (Array.isArray(seasonsPlayed) && seasonsPlayed.length > 0) {
      const playedSet = new Set(seasonsPlayed);
      const invented = sorted.filter(yr => !playedSet.has(yr));
      if (invented.length > 0) {
        console.warn(
          `[gradedReportClient] peakSeasons includes year(s) not in seasonsPlayed: [${invented.join(', ')}] ` +
          `— seasonsPlayed: [${seasonsPlayed.join(', ')}]. AI invented a season.`
        );
      }
    }
  }
}

// ---------------------------------------------------------------------------
// User message builder
// ---------------------------------------------------------------------------

function fmt(n, decimals = 1) {
  if (n == null) return null;
  return parseFloat(n.toFixed(decimals));
}

function buildUserMessage(inputs) {
  const { player, mode, seasonRows, careerRow, leagueByYear, advancedRows, championships, accolades, seasonsPlayed } = inputs;

  const lines = [
    `Player: ${player.name}`,
    `Position: ${player.position || 'Unknown'}`,
    `Mode: ${mode}`,
  ];

  // seasonsPlayed — explicit list of years the player has real data for (GP > 0).
  // The prompt uses this to constrain peakSeasons to a strict subset and to detect gaps.
  if (Array.isArray(seasonsPlayed) && seasonsPlayed.length > 0) {
    lines.push(`Seasons played (actual, GP > 0): ${seasonsPlayed.join(', ')}`);
  }

  // Championships and accolades — injected as fact so the model must use them.
  // In peak mode: the AI is instructed to scope these to the chosen peakSeasons window,
  // so we still pass the full lists and rely on the prompt constraint.
  if (championships && championships.length > 0) {
    lines.push(`Championships (career): ${championships.join(', ')} (${championships.length}× WNBA Champion)`);
    if (mode === 'peak') {
      lines.push('Note: in peak mode, cite ONLY championships that fall within your chosen peakSeasons window in the Overall summary.');
    }
  }
  if (accolades) {
    const accoladeParts = [];
    if (accolades.mvp?.length)          accoladeParts.push(`MVP: ${accolades.mvp.join(', ')}`);
    if (accolades.finalsMVP?.length)     accoladeParts.push(`Finals MVP: ${accolades.finalsMVP.join(', ')}`);
    if (accolades.dpoy?.length)          accoladeParts.push(`DPOY: ${accolades.dpoy.join(', ')}`);
    if (accolades.roy?.length)           accoladeParts.push(`ROY: ${accolades.roy.join(', ')}`);
    if (accolades.sixth?.length)         accoladeParts.push(`Sixth Player: ${accolades.sixth.join(', ')}`);
    if (accolades.allWnbaFirst?.length)  accoladeParts.push(`All-WNBA First Team: ${accolades.allWnbaFirst.join(', ')} (${accolades.allWnbaFirst.length}× selection)`);
    if (accoladeParts.length > 0) {
      lines.push(`Awards (career): ${accoladeParts.join(' | ')}`);
      if (mode === 'peak') {
        lines.push('Note: in peak mode, cite ONLY awards that fall within your chosen peakSeasons window in the Overall summary.');
      }
    }
  }

  // Merge advanced rows by year for inline display
  const advByYear = {};
  if (advancedRows?.length) {
    for (const a of advancedRows) advByYear[String(a.year)] = a;
  }

  lines.push('');
  if (mode === 'playoffs') {
    lines.push('Per-season rows (playoffs):');
  } else {
    lines.push('Per-season rows (regular season):');
  }
  for (const r of seasonRows) {
    const yr = String(r.year);
    const parts = [
      `${yr}: ${r.gp ?? '?'} GP`,
      r.pts != null    ? `${fmt(r.pts)} PPG` : null,
      r.reb != null    ? `${fmt(r.reb)} RPG` : null,
      (r.orb != null && r.drb != null) ? `${fmt(r.orb)} OREB/${fmt(r.drb)} DREB` : null,
      r.ast != null    ? `${fmt(r.ast)} APG` : null,
      r.stl != null    ? `${fmt(r.stl)} STL` : null,
      r.blk != null    ? `${fmt(r.blk)} BLK` : null,
      r.tov != null    ? `${fmt(r.tov)} TOV` : null,
      r.fgPct  != null ? `.${Math.round(r.fgPct  * 1000).toString().padStart(3,'0')} FG%`  : null,
      r.fg3Pct != null ? `.${Math.round(r.fg3Pct * 1000).toString().padStart(3,'0')} 3P%`  : null,
      r.ftPct  != null ? `.${Math.round(r.ftPct  * 1000).toString().padStart(3,'0')} FT%`  : null,
      r.min    != null ? `${fmt(r.min)} MIN` : null,
    ].filter(Boolean);
    lines.push('  ' + parts.join(', '));

    // Append advanced stats for this year if available
    const adv = advByYear[yr];
    if (adv) {
      const advParts = [
        adv.tsPct  != null ? `TS%: .${Math.round(adv.tsPct  * 1000).toString().padStart(3,'0')}` : null,
        adv.per    != null ? `PER: ${fmt(adv.per)}`    : null,
        adv.ws     != null ? `WS: ${fmt(adv.ws)}`      : null,
        adv.wsPer48 != null ? `WS/48: ${fmt(adv.wsPer48, 3)}` : null,
        adv.usgPct != null ? `USG%: ${fmt(adv.usgPct * 100)}%` : null,
        adv.astPct != null ? `AST%: ${fmt(adv.astPct * 100)}%` : null,
      ].filter(Boolean);
      if (advParts.length) lines.push('    Advanced: ' + advParts.join(', '));
    }
  }

  if (careerRow) {
    lines.push('');
    const cr = careerRow;
    const careerParts = [
      cr.gp    != null ? `${cr.gp} GP`          : null,
      cr.pts   != null ? `${fmt(cr.pts)} PPG`    : null,
      cr.reb   != null ? `${fmt(cr.reb)} RPG`    : null,
      (cr.orb != null && cr.drb != null) ? `${fmt(cr.orb)} OREB/${fmt(cr.drb)} DREB` : null,
      cr.ast   != null ? `${fmt(cr.ast)} APG`    : null,
      cr.stl   != null ? `${fmt(cr.stl)} STL`    : null,
      cr.blk   != null ? `${fmt(cr.blk)} BLK`    : null,
      cr.tov   != null ? `${fmt(cr.tov)} TOV`    : null,
      cr.fgPct  != null ? `.${Math.round(cr.fgPct  * 1000).toString().padStart(3,'0')} FG%`  : null,
      cr.fg3Pct != null ? `.${Math.round(cr.fg3Pct * 1000).toString().padStart(3,'0')} 3P%`  : null,
      cr.ftPct  != null ? `.${Math.round(cr.ftPct  * 1000).toString().padStart(3,'0')} FT%`  : null,
    ].filter(Boolean);
    lines.push(`Career totals: ${careerParts.join(', ')}`);
  }

  if (Object.keys(leagueByYear).length) {
    lines.push('');
    lines.push('League averages (per team per game) for relevant seasons:');
    for (const [yr, lg] of Object.entries(leagueByYear).sort()) {
      lines.push(`  ${yr}: ${fmt(lg.pts)} PPG, .${Math.round(lg.pts / (lg.fga * 2 + lg.fta * 0.44) * 1000) || '???'} TS-approx, ${fmt(lg.ast)} APG, ${fmt(lg.trb)} RPG`);
    }
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Retry helper
// ---------------------------------------------------------------------------

/**
 * Call an async fn, retrying once on transient errors (5xx, ETIMEDOUT, ECONNRESET).
 * 4xx errors are not retried — they won't improve and the user should see them immediately.
 */
async function callWithRetry(fn, { retries = 1, delayMs = 1500 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const transient = err.status >= 500 || err.code === 'ETIMEDOUT' || err.code === 'ECONNRESET' || /timeout/i.test(err.message ?? '');
      if (!transient || attempt === retries) throw err;
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a graded report for a player.
 *
 * @param {object} params
 * @param {object} params.inputs     - From gradedReportInputs.buildInputs()
 * @param {string} params.playerId   - ESPN athlete ID
 * @param {string} params.mode       - 'career' | 'peak' | 'playoffs'
 * @param {string} params.sourceHash - Caller-computed SHA-1 over canonical inputs
 * @returns {Promise<object>}  The tool input object from Claude
 * @throws  On any SDK or parse error — caller translates to 502.
 */
async function callClaude({ inputs, mode }) {
  if (!anthropic) {
    throw new Error('Anthropic client not initialised');
  }

  const userMessage = buildUserMessage(inputs);

  const response = await callWithRetry(() => anthropic.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    system: [
      {
        type:          'text',
        text:          SYSTEM_PROMPT_TEXT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    tools:       [GRADED_REPORT_TOOL],
    tool_choice: { type: 'tool', name: 'graded_player_report' },
    messages: [
      {
        role:    'user',
        content: userMessage,
      },
    ],
  }));

  const toolUse = response.content.find(block => block.type === 'tool_use');
  if (!toolUse) {
    throw new Error('[gradedReportClient] Claude did not return a tool_use block');
  }

  // Shape-validate before returning so a malformed Claude response surfaces as a clean 502
  // rather than silently caching bad data. Pass seasonsPlayed for peakSeasons subset check.
  validateReportShape(toolUse.input, mode, inputs.seasonsPlayed);

  return toolUse.input;
}

module.exports = { callClaude, validateReportShape, PROMPT_VERSION, get enabled() { return enabled; } };
