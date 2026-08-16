// Regression coverage for the fail-closed behavior server/lib/auth.js documents: an unset
// JWT_SECRET must refuse to issue or validate any token, never fall back to a default that
// would make forged/previously-issued tokens trivially valid. signToken() and requireAuth both
// read process.env.JWT_SECRET per-call (not once at module load), so it's enough to delete the
// env var before requiring the app in this file — no separate child process needed. Node's test
// runner isolates each matched *.test.js file in its own process by default, so deleting the var
// here can't leak into other test files that rely on JWT_SECRET being set.

process.env.NODE_ENV = 'test';
delete process.env.JWT_SECRET;

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const db = require('../server/db');
const { createFakeDb } = require('./lib/fakeUsersDb');
const { COOKIE_NAME } = require('../server/lib/auth');
const app = require('../server/index');

let server;
let baseUrl;
let fakeDb;

before(async () => {
  assert.strictEqual(process.env.JWT_SECRET, undefined, 'this file must run with JWT_SECRET unset');

  fakeDb = createFakeDb();
  db._setDbForTest(fakeDb);

  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

after(async () => {
  db._resetDbForTest();
  await new Promise((resolve) => server.close(resolve));
});

test('signup fails closed (500) when JWT_SECRET is unset, instead of silently issuing a session', async () => {
  const res = await fetch(`${baseUrl}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'no_secret_signup_user', password: 'a-fine-password-1' }),
  });
  assert.strictEqual(res.status, 500);
  assert.strictEqual(res.headers.has('set-cookie'), false, 'must not set a session cookie without a signed token');

  // The 500 + no-cookie assertions above are also consistent with the original bug (insert
  // happening before signing): they'd pass identically whether or not the username got written
  // to the DB. Signing now happens before the insert specifically so a signing failure leaves no
  // row behind — assert that directly, against the fake db this suite's `before()` wired up,
  // otherwise a regression back to insert-then-sign order (an orphaned, unloginable account) has
  // nothing here to catch it.
  const orphanedRow = await fakeDb.collection('users').findOne({ username: 'no_secret_signup_user' });
  assert.strictEqual(orphanedRow, null, 'a failed signup (signing failure) must not leave a user row behind');
});

test('login fails closed (500) when JWT_SECRET is unset, instead of silently issuing a session', async () => {
  // Seeded directly (bypassing signup, which would itself hit the same fail-closed path above)
  // so login has a real account + matching password hash to authenticate against.
  const passwordHash = await bcrypt.hash('a-fine-password-1', 4);
  await fakeDb.collection('users').insertOne({
    username: 'no_secret_login_user',
    passwordHash,
    teamRepId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'no_secret_login_user', password: 'a-fine-password-1' }),
  });
  assert.strictEqual(res.status, 500);
  assert.strictEqual(res.headers.has('set-cookie'), false, 'must not set a session cookie without a signed token');
});

test('a well-formed but unverifiable cookie is rejected (401), never accidentally accepted, when JWT_SECRET is unset', async () => {
  // Forge a structurally valid JWT the app never issued (signed with a secret only this test
  // knows) to prove requireAuth's `if (!secret) return 401` guard fires before any attempt to
  // verify the token, rather than merely happening to reject garbage tokens.
  const forgedToken = jwt.sign(
    { sub: '507f1f77bcf86cd799439011' },
    'some-secret-the-server-never-had',
    { expiresIn: '1h' }
  );

  const res = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Cookie: `${COOKIE_NAME}=${forgedToken}` },
  });
  assert.strictEqual(res.status, 401);
});
