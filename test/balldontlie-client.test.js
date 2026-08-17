// Regression coverage for bdlFetch's retry-on-429 behavior, added after live shadow-compare
// testing (see HANDOFF.md / the plan file) showed that hammering BDL with a whole career's worth
// of concurrent per-game requests could get silently rate-limited mid-fetch: computeSeasonPBP
// would just report fewer games than actually happened, with zero indication why. Before this fix,
// EVERY failure mode (429, other non-2xx, network error) returned null identically -- these tests
// lock in that a 429 specifically gets retried (honoring Retry-After when present) before giving up.

process.env.NODE_ENV = 'test';

const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

process.env.BALLDONTLIE_KEY = 'test-key';
const { bdlFetch } = require('../server/providers/balldontlie/client');

let originalFetch;
let originalWarn;
let warnLines;

beforeEach(() => {
  originalFetch = global.fetch;
  originalWarn = console.warn;
  warnLines = [];
  console.warn = (...args) => warnLines.push(args.join(' '));
});

afterEach(() => {
  global.fetch = originalFetch;
  console.warn = originalWarn;
});

function jsonResponse(body) {
  return { ok: true, status: 200, json: async () => body, headers: { get: () => null } };
}
function statusResponse(status, retryAfter = null) {
  return { ok: false, status, json: async () => ({}), headers: { get: (h) => (h.toLowerCase() === 'retry-after' ? retryAfter : null) } };
}

test('bdlFetch: a 200 on the first attempt returns the body with no retry', async () => {
  let calls = 0;
  global.fetch = async () => { calls++; return jsonResponse({ ok: 1 }); };
  const result = await bdlFetch('/teams');
  assert.deepStrictEqual(result, { ok: 1 });
  assert.strictEqual(calls, 1);
});

test('bdlFetch: a 429 then a 200 retries once and succeeds, without warning', async () => {
  let calls = 0;
  global.fetch = async () => {
    calls++;
    return calls === 1 ? statusResponse(429) : jsonResponse({ ok: 2 });
  };
  const result = await bdlFetch('/plays', { game_id: 1 });
  assert.deepStrictEqual(result, { ok: 2 });
  assert.strictEqual(calls, 2);
  assert.deepStrictEqual(warnLines, []);
});

test('bdlFetch: honors a positive Retry-After header instead of the default backoff', async () => {
  let calls = 0;
  const start = Date.now();
  global.fetch = async () => {
    calls++;
    return calls === 1 ? statusResponse(429, '0.05') : jsonResponse({ ok: 3 }); // Retry-After: 50ms
  };
  const result = await bdlFetch('/plays', { game_id: 1 });
  assert.deepStrictEqual(result, { ok: 3 });
  // Default backoff starts at 400ms -- a fast return here proves the header (not the default) was used.
  assert.ok(Date.now() - start < 300, 'should have used the short Retry-After delay, not the default backoff');
});

test('bdlFetch: exhausting retries on repeated 429s returns null and warns exactly once', async () => {
  let calls = 0;
  global.fetch = async () => { calls++; return statusResponse(429, '0.05'); };
  const result = await bdlFetch('/plays', { game_id: 1 });
  assert.strictEqual(result, null);
  assert.ok(calls > 1, 'should have retried at least once before giving up');
  assert.strictEqual(warnLines.length, 1);
  assert.match(warnLines[0], /429/);
});

test('bdlFetch: a non-429 error (e.g. 500) is not retried', async () => {
  let calls = 0;
  global.fetch = async () => { calls++; return statusResponse(500); };
  const result = await bdlFetch('/teams');
  assert.strictEqual(result, null);
  assert.strictEqual(calls, 1);
  assert.strictEqual(warnLines.length, 1);
});

test('bdlFetch: a thrown network error returns null and warns, no retry', async () => {
  let calls = 0;
  global.fetch = async () => { calls++; throw new Error('ECONNRESET'); };
  const result = await bdlFetch('/teams');
  assert.strictEqual(result, null);
  assert.strictEqual(calls, 1);
  assert.strictEqual(warnLines.length, 1);
  assert.match(warnLines[0], /ECONNRESET/);
});

test('bdlFetch: no API key configured returns null immediately, no fetch attempted', async () => {
  const key = process.env.BALLDONTLIE_KEY;
  delete process.env.BALLDONTLIE_KEY;
  let calls = 0;
  global.fetch = async () => { calls++; return jsonResponse({}); };
  try {
    const result = await bdlFetch('/teams');
    assert.strictEqual(result, null);
    assert.strictEqual(calls, 0);
  } finally {
    process.env.BALLDONTLIE_KEY = key;
  }
});
