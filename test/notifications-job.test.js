// Unit tests for server/lib/notificationsJob.js's pollAndCreateNotifications(). Framework-free
// by design (see that file's own header comment), so these call it directly with a fake db/
// provider/clock — no HTTP, no real Mongo/ESPN. HTTP-level coverage of the route that wraps this
// (requireSchedulerAuth, status-code mapping) lives in test/internal-jobs-route.test.js instead.

process.env.NODE_ENV = 'test';

const { test } = require('node:test');
const assert = require('node:assert');

const { createFakeDb } = require('./lib/fakeUsersDb');
const { createFakeNotificationsDb, combineFakeDbs } = require('./lib/fakeNotificationsDb');
const { pollAndCreateNotifications, DUE_WINDOW_MIN_MINUTES, DUE_WINDOW_MAX_MINUTES } = require('../server/lib/notificationsJob');

const NOW = new Date('2026-08-15T20:00:00.000Z');

function minutesFromNow(minutes) {
  return new Date(NOW.getTime() + minutes * 60000).toISOString();
}

function makeEvent({ id = 'evt-1', minutesOut, opponent = { id: '99', abbreviation: 'OPP', logo: null }, atVs = 'vs' } = {}) {
  return { id, date: minutesFromNow(minutesOut), opponent, atVs, result: null, teamScore: null, oppScore: null, winner: null };
}

// Builds a combined { collection('users'|'notifications') } fake db plus a spyable provider
// wired from a { [teamId]: { [seasontype]: eventsOrError } } map. `eventsOrError` is either an
// array of events, `null` (ESPN-call-failed-not-thrown), or an Error instance (thrown, not
// returned) — the two distinct skip-not-fatal paths the job handles.
function setup({ scheduleByTeam = {} } = {}) {
  const usersDb = createFakeDb();
  const notificationsDb = createFakeNotificationsDb();
  const db = combineFakeDbs(usersDb, notificationsDb);

  const calls = [];
  const provider = {
    async getTeamSchedule(teamId, year, seasontype) {
      calls.push({ teamId, year, seasontype });
      const entry = scheduleByTeam[teamId]?.[seasontype];
      if (entry instanceof Error) throw entry;
      return entry === undefined ? null : entry;
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

test('a game 10 minutes out is due: creates one notification with expiresAt = gameDate + 4h exactly', async () => {
  const event = makeEvent({ minutesOut: 10 });
  const { db, usersDb, provider } = setup({ scheduleByTeam: { '1': { 2: [event] } } });
  await seedUsers(usersDb, ['1']);

  const summary = await pollAndCreateNotifications({ db, provider, now: NOW });

  assert.strictEqual(summary.created, 1);
  assert.strictEqual(summary.errors, 0);
  assert.strictEqual(summary.duplicatesSkipped, 0);

  const rows = await db.collection('notifications').find({}).toArray();
  assert.strictEqual(rows.length, 1);
  const expectedExpiresAt = new Date(event.date).getTime() + 4 * 60 * 60 * 1000;
  assert.strictEqual(rows[0].expiresAt.getTime(), expectedExpiresAt);
  assert.strictEqual(rows[0].gameId, String(event.id));
  assert.strictEqual(rows[0].teamRepId, '1');
});

test('games at 20 minutes out and 2 minutes out are not due: nothing created', async () => {
  const events = [makeEvent({ id: 'evt-far', minutesOut: 20 }), makeEvent({ id: 'evt-near', minutesOut: 2 })];
  const { db, usersDb, provider } = setup({ scheduleByTeam: { '1': { 2: events } } });
  await seedUsers(usersDb, ['1']);

  const summary = await pollAndCreateNotifications({ db, provider, now: NOW });

  assert.strictEqual(summary.created, 0);
  const rows = await db.collection('notifications').find({}).toArray();
  assert.strictEqual(rows.length, 0);
});

test('the due window is inclusive on both ends: exactly 3 minutes out and exactly 18 minutes out both count', async () => {
  assert.strictEqual(DUE_WINDOW_MIN_MINUTES, 3);
  assert.strictEqual(DUE_WINDOW_MAX_MINUTES, 18);

  const events = [makeEvent({ id: 'evt-min-edge', minutesOut: 3 }), makeEvent({ id: 'evt-max-edge', minutesOut: 18 })];
  const { db, usersDb, provider } = setup({ scheduleByTeam: { '1': { 2: events } } });
  await seedUsers(usersDb, ['1']);

  const summary = await pollAndCreateNotifications({ db, provider, now: NOW });

  assert.strictEqual(summary.created, 2);
  const rows = await db.collection('notifications').find({}).toArray();
  const gameIds = rows.map(r => r.gameId).sort();
  assert.deepStrictEqual(gameIds, ['evt-max-edge', 'evt-min-edge']);
});

test('two users repping the same team with one due game both get notified via a single insertMany call', async () => {
  const event = makeEvent({ minutesOut: 10 });
  const { db, usersDb, notificationsDb, provider } = setup({ scheduleByTeam: { '1': { 2: [event] } } });
  await seedUsers(usersDb, ['1', '1']);

  const summary = await pollAndCreateNotifications({ db, provider, now: NOW });

  assert.strictEqual(summary.created, 2);
  assert.strictEqual(notificationsDb.collection('notifications').insertManyCallCount, 1);
  const rows = await db.collection('notifications').find({}).toArray();
  assert.strictEqual(rows.length, 2);
});

test('re-polling a still-due game skips the already-notified (userId, gameId) pair as a duplicate, not an error', async () => {
  const event = makeEvent({ minutesOut: 10 });
  const { db, usersDb, provider } = setup({ scheduleByTeam: { '1': { 2: [event] } } });
  await seedUsers(usersDb, ['1']);

  const first = await pollAndCreateNotifications({ db, provider, now: NOW });
  assert.strictEqual(first.created, 1);
  assert.strictEqual(first.duplicatesSkipped, 0);
  assert.strictEqual(first.errors, 0);

  // Same game, still inside the due window a poll cycle later (clock nudged forward, event
  // unchanged) — simulates the real 10-minute-poll-interval-vs-15-minute-window overlap.
  const second = await pollAndCreateNotifications({ db, provider, now: new Date(NOW.getTime() + 60000) });
  assert.strictEqual(second.created, 0, 'the repeat insert must not be double-counted as newly created');
  assert.strictEqual(second.duplicatesSkipped, 1);
  assert.strictEqual(second.errors, 0, 'a duplicate-key collision is expected steady-state, not an error');

  const rows = await db.collection('notifications').find({}).toArray();
  assert.strictEqual(rows.length, 1, 'still exactly one notification row for this (user, game) pair');
});

// The BLOCKING-fix regression test: a total insertMany failure (no per-document write detail,
// insertedCount 0) must surface as errors, not be reported as a false "created" count. Before the
// fix this branch inferred created via docs.length - writeErrors.length, which for an EMPTY
// writeErrors list on a fully-failed call reports full success (docs.length - 0 = docs.length)
// even though nothing was written — this assertion is exactly what would have caught that.
test('a total insertMany failure (network/driver-level, zero per-doc detail) reports errors, not a false created count', async () => {
  const event = makeEvent({ minutesOut: 10 });
  const { db, usersDb, notificationsDb, provider } = setup({ scheduleByTeam: { '1': { 2: [event] } } });
  await seedUsers(usersDb, ['1', '1', '1']);
  notificationsDb.collection('notifications')._simulateTotalFailure();

  const summary = await pollAndCreateNotifications({ db, provider, now: NOW });

  assert.strictEqual(summary.created, 0, 'nothing was actually written, so created must be 0, not docs.length');
  assert.ok(summary.errors >= 1, 'a total driver-level failure must be counted as an error');
  assert.strictEqual(summary.duplicatesSkipped, 0);

  const rows = await db.collection('notifications').find({}).toArray();
  assert.strictEqual(rows.length, 0);
});

test('a provider that throws for one team/seasontype is skipped, not fatal — other teams still get checked', async () => {
  const dueEvent = makeEvent({ minutesOut: 10 });
  const { db, usersDb, provider, calls } = setup({
    scheduleByTeam: {
      '1': { 2: new Error('ESPN 500'), 3: null },
      '2': { 2: [dueEvent], 3: null },
    },
  });
  await seedUsers(usersDb, ['1', '2']);

  const summary = await pollAndCreateNotifications({ db, provider, now: NOW });

  assert.strictEqual(summary.created, 1, 'team 2\'s due game must still be processed despite team 1 throwing');
  assert.strictEqual(summary.errors, 0, 'a skipped provider call is not itself counted as a job error');
  const checkedTeam2 = calls.some(c => c.teamId === '2' && c.seasontype === 2);
  assert.ok(checkedTeam2, 'team 2 must have actually been checked, not short-circuited by team 1\'s failure');
});

test('a provider that returns null for one team/seasontype is skipped, not fatal — distinct from the throw case', async () => {
  const dueEvent = makeEvent({ minutesOut: 10 });
  const { db, usersDb, provider } = setup({
    scheduleByTeam: {
      '1': { 2: null, 3: null }, // ESPN call itself failed, not "no games"
      '2': { 2: [dueEvent], 3: null },
    },
  });
  await seedUsers(usersDb, ['1', '2']);

  const summary = await pollAndCreateNotifications({ db, provider, now: NOW });

  assert.strictEqual(summary.created, 1);
  assert.strictEqual(summary.errors, 0);
});

test('a team with zero rep\'d users never triggers getTeamSchedule for that team at all', async () => {
  const dueEvent = makeEvent({ minutesOut: 10 });
  const { db, usersDb, provider, calls } = setup({
    scheduleByTeam: {
      '1': { 2: [dueEvent], 3: null },
      // Team '2' has a schedule available from the provider but no user reps it — distinct()
      // must exclude it before getTeamSchedule is ever called.
      '2': { 2: [makeEvent({ id: 'evt-team2', minutesOut: 10 })], 3: null },
    },
  });
  await seedUsers(usersDb, ['1']);

  await pollAndCreateNotifications({ db, provider, now: NOW });

  const checkedTeam2 = calls.some(c => c.teamId === '2');
  assert.strictEqual(checkedTeam2, false, 'getTeamSchedule must never be called for a team nobody currently reps');
  const checkedTeam1 = calls.some(c => c.teamId === '1' && c.seasontype === 2);
  assert.ok(checkedTeam1, 'the actually-rep\'d team must still be checked');
});
