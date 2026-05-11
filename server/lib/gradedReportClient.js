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
const PROMPT_VERSION = 1;

// System prompt is static across all player calls so Anthropic can cache it.
const SYSTEM_PROMPT_TEXT =
  'You are a WNBA stat analyst who assigns letter grades to player performance based on ' +
  'box-score data and league context. ' +
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
  'Mode-specific weighting for Overall: for Career mode, weight Efficiency/Impact and Longevity ' +
  'most heavily. For Peak mode, weight Scoring and Efficiency. For Playoffs mode, weight ' +
  'Efficiency and the sample of high-leverage games played. ' +
  'Longevity rule: Longevity grade is explicitly tied to GP and seasons played. ' +
  'A 5-year career with normal health caps at A-. A 10+ year career can reach A+. ' +
  'Under 4 seasons caps at B. Under 100 GP career caps at B-. State the actual GP and seasons ' +
  'in the Longevity stats string. ' +
  'Hallucination guard: use only the numbers and league averages provided. Do not reference ' +
  'championships, All-Star selections, awards, or coaching unless present in the input. ' +
  'Do not invent statistics. If a stat is missing, omit it from the stats string. ' +
  'Peak picker: when the user message specifies mode=peak, choose 3 to 5 consecutive seasons ' +
  'that maximise combined scoring volume and efficiency from the season rows provided. ' +
  'Return those years (integers) in peakSeasons ascending. Grade only that window. ' +
  'If the player has played fewer than 3 seasons, all seasons are the peak window. ' +
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
 *
 * @param {unknown} input  - toolUse.input from the Claude response
 * @param {string}  mode   - 'career' | 'peak' | 'playoffs'
 */
function validateReportShape(input, mode) {
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

  // peakSeasons — required only for peak mode
  if (mode === 'peak') {
    if (!Array.isArray(input.peakSeasons) || input.peakSeasons.length === 0) {
      throw new Error('[gradedReportClient] peakSeasons must be a non-empty array for mode=peak');
    }
    for (const yr of input.peakSeasons) {
      if (!Number.isInteger(yr) || yr < 1997) {
        throw new Error(`[gradedReportClient] peakSeasons contains invalid year: ${yr}`);
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
  const { player, mode, seasonRows, careerRow, leagueByYear, advancedRows } = inputs;

  const lines = [
    `Player: ${player.name}`,
    `Position: ${player.position || 'Unknown'}`,
    `Mode: ${mode}`,
  ];

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

  const response = await anthropic.messages.create({
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
  });

  const toolUse = response.content.find(block => block.type === 'tool_use');
  if (!toolUse) {
    throw new Error('[gradedReportClient] Claude did not return a tool_use block');
  }

  // Shape-validate before returning so a malformed Claude response surfaces as a clean 502
  // rather than silently caching bad data.
  validateReportShape(toolUse.input, mode);

  return toolUse.input;
}

module.exports = { callClaude, validateReportShape, PROMPT_VERSION, get enabled() { return enabled; } };
