// Route smoke test: GET /api/teams serves whatever the active provider returns, with no live
// source involved. We inject a fake provider so this proves the route↔provider wiring (M1) without
// touching ESPN. As more routes move onto the provider, they get added here the same way.

process.env.NODE_ENV = 'test';

const { test, before, after } = require('node:test');
const assert = require('node:assert');

const providers = require('../server/providers');
const app = require('../server/index');

const FAKE_TEAMS = [
  { id: 1, name: 'Mock Storm', abbreviation: 'MStrm' },
  { id: 2, name: 'Mock Aces', abbreviation: 'MAces' },
];

let server;
let baseUrl;

before(async () => {
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

test('GET /api/teams returns the active provider\'s teams', async () => {
  const res = await fetch(`${baseUrl}/api/teams`);
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.deepStrictEqual(body, FAKE_TEAMS);
});

test('GET /api/teams returns 500 when the provider throws', async () => {
  providers._setProviderForTest({
    name: 'mock',
    getTeams: async () => { throw new Error('source down'); },
  });
  const res = await fetch(`${baseUrl}/api/teams`);
  assert.strictEqual(res.status, 500);
});
