// narrativeClient.js — generates AI franchise narratives via the shared Anthropic client.
//
// The SDK client, enabled flag, and transient-retry helper come from ./anthropic (one client for
// all AI features). Route handler checks `enabled` before calling and returns 503 otherwise.
//
// Output is forced via tool_choice so the response is always structured JSON — no prose-parsing.
// System prompt is cached with cache_control: { type: 'ephemeral' } since it is identical for
// every team call.

'use strict';

const { getClient, callWithRetry, enabled } = require('./anthropic');

// ---------------------------------------------------------------------------
// Tool definition — forces structured output
// ---------------------------------------------------------------------------

const FRANCHISE_NARRATIVE_TOOL = {
  name: 'franchise_narrative',
  description: 'Output a structured franchise narrative for a WNBA team.',
  input_schema: {
    type: 'object',
    properties: {
      summary: {
        type: 'string',
        description: '2-3 sentence franchise overview.',
      },
      eras: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            label: {
              type: 'string',
              description: 'Short era name, e.g. "The Lauren Jackson Era (2003-2012)".',
            },
            yearStart: { type: 'integer' },
            yearEnd:   { type: 'integer' },
            record: {
              type: 'string',
              description: 'Optional roll-up string, e.g. "8 playoff appearances, 2 titles".',
            },
            narrative: {
              type: 'string',
              description: '4-6 sentences of prose about this era. Do not invent statistics.',
            },
            keyPlayers: {
              type: 'array',
              items: { type: 'string' },
              description: 'Player names only — no statistics.',
            },
          },
          required: ['label', 'yearStart', 'yearEnd', 'narrative', 'keyPlayers'],
        },
        description: 'Distinct eras in the franchise timeline.',
      },
      identity: {
        type: 'string',
        description: '2-3 sentence "what this franchise is" — culture, style, reputation.',
      },
    },
    required: ['summary', 'eras', 'identity'],
  },
};

// Bumped whenever the system prompt, tool schema, or model changes — included in the
// route's sourceHash so existing cached narratives regenerate on the next request.
const PROMPT_VERSION = 3;

// System prompt is static across all teams so Anthropic can cache it.
const SYSTEM_PROMPT_TEXT =
  'You write franchise histories for WNBA teams. ' +
  'You receive structured data — records, championships, playoff results — for a specific team. ' +
  'You may name players and coaches from your training knowledge as commentary, but ' +
  'only name players you are highly confident played for this specific franchise; ' +
  'if uncertain, omit the name rather than guess. ' +
  'Do not invent statistics or attribute specific numbers to any player or coach. ' +
  'When you mention a player or coach, use qualitative descriptions only. ' +
  'Write in a neutral, professional tone: no puns, no parenthetical asides like ' +
  '"(no pun intended)", and no self-referential phrasing about being an AI or summary. ' +
  'Treat the current in-progress season separately — never include the current season as ' +
  'the closing year of an era. Era ranges must end on a completed season. ' +
  'Vary the era labels — do not start every label with "The" and do not end every label ' +
  'with "Era" or "Years." Mix naming styles across the eras you produce: descriptive phrases ' +
  '("Inaugural seasons"), player-defined periods ("Bird and Jackson dynasty"), mood ' +
  'descriptors ("Rebuild years"), or compact year-range labels. Repetitive formulaic labels ' +
  'across all eras read as machine-generated and should be avoided. ' +
  'Output structured JSON that exactly matches the provided tool schema.';

// ---------------------------------------------------------------------------
// Shape validation
// ---------------------------------------------------------------------------

/**
 * Validate the structured output Claude returns via the franchise_narrative tool.
 * Throws a descriptive Error on any contract violation so callers surface a 502
 * rather than caching malformed data.
 *
 * @param {unknown} input - toolUse.input from the Claude response
 */
function validateNarrativeShape(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('[narrativeClient] tool output is not an object');
  }

  if (typeof input.summary !== 'string' || input.summary.trim() === '') {
    throw new Error('[narrativeClient] tool output missing or empty: summary');
  }

  if (!Array.isArray(input.eras)) {
    throw new Error('[narrativeClient] tool output missing or non-array: eras');
  }

  if (input.eras.length === 0) {
    console.warn('[narrativeClient] Claude returned 0 eras — no era data available for this team');
  }

  input.eras.forEach((era, i) => {
    const prefix = `[narrativeClient] era[${i}]`;
    if (typeof era.label !== 'string' || era.label.trim() === '') {
      throw new Error(`${prefix} missing or empty: label`);
    }
    if (typeof era.narrative !== 'string' || era.narrative.trim() === '') {
      throw new Error(`${prefix} missing or empty: narrative`);
    }
    if (!Number.isInteger(era.yearStart)) {
      throw new Error(`${prefix} yearStart must be an integer, got: ${era.yearStart}`);
    }
    if (!Number.isInteger(era.yearEnd)) {
      throw new Error(`${prefix} yearEnd must be an integer, got: ${era.yearEnd}`);
    }
    if (!Array.isArray(era.keyPlayers)) {
      throw new Error(`${prefix} keyPlayers must be an array`);
    }
    era.keyPlayers.forEach((p, j) => {
      if (typeof p !== 'string') {
        throw new Error(`${prefix} keyPlayers[${j}] must be a string`);
      }
    });
  });

  if (typeof input.identity !== 'string' || input.identity.trim() === '') {
    throw new Error('[narrativeClient] tool output missing or empty: identity');
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a franchise narrative for a team.
 *
 * @param {object} params
 * @param {object} params.team    - Team object from getTeams() ({ id, name, record, seedLabel, conference, ... })
 * @param {object} params.history - Payload from buildHistory() ({ teamId, founded, championships, seasons, ... })
 * @returns {Promise<{ summary: string, eras: Array, identity: string }>}
 * @throws  On any SDK or parse error — caller translates to 502.
 */
async function getNarrative({ team, history }) {
  const anthropic = getClient();
  if (!anthropic) {
    throw new Error('Anthropic client not initialised');
  }

  // Build compact season rows for the user message — omit nulls to save tokens.
  const seasonRows = (history.seasons ?? []).map(s => {
    const parts = [`${s.year}: ${s.wins ?? '?'}-${s.losses ?? '?'}`];
    if (s.conference)    parts.push(s.conference.replace(' Conference', ''));
    if (s.seed != null)  parts.push(`seed ${s.seed}`);
    if (s.playoffResult) parts.push(s.playoffResult);
    if (s.champion)      parts.push('CHAMPION');
    return parts.join(', ');
  });

  const currentRecord = team.record ?? null;
  const currentSeed   = team.seedLabel ?? null;
  const currentCtx    = (currentRecord && currentSeed)
    ? `Currently ${currentRecord}, ${currentSeed} in ${team.conference ?? 'the conference'}.`
    : '';

  const userMessage =
    `Team: ${team.name}\n` +
    `Founded: ${history.founded ?? 'unknown'}\n` +
    `Championships: ${(history.championships ?? []).join(', ') || 'none'}\n` +
    `${currentCtx}\n\n` +
    `Season-by-season records (newest first):\n` +
    seasonRows.join('\n');

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
    tools:       [FRANCHISE_NARRATIVE_TOOL],
    tool_choice: { type: 'tool', name: 'franchise_narrative' },
    messages: [
      {
        role:    'user',
        content: userMessage,
      },
    ],
  }));

  const toolUse = response.content.find(block => block.type === 'tool_use');
  if (!toolUse) {
    throw new Error('[narrativeClient] Claude did not return a tool_use block');
  }

  // Shape-validate before returning so a malformed Claude response surfaces as a clean 502
  // rather than silently caching bad data or crashing the template renderer.
  validateNarrativeShape(toolUse.input);

  return toolUse.input;
}

module.exports = { getNarrative, PROMPT_VERSION, get enabled() { return enabled; } };
