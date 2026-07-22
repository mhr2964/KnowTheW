// Covers the helmet() defaults and the CORS origin allowlist added in server/index.js.
// Same port-0/real-fetch pattern as smoke.test.js.

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

test('helmet sets baseline security headers', async () => {
  const res = await fetch(`${baseUrl}/api/status`);
  assert.strictEqual(res.headers.get('x-content-type-options'), 'nosniff');
  assert.ok(res.headers.get('x-frame-options'));
  assert.ok(res.headers.get('strict-transport-security'));
});

test('CSP is deliberately left off (AdSense/GA/ESPN CDN not audited yet)', async () => {
  const res = await fetch(`${baseUrl}/api/status`);
  assert.strictEqual(res.headers.get('content-security-policy'), null);
});

test('CORS reflects an allowed origin', async () => {
  const res = await fetch(`${baseUrl}/api/status`, {
    headers: { Origin: 'https://knowthew.net' },
  });
  assert.strictEqual(res.headers.get('access-control-allow-origin'), 'https://knowthew.net');
});

test('CORS omits the ACAO header for a mismatched origin without erroring the request', async () => {
  const res = await fetch(`${baseUrl}/api/status`, {
    headers: { Origin: 'https://evil.example' },
  });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.headers.get('access-control-allow-origin'), null);
});
