const { MongoClient } = require('mongodb');

let db = null;
let override = null;
let _resolveConnected;
const connectedPromise = new Promise(resolve => { _resolveConnected = resolve; });

// Skip the real DB connection under test: it keeps an open handle (hanging the test runner) and
// tests must not depend on Atlas. Routes already degrade gracefully when getDb() returns null.
if (process.env.MONGODB_URI && process.env.NODE_ENV !== 'test') {
  MongoClient.connect(process.env.MONGODB_URI)
    .then(async client => {
      db = client.db('knowthew');
      console.log('MongoDB connected');
      // Enforces one account per username at the DB layer (routes also lowercase + catch the
      // resulting E11000 for a friendly 409). Awaited before whenConnected() resolves so anything
      // that depends on that promise can trust the index already exists — a failure here is logged
      // loudly (not swallowed) since it's the *only* place uniqueness is enforced, but doesn't
      // block server startup/route serving.
      try {
        await db.collection('users').createIndex({ username: 1 }, { unique: true });
      } catch (err) {
        console.error('SECURITY: users.username unique index failed to create — duplicate usernames are NOT prevented:', err);
      }
      // TTL index: MongoDB's background reaper deletes a notification doc once expiresAt is in
      // the past (a few hours after kickoff — see lib/notificationsJob.js), so stale in-app
      // notifications clean themselves up with no separate cron/job needed.
      try {
        await db.collection('notifications').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
      } catch (err) {
        console.error('notifications.expiresAt TTL index failed to create — expired notifications will NOT be auto-cleaned:', err);
      }
      // Idempotency: the polling job (lib/notificationsJob.js) runs every 10 minutes and a game's
      // ~5-15-minute due window can span more than one poll, so without this a user could get
      // duplicate notifications for the same game. Unique on the pair so re-inserting an
      // already-notified (user, game) is rejected (E11000) rather than silently duplicating.
      try {
        await db.collection('notifications').createIndex({ userId: 1, gameId: 1 }, { unique: true });
      } catch (err) {
        console.error('SECURITY: notifications.userId_gameId unique index failed to create — duplicate notifications are NOT prevented:', err);
      }
      // Non-unique: the polling job looks up "who reps team X" once per team every 10 minutes;
      // without this it's a full collection scan that gets slower as the user base grows.
      try {
        await db.collection('users').createIndex({ teamRepId: 1 });
      } catch (err) {
        console.error('users.teamRepId index failed to create — the notifications job will full-scan users:', err);
      }
      _resolveConnected(db);
    })
    .catch(err => {
      console.error('MongoDB connection failed:', err.message);
      _resolveConnected(null);
    });
} else {
  _resolveConnected(null);
}

// Test-only: inject a fake db (see test/lib/fakeUsersDb.js) so auth/users route tests can run
// against an in-memory collection instead of the real (null-under-test) MongoDB connection.
// Mirrors server/providers/index.js's _setProviderForTest/_resetProviderCache pattern.
function _setDbForTest(fakeDb) { override = fakeDb; }
// Test-only: clear the injected override (call in test teardown) so getDb() reverts to the
// real (null-under-test) db.
function _resetDbForTest() { override = null; }

module.exports = {
  getDb: () => override || db,
  whenConnected: () => connectedPromise,
  _setDbForTest,
  _resetDbForTest,
};
