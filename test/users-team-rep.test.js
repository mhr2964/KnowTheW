// Route tests for the logged-in user's team-rep selection (server/routes/users.js), protected
// by requireAuth (server/lib/auth.js). Own fake db instance + own fake provider instance (same
// pattern as test/teams-route.test.js) so this file's state can't leak into or from other test
// files — node's test runner isolates each matched file in its own process anyway, but keeping
// setup/teardown self-contained here means that isn't load-bearing.
//
// The fixture user's session cookie is minted directly via signToken() rather than by going
// through POST /api/auth/login — this file only needs an *authenticated* request, not to
// exercise login itself (that's covered in test/auth-routes.test.js), and skipping the HTTP
// round trip avoids any dependence on that route's shared rate limiter.

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';

const { test, before, after } = require('node:test');
const assert = require('node:assert');

const db = require('../server/db');
const providers = require('../server/providers');
const { createFakeDb } = require('./lib/fakeUsersDb');
const { COOKIE_NAME, signToken } = require('../server/lib/auth');
const app = require('../server/index');

const FAKE_TEAMS = [
  { id: 1, name: 'Mock Storm', abbreviation: 'MStrm' },
  { id: 2, name: 'Mock Aces', abbreviation: 'MAces' },
];

let server;
let baseUrl;
let fakeDb;
let authCookie;

before(async () => {
  fakeDb = createFakeDb();
  db._setDbForTest(fakeDb);

  providers._setProviderForTest({
    name: 'mock',
    getTeams: async () => FAKE_TEAMS,
  });

  const { insertedId } = await fakeDb.collection('users').insertOne({
    username: 'team_rep_user',
    passwordHash: 'unused-in-this-file',
    teamRepId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  authCookie = `${COOKIE_NAME}=${signToken(String(insertedId))}`;

  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

after(async () => {
  db._resetDbForTest();
  providers._resetProviderCache();
  await new Promise((resolve) => server.close(resolve));
});

function putTeamRep(body, cookie) {
  return fetch(`${baseUrl}/api/users/me/team-rep`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

function deleteTeamRep(cookie) {
  return fetch(`${baseUrl}/api/users/me/team-rep`, {
    method: 'DELETE',
    headers: cookie ? { Cookie: cookie } : {},
  });
}

function me(cookie) {
  return fetch(`${baseUrl}/api/auth/me`, {
    headers: cookie ? { Cookie: cookie } : {},
  });
}

// -- PUT /api/users/me/team-rep -----------------------------------------------------------------

test('PUT /api/users/me/team-rep: 401 without an auth cookie', async () => {
  const res = await putTeamRep({ teamId: '1' });
  assert.strictEqual(res.status, 401);
});

test('PUT /api/users/me/team-rep: 400 on a non-numeric teamId', async () => {
  const res = await putTeamRep({ teamId: 'abc' }, authCookie);
  assert.strictEqual(res.status, 400);
});

test('PUT /api/users/me/team-rep: 400 on a numeric but unknown teamId', async () => {
  const res = await putTeamRep({ teamId: '9999' }, authCookie);
  assert.strictEqual(res.status, 400);
});

// The next two tests intentionally run in sequence against the same fixture user: this is
// exactly what "persistence" means here, so verifying it requires chaining a write and a
// follow-up read rather than treating each call as an independent fixture.
test('PUT /api/users/me/team-rep: 200 on a valid, known teamId, and the value is persisted', async () => {
  const res = await putTeamRep({ teamId: '1' }, authCookie);
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.teamRepId, '1');

  const meRes = await me(authCookie);
  assert.strictEqual(meRes.status, 200);
  const meBody = await meRes.json();
  assert.strictEqual(meBody.teamRepId, '1');
});

// -- DELETE /api/users/me/team-rep --------------------------------------------------------------

test('DELETE /api/users/me/team-rep: 401 without an auth cookie', async () => {
  const res = await deleteTeamRep();
  assert.strictEqual(res.status, 401);
});

test('DELETE /api/users/me/team-rep: 200, clears teamRepId, and the clear is persisted', async () => {
  const res = await deleteTeamRep(authCookie);
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.teamRepId, null);

  const meRes = await me(authCookie);
  assert.strictEqual(meRes.status, 200);
  const meBody = await meRes.json();
  assert.strictEqual(meBody.teamRepId, null);
});
