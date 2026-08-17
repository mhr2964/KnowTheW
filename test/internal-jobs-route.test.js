// Route tests for POST /internal/jobs/notifications/poll (server/routes/internalJobs.js),
// gated by requireSchedulerAuth (server/lib/schedulerAuth.js). Unit coverage of the underlying
// job logic itself (due-window math, insertMany error handling, provider skip-not-fatal paths)
// lives in test/notifications-job.test.js — this file is only about the HTTP wrapper: auth
// gating and status-code mapping (200 vs 500 vs 503).

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

  providers._setProviderForTest({
    name: 'mock',
    getTeamSchedule: async () => [],
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
  providers._resetProviderCache();
  await new Promise((resolve) => server.close(resolve));
});

function poll(headers = {}) {
  return fetch(`${baseUrl}/internal/jobs/notifications/poll`, { method: 'POST', headers });
}

test('POST /internal/jobs/notifications/poll: 401 with no x-scheduler-token header', async () => {
  const res = await poll();
  assert.strictEqual(res.status, 401);
});

test('POST /internal/jobs/notifications/poll: 401 with the wrong token', async () => {
  const res = await poll({ 'x-scheduler-token': 'definitely-not-the-token' });
  assert.strictEqual(res.status, 401);
});

test('POST /internal/jobs/notifications/poll: fails closed when SCHEDULER_TOKEN itself is unset', async () => {
  delete process.env.SCHEDULER_TOKEN;
  try {
    // Even presenting the token this suite knows must not be accepted once the server has no
    // secret configured at all — fail-closed, not "any token works when unset".
    const res = await poll({ 'x-scheduler-token': SCHEDULER_TOKEN });
    assert.strictEqual(res.status, 503);
    const body = await res.json();
    assert.strictEqual(body.error, 'service unavailable');
  } finally {
    process.env.SCHEDULER_TOKEN = SCHEDULER_TOKEN;
  }
});

test('POST /internal/jobs/notifications/poll: correct token, no due games -> 200 with the summary shape, errors:0', async () => {
  await usersDb.collection('users').insertOne({
    username: 'rep_user_no_due_games',
    passwordHash: 'unused',
    teamRepId: '1',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  providers._setProviderForTest({
    name: 'mock',
    // 20 minutes out is outside the [3,18] due window — checked, but nothing to notify.
    getTeamSchedule: async (teamId, year, seasontype) => (
      seasontype === 2 ? [{ id: 'evt-not-due', date: new Date(Date.now() + 20 * 60000).toISOString(), opponent: null, atVs: 'vs' }] : []
    ),
  });

  const res = await poll({ 'x-scheduler-token': SCHEDULER_TOKEN });
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.deepStrictEqual(
    Object.keys(body).sort(),
    ['checkedGames', 'checkedTeams', 'created', 'duplicatesSkipped', 'errors'].sort()
  );
  assert.strictEqual(body.errors, 0);
  assert.strictEqual(body.created, 0);
});

test('POST /internal/jobs/notifications/poll: correct token, job reports errors -> 500, not 200', async () => {
  await usersDb.collection('users').insertOne({
    username: 'rep_user_due_game_write_fails',
    passwordHash: 'unused',
    teamRepId: '2',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  providers._setProviderForTest({
    name: 'mock',
    getTeamSchedule: async (teamId, year, seasontype) => (
      teamId === '2' && seasontype === 2
        ? [{ id: 'evt-due-write-fails', date: new Date(Date.now() + 10 * 60000).toISOString(), opponent: null, atVs: 'vs' }]
        : []
    ),
  });
  notificationsDb.collection('notifications')._simulateTotalFailure();

  try {
    const res = await poll({ 'x-scheduler-token': SCHEDULER_TOKEN });
    assert.strictEqual(res.status, 500);
    const body = await res.json();
    assert.ok(body.errors >= 1);
  } finally {
    notificationsDb.collection('notifications')._stopSimulatingTotalFailure();
  }
});

test('POST /internal/jobs/notifications/poll: 503 when the DB is down, and the job never runs', async () => {
  db._resetDbForTest(); // getDb() now returns the real (null-under-test) db — simulates DB down.
  let providerCalled = false;
  providers._setProviderForTest({
    name: 'mock',
    getTeamSchedule: async () => { providerCalled = true; return []; },
  });

  const res = await poll({ 'x-scheduler-token': SCHEDULER_TOKEN });
  assert.strictEqual(res.status, 503);
  assert.strictEqual(providerCalled, false, 'the job must not run any provider calls against a down DB');
});
