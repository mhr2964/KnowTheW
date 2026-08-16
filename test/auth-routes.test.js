// Route tests for the username/password account system: signup, login, logout, and
// GET /api/auth/me (server/routes/auth.js + server/lib/auth.js's requireAuth middleware).
// A fake in-memory users collection (test/lib/fakeUsersDb.js) stands in for MongoDB — see that
// file for exactly which Db/Collection calls it supports.
//
// Budget note: signup and login share one express-rate-limit instance (10 req/15min/IP, see
// authLimiter in server/routes/auth.js). Every test below that hits POST /auth/signup or
// POST /auth/login is deliberately counted so the file's total stays under that limit — a
// fixture user is seeded directly into the fake db (bypassing the rate-limited signup endpoint
// entirely) for tests that just need an *existing* account rather than exercising signup itself.

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const bcrypt = require('bcryptjs');

const db = require('../server/db');
const { createFakeDb } = require('./lib/fakeUsersDb');
const { extractCookie, extractRawSetCookieHeader } = require('./lib/cookies');
const { COOKIE_NAME } = require('../server/lib/auth');
const app = require('../server/index');

const FIXTURE_USERNAME = 'fixture_user';
const FIXTURE_PASSWORD = 'fixture-password-1';

let server;
let baseUrl;
let fakeDb;

before(async () => {
  fakeDb = createFakeDb();
  db._setDbForTest(fakeDb);

  // Seeded directly against the fake collection (not via POST /auth/signup) so fixture setup
  // doesn't eat into the authLimiter budget shared with the tests below.
  const passwordHash = await bcrypt.hash(FIXTURE_PASSWORD, 4);
  await fakeDb.collection('users').insertOne({
    username: FIXTURE_USERNAME,
    passwordHash,
    teamRepId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

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

function signup(body) {
  return fetch(`${baseUrl}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function login(body) {
  return fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function me(cookie) {
  return fetch(`${baseUrl}/api/auth/me`, {
    headers: cookie ? { Cookie: cookie } : {},
  });
}

// -- signup ------------------------------------------------------------------------------------

test('signup: succeeds with valid credentials, normalizes the username, and sets the session cookie without leaking the hash or a raw token', async () => {
  const res = await signup({ username: 'Alice_Smith', password: 'correct-horse-battery' });
  assert.strictEqual(res.status, 201);

  const body = await res.json();
  assert.strictEqual(body.username, 'alice_smith');
  assert.strictEqual(body.teamRepId, null);
  assert.strictEqual('passwordHash' in body, false);
  assert.strictEqual('token' in body, false);

  const cookie = extractCookie(res, COOKIE_NAME);
  assert.ok(cookie, `expected a Set-Cookie header for ${COOKIE_NAME}`);
});

test('signup: rejects a duplicate username (case-insensitively) with 409', async () => {
  // FIXTURE_USERNAME is 'fixture_user' — sent back with different casing to also confirm
  // the uniqueness check is case-insensitive, same as signup's own username.toLowerCase().
  const res = await signup({ username: 'Fixture_User', password: 'some-other-password' });
  assert.strictEqual(res.status, 409);
  const body = await res.json();
  assert.strictEqual(body.error, 'username already taken');
});

test('signup: rejects a username with disallowed characters with 400', async () => {
  const res = await signup({ username: 'bad-user!', password: 'a-fine-password-1' });
  assert.strictEqual(res.status, 400);
});

test('signup: rejects a too-short password with 400', async () => {
  const res = await signup({ username: 'shortpw_user', password: 'short1' });
  assert.strictEqual(res.status, 400);
});

test('signup: rejects a password over 72 bytes with 400', async () => {
  const res = await signup({ username: 'longpw_user', password: 'x'.repeat(80) });
  assert.strictEqual(res.status, 400);
});

// -- login ---------------------------------------------------------------------------------------

test('login: succeeds with the fixture account\'s correct credentials and sets the session cookie', async () => {
  const res = await login({ username: FIXTURE_USERNAME, password: FIXTURE_PASSWORD });
  assert.strictEqual(res.status, 200);

  const body = await res.json();
  assert.strictEqual(body.username, FIXTURE_USERNAME);

  const cookie = extractCookie(res, COOKIE_NAME);
  assert.ok(cookie, `expected a Set-Cookie header for ${COOKIE_NAME}`);
});

test('login: an unknown username fails with the exact same 401 status and body as a wrong password, so responses cannot be used to enumerate registered usernames', async () => {
  const wrongPasswordRes = await login({ username: FIXTURE_USERNAME, password: 'not-the-real-password' });
  const unknownUserRes = await login({ username: 'totally_unregistered_user', password: 'whatever-password-1' });

  assert.strictEqual(wrongPasswordRes.status, 401);
  assert.strictEqual(unknownUserRes.status, 401);

  const wrongPasswordBody = await wrongPasswordRes.json();
  const unknownUserBody = await unknownUserRes.json();

  assert.deepStrictEqual(wrongPasswordBody, { error: 'invalid username or password' });
  assert.deepStrictEqual(unknownUserBody, wrongPasswordBody);
});

// -- /api/auth/me ----------------------------------------------------------------------------

test('GET /api/auth/me: returns 401 with no cookie at all', async () => {
  const res = await me();
  assert.strictEqual(res.status, 401);
});

test('GET /api/auth/me: 200 with a freshly-issued cookie, then 401 once that cookie is tampered with', async () => {
  const loginRes = await login({ username: FIXTURE_USERNAME, password: FIXTURE_PASSWORD });
  assert.strictEqual(loginRes.status, 200);
  const cookie = extractCookie(loginRes, COOKIE_NAME);
  assert.ok(cookie);

  const meRes = await me(cookie);
  assert.strictEqual(meRes.status, 200);
  const meBody = await meRes.json();
  assert.strictEqual(meBody.username, FIXTURE_USERNAME);
  assert.strictEqual(meBody.teamRepId, null);

  // Flip one character in the middle of the token portion of the cookie so the signature no
  // longer verifies, without changing the cookie's overall shape.
  const [name, value] = cookie.split('=');
  const mid = Math.floor(value.length / 2);
  const flippedChar = value[mid] === 'a' ? 'b' : 'a';
  const tamperedValue = value.slice(0, mid) + flippedChar + value.slice(mid + 1);
  const tamperedCookie = `${name}=${tamperedValue}`;

  const tamperedRes = await me(tamperedCookie);
  assert.strictEqual(tamperedRes.status, 401);
});

// -- logout ----------------------------------------------------------------------------------

test('logout: clears the session cookie and 204s even with no prior session', async () => {
  const res = await fetch(`${baseUrl}/api/auth/logout`, { method: 'POST' });
  assert.strictEqual(res.status, 204);

  const cleared = extractCookie(res, COOKIE_NAME);
  assert.ok(cleared, `expected logout to still send a Set-Cookie for ${COOKIE_NAME}`);

  // The cleared cookie value must not authenticate anything.
  const meRes = await me(cleared);
  assert.strictEqual(meRes.status, 401);

  // A regression where `maxAge` isn't stripped before res.clearCookie() would still send a
  // Set-Cookie header (so the two assertions above alone can't tell "cleared" from "reissued
  // with a future expiry") — it would just carry the original ~7-day-out expiry instead of an
  // immediate one, so the browser would keep sending the old cookie right past logout. Assert
  // the raw header's Expires attribute is actually in the past, pinned to Express's real
  // clearCookie output for this options shape so a regression can't slip through unnoticed.
  const rawSetCookie = extractRawSetCookieHeader(res, COOKIE_NAME);
  assert.ok(rawSetCookie, `expected a raw Set-Cookie header for ${COOKIE_NAME}`);
  assert.ok(
    rawSetCookie.includes('Expires=Thu, 01 Jan 1970'),
    `expected Express's clearCookie epoch expiry in the logout Set-Cookie header, got: ${rawSetCookie}`
  );
  const expiresMatch = rawSetCookie.match(/Expires=([^;]+)/i);
  assert.ok(expiresMatch, `expected an Expires attribute on the logout Set-Cookie header, got: ${rawSetCookie}`);
  assert.ok(
    new Date(expiresMatch[1]).getTime() < Date.now(),
    `expected logout's Expires to be in the past, got ${expiresMatch[1]}`
  );
});

test('logout: also 204s and clears the cookie when a (bogus, no-DB-round-trip-needed) session cookie is present', async () => {
  // logout doesn't call requireAuth (no DB lookup, no signature check) — it unconditionally
  // clears the cookie regardless of whether the incoming value is a real session. Exercising
  // this with an arbitrary cookie value (rather than a freshly issued one) proves that and
  // avoids spending another call against the shared signup/login rate limit budget (see the
  // budget note at the top of this file).
  const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
    method: 'POST',
    headers: { Cookie: `${COOKIE_NAME}=some-arbitrary-non-jwt-value` },
  });
  assert.strictEqual(logoutRes.status, 204);

  const clearedCookie = extractCookie(logoutRes, COOKIE_NAME);
  assert.ok(clearedCookie);
});
