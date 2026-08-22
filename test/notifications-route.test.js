// Route tests for GET /api/notifications (server/routes/notifications.js), protected by
// requireAuth (server/lib/auth.js). Own fake db instance (users + notifications) per file, same
// isolation pattern as test/users-team-rep.test.js — the session cookie is minted directly via
// signToken() rather than going through POST /api/auth/login, since this file only needs an
// *authenticated* request, not to exercise login itself.

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { ObjectId } = require('mongodb');

const db = require('../server/db');
const { createFakeDb } = require('./lib/fakeUsersDb');
const { createFakeNotificationsDb, combineFakeDbs } = require('./lib/fakeNotificationsDb');
const { COOKIE_NAME, signToken } = require('../server/lib/auth');
const app = require('../server/index');

const EXPECTED_GAME_KEYS = ['id', 'type', 'teamRepId', 'createdAt', 'expiresAt', 'gameId', 'opponent', 'atVs', 'gameDate'].sort();
const EXPECTED_INJURY_KEYS = ['id', 'type', 'teamRepId', 'createdAt', 'expiresAt', 'playerId', 'playerName', 'status', 'returnDate', 'comment'].sort();

let server;
let baseUrl;
let usersDb;
let notificationsDb;

before(async () => {
  usersDb = createFakeDb();
  notificationsDb = createFakeNotificationsDb();
  db._setDbForTest(combineFakeDbs(usersDb, notificationsDb));

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

async function seedUser(teamRepId) {
  const { insertedId } = await usersDb.collection('users').insertOne({
    username: `notif-user-${new ObjectId().toHexString()}`,
    passwordHash: 'unused-in-this-file',
    teamRepId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return insertedId;
}

function cookieFor(userId) {
  return `${COOKIE_NAME}=${signToken(String(userId))}`;
}

function getNotifications(cookie) {
  return fetch(`${baseUrl}/api/notifications`, {
    headers: cookie ? { Cookie: cookie } : {},
  });
}

function seedNotification({ userId, teamRepId, gameId, gameDate, expiresAt, opponent = { id: '5', abbreviation: 'OPP', logo: null }, atVs = 'vs', createdAt = new Date() }) {
  return notificationsDb.collection('notifications')._seed({
    userId,
    teamRepId,
    gameId,
    opponent,
    atVs,
    gameDate,
    expiresAt,
    createdAt,
  });
}

function seedInjuryNotification({ userId, teamRepId, playerId, playerName, status, returnDate = null, comment = null, expiresAt, createdAt = new Date() }) {
  return notificationsDb.collection('notifications')._seed({
    type: 'injury',
    userId,
    teamRepId,
    playerId,
    playerName,
    status,
    returnDate,
    comment,
    expiresAt,
    createdAt,
  });
}

test('GET /api/notifications: 401 without an auth cookie', async () => {
  const res = await getNotifications();
  assert.strictEqual(res.status, 401);
});

test('GET /api/notifications: 200 with an empty array when the user has no notifications', async () => {
  const userId = await seedUser('1');
  const res = await getNotifications(cookieFor(userId));
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.deepStrictEqual(body, { notifications: [] });
});

test('GET /api/notifications: 200 with the user\'s notifications, sorted by createdAt descending (newest first), in the documented shape', async () => {
  const userId = await seedUser('1');
  const now = Date.now();
  // createdAt controls order here, deliberately decoupled from gameDate (a game created earlier
  // but kicking off sooner still sorts by when the ALERT was created, not by kickoff time -- see
  // routes/notifications.js's own comment on why createdAt is the shared sort key across both
  // notification types).
  const older = seedNotification({
    userId, teamRepId: '1', gameId: 'evt-older',
    gameDate: new Date(now + 2 * 60 * 60 * 1000),
    expiresAt: new Date(now + 6 * 60 * 60 * 1000),
    createdAt: new Date(now - 60000),
  });
  const newer = seedNotification({
    userId, teamRepId: '1', gameId: 'evt-newer',
    gameDate: new Date(now + 30 * 60 * 1000),
    expiresAt: new Date(now + 4.5 * 60 * 60 * 1000),
    createdAt: new Date(now),
  });
  void older;
  void newer;

  const res = await getNotifications(cookieFor(userId));
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.notifications.length, 2);
  assert.deepStrictEqual(body.notifications.map(n => n.gameId), ['evt-newer', 'evt-older']);

  for (const notification of body.notifications) {
    assert.deepStrictEqual(Object.keys(notification).sort(), EXPECTED_GAME_KEYS);
    assert.strictEqual(notification.type, 'game');
  }
  const first = body.notifications[0];
  assert.strictEqual(first.teamRepId, '1');
  assert.strictEqual(first.atVs, 'vs');
  assert.deepStrictEqual(first.opponent, { id: '5', abbreviation: 'OPP', logo: null });
});

test('GET /api/notifications: an injury-type notification carries player fields, not game fields', async () => {
  const userId = await seedUser('1');
  const now = Date.now();
  seedInjuryNotification({
    userId, teamRepId: '1', playerId: 'p-42', playerName: 'Test Player', status: 'Out',
    returnDate: 'Aug 30', comment: 'left knee',
    expiresAt: new Date(now + 48 * 60 * 60 * 1000),
  });

  const res = await getNotifications(cookieFor(userId));
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.notifications.length, 1);
  const [n] = body.notifications;
  assert.deepStrictEqual(Object.keys(n).sort(), EXPECTED_INJURY_KEYS);
  assert.strictEqual(n.type, 'injury');
  assert.strictEqual(n.playerName, 'Test Player');
  assert.strictEqual(n.status, 'Out');
});

test('GET /api/notifications: excludes a notification whose expiresAt is already in the past', async () => {
  const userId = await seedUser('1');
  const now = Date.now();
  seedNotification({
    userId, teamRepId: '1', gameId: 'evt-already-expired',
    gameDate: new Date(now - 5 * 60 * 60 * 1000),
    expiresAt: new Date(now - 60 * 1000), // expired one minute ago, not yet TTL-reaped
  });
  seedNotification({
    userId, teamRepId: '1', gameId: 'evt-still-active',
    gameDate: new Date(now + 60 * 60 * 1000),
    expiresAt: new Date(now + 4 * 60 * 60 * 1000),
  });

  const res = await getNotifications(cookieFor(userId));
  const body = await res.json();
  assert.deepStrictEqual(body.notifications.map(n => n.gameId), ['evt-still-active']);
});

test('GET /api/notifications: a stale notification from a since-abandoned team rep is excluded once teamRepId changes', async () => {
  const userId = await seedUser('team-A');
  const now = Date.now();
  seedNotification({
    userId, teamRepId: 'team-A', gameId: 'evt-team-a-stale',
    gameDate: new Date(now + 60 * 60 * 1000),
    expiresAt: new Date(now + 4 * 60 * 60 * 1000), // still unexpired, still physically present
  });

  // User switches team reps — the notifications job has no way to retroactively relabel the old
  // row, so the fix under test is read-time filtering against the user's CURRENT teamRepId.
  await usersDb.collection('users').updateOne({ _id: userId }, { $set: { teamRepId: 'team-B' } });

  const res = await getNotifications(cookieFor(userId));
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.deepStrictEqual(
    body.notifications, [],
    'a notification tied to the OLD teamRepId must not appear after the user reps a different team'
  );

  // And a fresh notification for the NEW team rep does show up — proves this isn't just "nothing
  // ever shows up for this user" but genuine current-team scoping.
  seedNotification({
    userId, teamRepId: 'team-B', gameId: 'evt-team-b-current',
    gameDate: new Date(now + 60 * 60 * 1000),
    expiresAt: new Date(now + 4 * 60 * 60 * 1000),
  });
  const res2 = await getNotifications(cookieFor(userId));
  const body2 = await res2.json();
  assert.deepStrictEqual(body2.notifications.map(n => n.gameId), ['evt-team-b-current']);
});
