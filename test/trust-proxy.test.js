// Regression coverage for `app.set('trust proxy', 1)` in server/index.js. Boots the *real* app
// (not a throwaway express() instance like test/rate-limit.test.js does — that file never
// exercises trust proxy at all, so it can't catch a regression here) and proves two simulated
// clients distinguished only by X-Forwarded-For get independently-tracked rate-limit buckets.
//
// Without trust proxy set (or set wrong), Express would see only the one real TCP peer (this
// test's own loopback connection) for every request regardless of X-Forwarded-For, so
// express-rate-limit would bucket both simulated clients together — the second request would show
// one fewer remaining than the first instead of matching it.

process.env.NODE_ENV = 'test';

const { test, before, after } = require('node:test');
const assert = require('node:assert');

const providers = require('../server/providers');
const app = require('../server/index');

const FAKE_TEAMS = [{ id: 1, name: 'Mock Storm', abbreviation: 'MStrm' }];

let server;
let baseUrl;

before(async () => {
  // GET /api/teams needs no auth/DB and sits behind the same apiLimiter (100/min) trust proxy is
  // meant to protect — mocking the provider (same pattern as test/teams-route.test.js) keeps this
  // test off any live source.
  providers._setProviderForTest({
    name: 'mock',
    getTeams: async () => FAKE_TEAMS,
  });

  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

after(async () => {
  providers._resetProviderCache();
  await new Promise((resolve) => server.close(resolve));
});

test('two clients distinguished only by X-Forwarded-For get independently-tracked rate-limit buckets', async () => {
  const clientAIp = '203.0.113.10';
  const clientBIp = '203.0.113.20';

  const resA = await fetch(`${baseUrl}/api/teams`, {
    headers: { 'X-Forwarded-For': clientAIp },
  });
  const resB = await fetch(`${baseUrl}/api/teams`, {
    headers: { 'X-Forwarded-For': clientBIp },
  });

  assert.strictEqual(resA.status, 200);
  assert.strictEqual(resB.status, 200);

  const remainingA = resA.headers.get('ratelimit-remaining');
  const remainingB = resB.headers.get('ratelimit-remaining');

  assert.ok(remainingA, 'expected a RateLimit-Remaining header on client A\'s response');
  assert.ok(remainingB, 'expected a RateLimit-Remaining header on client B\'s response');

  // Each client has made exactly one request. If trust proxy is correctly honoring
  // X-Forwarded-For as the real client IP, both buckets started fresh and show the same
  // "limit minus one" remaining count. If requests were sharing one bucket (trust proxy
  // regressed), client B's request would land second in that shared bucket and show one
  // fewer remaining than client A's.
  assert.strictEqual(
    remainingA,
    remainingB,
    `expected both simulated clients to have independently-tracked remaining counts, got A=${remainingA} B=${remainingB}`
  );
});
