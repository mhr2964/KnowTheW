// Unit tests for server/lib/injuryNotificationsJob.js's pollAndCreateInjuryNotifications().
// Same framework-free direct-call approach as test/notifications-job.test.js — fake db/provider/
// clock, no HTTP, no real Mongo/BDL.

process.env.NODE_ENV = 'test';

const { test } = require('node:test');
const assert = require('node:assert');

const { createFakeDb } = require('./lib/fakeUsersDb');
const { createFakeNotificationsDb, combineFakeDbs } = require('./lib/fakeNotificationsDb');
const { pollAndCreateInjuryNotifications } = require('../server/lib/injuryNotificationsJob');

const NOW = new Date('2026-08-22T20:00:00.000Z');

function setup({ injuriesByTeam = {} } = {}) {
  const usersDb = createFakeDb();
  const notificationsDb = createFakeNotificationsDb();
  const db = combineFakeDbs(usersDb, notificationsDb);

  const calls = [];
  const provider = {
    async getTeamInjuries(teamId) {
      calls.push({ teamId });
      const entry = injuriesByTeam[teamId];
      if (entry instanceof Error) throw entry;
      return entry === undefined ? [] : entry;
    },
  };

  return { db, usersDb, notificationsDb, provider, calls };
}

async function seedUsers(usersDb, teamRepIds) {
  const ids = [];
  for (const teamRepId of teamRepIds) {
    const { insertedId } = await usersDb.collection('users').insertOne({
      username: `user-${ids.length}-${Math.random().toString(36).slice(2)}`,
      passwordHash: 'unused',
      teamRepId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    ids.push(insertedId);
  }
  return ids;
}

test('one repped team with one currently-injured, resolved player: creates one notification', async () => {
  const injury = { playerId: 'p-1', playerName: 'A. Player', status: 'Out', returnDate: 'Aug 30', comment: 'knee' };
  const { db, usersDb, provider } = setup({ injuriesByTeam: { '1': [injury] } });
  await seedUsers(usersDb, ['1']);

  const summary = await pollAndCreateInjuryNotifications({ db, provider, now: NOW });

  assert.strictEqual(summary.created, 1);
  assert.strictEqual(summary.errors, 0);
  const rows = await db.collection('notifications').find({}).toArray();
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].type, 'injury');
  assert.strictEqual(rows[0].playerId, 'p-1');
  assert.strictEqual(rows[0].status, 'Out');
  assert.strictEqual(rows[0].expiresAt.getTime(), NOW.getTime() + 48 * 60 * 60 * 1000);
});

test('an injury row with no resolved playerId is skipped, not notified', async () => {
  const injury = { playerId: null, playerName: 'Unresolvable Player', status: 'Out', returnDate: null, comment: null };
  const { db, usersDb, provider } = setup({ injuriesByTeam: { '1': [injury] } });
  await seedUsers(usersDb, ['1']);

  const summary = await pollAndCreateInjuryNotifications({ db, provider, now: NOW });

  assert.strictEqual(summary.created, 0);
  assert.strictEqual(summary.checkedInjuries, 0);
});

test('re-polling the SAME status is a no-op duplicate, not an error', async () => {
  const injury = { playerId: 'p-1', playerName: 'A. Player', status: 'Out', returnDate: 'Aug 30', comment: 'knee' };
  const { db, usersDb, provider } = setup({ injuriesByTeam: { '1': [injury] } });
  await seedUsers(usersDb, ['1']);

  const first = await pollAndCreateInjuryNotifications({ db, provider, now: NOW });
  assert.strictEqual(first.created, 1);

  const second = await pollAndCreateInjuryNotifications({ db, provider, now: new Date(NOW.getTime() + 600000) });
  assert.strictEqual(second.created, 0, 'the same status must not be double-counted as newly created');
  assert.strictEqual(second.duplicatesSkipped, 1);
  assert.strictEqual(second.errors, 0);

  const rows = await db.collection('notifications').find({}).toArray();
  assert.strictEqual(rows.length, 1);
});

test('a status CHANGE for the same player creates a fresh notification (this is the actual change-detection signal)', async () => {
  const outStatus = { playerId: 'p-1', playerName: 'A. Player', status: 'Out', returnDate: 'Aug 30', comment: 'knee' };
  const { db, usersDb, provider } = setup({ injuriesByTeam: { '1': [outStatus] } });
  await seedUsers(usersDb, ['1']);

  const first = await pollAndCreateInjuryNotifications({ db, provider, now: NOW });
  assert.strictEqual(first.created, 1);

  // Same player, new status on a later poll -- provider.getTeamInjuries would now return this
  // updated row (a real status change, e.g. cleared to play).
  provider.getTeamInjuries = async () => [{ ...outStatus, status: 'Day-To-Day' }];
  const second = await pollAndCreateInjuryNotifications({ db, provider, now: new Date(NOW.getTime() + 600000) });
  assert.strictEqual(second.created, 1, 'a genuinely different status must notify again');
  assert.strictEqual(second.duplicatesSkipped, 0);

  const rows = await db.collection('notifications').find({}).toArray();
  assert.strictEqual(rows.length, 2);
  assert.deepStrictEqual(rows.map(r => r.status).sort(), ['Day-To-Day', 'Out']);
});

test('two users repping the same team both get notified for the same injured player', async () => {
  const injury = { playerId: 'p-1', playerName: 'A. Player', status: 'Out', returnDate: null, comment: null };
  const { db, usersDb, notificationsDb, provider } = setup({ injuriesByTeam: { '1': [injury] } });
  await seedUsers(usersDb, ['1', '1']);

  const summary = await pollAndCreateInjuryNotifications({ db, provider, now: NOW });

  assert.strictEqual(summary.created, 2);
  assert.strictEqual(notificationsDb.collection('notifications').insertManyCallCount, 1);
});

test('a team with zero rep\'d users never triggers getTeamInjuries for that team at all', async () => {
  const { db, usersDb, provider, calls } = setup({
    injuriesByTeam: {
      '1': [{ playerId: 'p-1', playerName: 'X', status: 'Out', returnDate: null, comment: null }],
      '2': [{ playerId: 'p-2', playerName: 'Y', status: 'Out', returnDate: null, comment: null }],
    },
  });
  await seedUsers(usersDb, ['1']);

  await pollAndCreateInjuryNotifications({ db, provider, now: NOW });

  assert.strictEqual(calls.some(c => c.teamId === '2'), false, 'team nobody reps must never be checked');
  assert.ok(calls.some(c => c.teamId === '1'));
});

test('a provider that throws for one team is skipped, not fatal — other teams still get checked', async () => {
  const dueInjury = { playerId: 'p-2', playerName: 'Y', status: 'Out', returnDate: null, comment: null };
  const { db, usersDb, provider, calls } = setup({
    injuriesByTeam: { '1': new Error('BDL 500'), '2': [dueInjury] },
  });
  await seedUsers(usersDb, ['1', '2']);

  const summary = await pollAndCreateInjuryNotifications({ db, provider, now: NOW });

  assert.strictEqual(summary.created, 1, 'team 2\'s injury must still be processed despite team 1 throwing');
  assert.strictEqual(summary.errors, 0, 'a skipped provider call is not itself counted as a job error');
  assert.ok(calls.some(c => c.teamId === '2'));
});

test('a total insertMany failure reports errors, not a false created count', async () => {
  const injury = { playerId: 'p-1', playerName: 'A. Player', status: 'Out', returnDate: null, comment: null };
  const { db, usersDb, notificationsDb, provider } = setup({ injuriesByTeam: { '1': [injury] } });
  await seedUsers(usersDb, ['1', '1']);
  notificationsDb.collection('notifications')._simulateTotalFailure();

  const summary = await pollAndCreateInjuryNotifications({ db, provider, now: NOW });

  assert.strictEqual(summary.created, 0);
  assert.ok(summary.errors >= 1);
});
