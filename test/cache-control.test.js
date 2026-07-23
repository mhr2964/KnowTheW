// Covers the two-tier express.static caching split in server/index.js. Uses a throwaway fixture
// directory rather than the real client/build output, since client/build/ is gitignored and CI's
// `npm run check` doesn't build the client first — the test would be non-portable otherwise.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const express = require('express');

let server;
let baseUrl;
let fixtureDir;

before(async () => {
  fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowthew-cache-control-'));
  fs.mkdirSync(path.join(fixtureDir, 'assets'));
  fs.writeFileSync(path.join(fixtureDir, 'assets', 'index-abc123.js'), 'console.log(1);');
  fs.writeFileSync(path.join(fixtureDir, 'index.html'), '<html></html>');

  const app = express();
  app.use('/assets', express.static(path.join(fixtureDir, 'assets'), { maxAge: '1y', immutable: true }));
  app.use(express.static(fixtureDir));

  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(fixtureDir, { recursive: true, force: true });
});

test('a content-hashed asset gets a long, immutable cache-control', async () => {
  const res = await fetch(`${baseUrl}/assets/index-abc123.js`);
  assert.strictEqual(res.status, 200);
  const cacheControl = res.headers.get('cache-control');
  assert.ok(cacheControl.includes('immutable'));
  assert.ok(cacheControl.includes('max-age=31536000'));
});

test('index.html does not get a long-lived cache-control', async () => {
  const res = await fetch(`${baseUrl}/index.html`);
  assert.strictEqual(res.status, 200);
  const cacheControl = res.headers.get('cache-control');
  assert.ok(!cacheControl || !cacheControl.includes('immutable'));
});
