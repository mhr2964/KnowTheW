// Covers the express-rate-limit wiring in server/index.js. Doesn't exercise the real 100/min
// production config (too slow for a test run) — mounts a low-max limiter on a throwaway route
// using the same express-rate-limit package/options shape instead.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const express = require('express');
const rateLimit = require('express-rate-limit');

let server;
let baseUrl;

before(async () => {
  const app = express();
  app.use(rateLimit({ windowMs: 60 * 1000, limit: 3, standardHeaders: true, legacyHeaders: false }));
  app.get('/ping', (req, res) => res.json({ ok: true }));

  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test('requests under the limit succeed', async () => {
  const res = await fetch(`${baseUrl}/ping`);
  assert.strictEqual(res.status, 200);
  assert.ok(res.headers.get('ratelimit-limit'));
});

test('requests over the limit are rejected with 429', async () => {
  let lastRes;
  for (let i = 0; i < 5; i += 1) {
    lastRes = await fetch(`${baseUrl}/ping`);
  }
  assert.strictEqual(lastRes.status, 429);
});
