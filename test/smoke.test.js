// Smoke test: prove the Express app boots and serves a request without hitting ESPN.
// NODE_ENV=test is set BEFORE requiring the app so espnClient skips its startup prefetch.
// We listen on port 0 (OS-assigned ephemeral port) to avoid colliding with the dev server.

process.env.NODE_ENV = 'test';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const app = require('../server/index');

let server;
let baseUrl;

before(async () => {
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

test('GET /api/status returns 200 and the app identity', async () => {
  const res = await fetch(`${baseUrl}/api/status`);
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.status, 'ok');
  assert.strictEqual(body.app, 'KnowTheW');
});
