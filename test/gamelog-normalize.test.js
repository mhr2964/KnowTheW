// Characterization test for the gamelog normalization (M4). Locks the transform from ESPN's raw
// gamelog response into the normalized {columns, games} shape so a future source swap (or a refactor)
// can't silently change what the client renders. The regression-prone bits captured here:
//   - stat keys/order preserved from ESPN's `names`, with correct label + kind (pct vs num)
//   - games sorted ascending by date
//   - home/away score assignment (isHome = atVs === 'vs')
//   - per-game stats keyed by name (no positional array), values passed through verbatim

process.env.NODE_ENV = 'test';

const { test } = require('node:test');
const assert = require('node:assert');

const { normalizeGameLog } = require('../server/providers/espn/gamelog');

// Hand-built fixture matching ESPN's gamelog response shape.
const RAW = {
  names: [
    'minutes', 'points', 'fieldGoalsMade-fieldGoalsAttempted', 'fieldGoalPct',
    'threePointPct', 'fouls',
  ],
  events: {
    401: { gameDate: '2024-05-15T00:00Z', atVs: 'vs', gameResult: 'W', opponent: { abbreviation: 'LV' },  homeTeamScore: '90', awayTeamScore: '80' },
    402: { gameDate: '2024-05-10T00:00Z', atVs: '@',  gameResult: 'L', opponent: { abbreviation: 'SEA' }, homeTeamScore: '88', awayTeamScore: '70' },
  },
  seasonTypes: [
    {
      categories: [
        {
          events: [
            { eventId: 401, stats: ['32', '24', '9-15', '60.0', '40.0', '2'] },
            { eventId: 402, stats: ['30', '18', '7-16', '43.8', '33.3', '3'] },
          ],
        },
      ],
    },
  ],
};

test('normalizeGameLog produces the expected columns + games', () => {
  const out = normalizeGameLog(RAW);

  assert.deepStrictEqual(out.columns, [
    { key: 'minutes', label: 'MP', kind: 'num' },
    { key: 'points', label: 'PTS', kind: 'num' },
    { key: 'fieldGoalsMade-fieldGoalsAttempted', label: 'FG', kind: 'num' },
    { key: 'fieldGoalPct', label: 'FG%', kind: 'pct' },
    { key: 'threePointPct', label: '3P%', kind: 'pct' },
    { key: 'fouls', label: 'PF', kind: 'num' },
  ]);

  // Sorted ascending: May 10 (away L) before May 15 (home W).
  assert.deepStrictEqual(out.games, [
    {
      date: '2024-05-10T00:00Z',
      opponent: 'SEA',
      atVs: '@',
      result: 'L',
      teamScore: 70,   // away
      oppScore: 88,    // home
      stats: {
        minutes: '30', points: '18', 'fieldGoalsMade-fieldGoalsAttempted': '7-16',
        fieldGoalPct: '43.8', threePointPct: '33.3', fouls: '3',
      },
    },
    {
      date: '2024-05-15T00:00Z',
      opponent: 'LV',
      atVs: 'vs',
      result: 'W',
      teamScore: 90,   // home
      oppScore: 80,    // away
      stats: {
        minutes: '32', points: '24', 'fieldGoalsMade-fieldGoalsAttempted': '9-15',
        fieldGoalPct: '60.0', threePointPct: '40.0', fouls: '2',
      },
    },
  ]);
});

test('normalizeGameLog tolerates an empty/missing response', () => {
  assert.deepStrictEqual(normalizeGameLog({}), { columns: [], games: [] });
});

test('normalizeGameLog skips events with no matching meta or no stats', () => {
  const out = normalizeGameLog({
    names: ['points'],
    events: { 1: { gameDate: '2024-06-01', atVs: 'vs', gameResult: 'W', opponent: { abbreviation: 'NY' }, homeTeamScore: '80', awayTeamScore: '70' } },
    seasonTypes: [{ categories: [{ events: [
      { eventId: 1, stats: ['20'] },        // valid
      { eventId: 99, stats: ['10'] },       // no meta -> skipped
      { eventId: 1 },                        // no stats -> skipped
    ] }] }],
  });
  assert.strictEqual(out.games.length, 1);
  assert.strictEqual(out.games[0].stats.points, '20');
});
