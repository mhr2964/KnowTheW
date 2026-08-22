// Tests for server/providers/balldontlie/injuries.js -- pure mapping logic only, no network.

process.env.NODE_ENV = 'test';

const { test } = require('node:test');
const assert = require('node:assert');

const { mapInjuryRow } = require('../server/providers/balldontlie/injuries');

// Real shape confirmed live, 2026-08-22 spike against /wnba/v1/player_injuries.
const REAL_ROW = {
  player: { id: 495, first_name: 'Brionna', last_name: 'Jones' },
  status: 'Out',
  return_date: 'Aug 30',
  comment: 'Aug 16: Dream head coach Karl Smesko told reporters Sunday that Jones does not have a timetable of return for a left leg injury.',
};

test('mapInjuryRow: extracts status/returnDate/comment', () => {
  const mapped = mapInjuryRow(REAL_ROW);
  assert.strictEqual(mapped.status, 'Out');
  assert.strictEqual(mapped.returnDate, 'Aug 30');
  assert.ok(mapped.comment.startsWith('Aug 16:'));
});

test('mapInjuryRow: a missing comment maps to null, not undefined (2 of 40 rows in the live spike had none)', () => {
  const mapped = mapInjuryRow({ player: REAL_ROW.player, status: 'Day-To-Day', return_date: 'Aug 23' });
  assert.strictEqual(mapped.comment, null);
});
