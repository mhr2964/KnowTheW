// Route tests for POST /internal/jobs/notifications/injuries/poll (server/routes/internalJobs.js),
// gated by the same requireSchedulerAuth as /notifications/poll. Unit coverage of the underlying
// job logic lives in test/injury-notifications-job.test.js — this file is only the HTTP wrapper.

process.env.NODE_ENV = 'test';
process.env.SCHEDULER_TOKEN = 'test-scheduler-secret';

const { test, before, after } = require('node:test');
const assert = require('node:assert');

const db = require('../server/db');
const providers = require('../server/providers');
const { createFakeDb } = require('./lib/fakeUsersDb');
const { createFakeNotificationsDb, combineFakeDbs } = require('./lib/fakeNotificationsDb');
const app = require('../server/index');

const SCHEDULER_TOKEN = process.env.SCHEDULER_TOKEN;

let server;
let baseUrl;
let usersDb;
let notificationsDb;

before(async () => {
  usersDb = createFakeDb();
  notificationsDb = createFakeNotificationsDb();
  db._setDbForTest(combineFakeDbs(usersDb, notificationsDb));

  providers._setProviderForTest({ name: 'mock', getTeamInjuries: async () => [] });

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

function poll(headers = {}) {
  return fetch(`${baseUrl}/internal/jobs/notifications/injuries/poll`, { method: 'POST', headers });
}

test('POST /internal/jobs/notifications/injuries/poll: 401 with no x-scheduler-token header', async () => {
  const res = await poll();
  assert.strictEqual(res.status, 401);
});

test('POST /internal/jobs/notifications/injuries/poll: correct token, no injuries -> 200, errors:0', async () => {
  await usersDb.collection('users').insertOne({
    username: 'rep_user_no_injuries',
    passwordHash: 'unused',
    teamRepId: '1',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const res = await poll({ 'x-scheduler-token': SCHEDULER_TOKEN });
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.deepStrictEqual(
    Object.keys(body).sort(),
    ['checkedTeams', 'checkedInjuries', 'created', 'duplicatesSkipped', 'errors'].sort()
  );
  assert.strictEqual(body.errors, 0);
  assert.strictEqual(body.created, 0);
});

test('POST /internal/jobs/notifications/injuries/poll: correct token, a resolved injury -> 200, created:1', async () => {
  await usersDb.collection('users').insertOne({
    username: 'rep_user_with_injury',
    passwordHash: 'unused',
    teamRepId: '2',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  providers._setProviderForTest({
    name: 'mock',
    getTeamInjuries: async (teamId) => (
      teamId === '2' ? [{ playerId: 'p-1', playerName: 'A. Player', status: 'Out', returnDate: null, comment: null }] : []
    ),
  });

  const res = await poll({ 'x-scheduler-token': SCHEDULER_TOKEN });
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.created, 1);
});

test('POST /internal/jobs/notifications/injuries/poll: 503 when the DB is down, and the job never runs', async () => {
  db._resetDbForTest();
  let providerCalled = false;
  providers._setProviderForTest({ name: 'mock', getTeamInjuries: async () => { providerCalled = true; return []; } });

  const res = await poll({ 'x-scheduler-token': SCHEDULER_TOKEN });
  assert.strictEqual(res.status, 503);
  assert.strictEqual(providerCalled, false, 'the job must not run any provider calls against a down DB');
});
