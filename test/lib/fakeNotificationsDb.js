// fakeNotificationsDb.js — test-support only, not a *.test.js file so `node --test` won't run
// it as a suite. In-memory fake for db.collection('notifications'), covering exactly what
// server/lib/notificationsJob.js and server/routes/notifications.js call: insertMany(docs,
// {ordered:false}), and find(filter).sort(sortSpec).toArray().
//
// The insertMany error shape is the part worth getting exactly right (see
// server/lib/notificationsJob.js's catch block, lines ~106-142, and the driver source it cites —
// node_modules/mongodb/lib/bulk/common.js:56,387-388): unordered inserts throw a single
// MongoBulkWriteError for ANY failure, whether that's per-document duplicate-key collisions
// (writeErrors populated, code 11000) or a total driver/network-level failure (writeErrors EMPTY,
// insertedCount 0) — those two are indistinguishable except by inspecting writeErrors.length,
// which is exactly the distinction notificationsJob.js's fix depends on. This fake reproduces
// both shapes on purpose so that code path is actually exercised, not just typechecked.
const { ObjectId } = require('mongodb');
const { matchesFilter } = require('./fakeMongoFilter');

function createFakeNotificationsCollection() {
  const byId = new Map(); // key: _id hex -> stored doc
  const uniqueKeys = new Set(); // `${userId hex}:${gameId}` — mirrors the real unique compound index
  let insertManyCallCount = 0;
  let simulateTotalFailure = false;

  const collection = {
    async insertMany(docs) {
      insertManyCallCount += 1;

      if (simulateTotalFailure) {
        // A total driver-level failure (network drop, auth failure, server-selection timeout):
        // thrown as a plain Error with NO per-document detail, per the comment this fake is
        // modeled after. insertedCount is 0 because nothing was actually confirmed written.
        const err = new Error('simulated total insertMany failure (driver/network-level, no per-document detail)');
        err.name = 'MongoBulkWriteError';
        err.insertedCount = 0;
        err.writeErrors = [];
        throw err;
      }

      const writeErrors = [];
      let insertedCount = 0;
      const insertedIds = {};

      docs.forEach((doc, index) => {
        const key = `${String(doc.userId)}:${doc.gameId}`;
        if (uniqueKeys.has(key)) {
          writeErrors.push({
            code: 11000,
            index,
            errmsg: `E11000 duplicate key error collection: notifications index: userId_1_gameId_1 dup key: ${key}`,
          });
          return;
        }
        const _id = new ObjectId();
        byId.set(_id.toHexString(), { ...doc, _id });
        uniqueKeys.add(key);
        insertedIds[index] = _id;
        insertedCount += 1;
      });

      if (writeErrors.length > 0) {
        // Unordered mode still throws on ANY write error, even though the non-colliding docs in
        // the same batch above were written — insertedCount reflects only what actually landed.
        const err = new Error(`insertMany: ${writeErrors.length} write error(s) out of ${docs.length} doc(s)`);
        err.name = 'MongoBulkWriteError';
        err.insertedCount = insertedCount;
        err.writeErrors = writeErrors;
        throw err;
      }

      return { acknowledged: true, insertedCount, insertedIds };
    },

    find(filter = {}) {
      const matched = () => Array.from(byId.values()).filter(doc => matchesFilter(doc, filter));
      return {
        sort(sortSpec = {}) {
          const [[field, direction]] = Object.entries(sortSpec);
          return {
            async toArray() {
              return matched()
                .slice()
                .sort((a, b) => (new Date(a[field]).getTime() - new Date(b[field]).getTime()) * direction)
                .map(doc => ({ ...doc }));
            },
          };
        },
        async toArray() {
          return matched().map(doc => ({ ...doc }));
        },
      };
    },

    // -- test-only controls below; not part of the real Mongo driver API --

    // Forces the NEXT (and every subsequent, until _stopSimulatingTotalFailure()) insertMany call
    // to throw the total-failure shape instead of actually inserting, for exercising
    // notificationsJob.js's BLOCKING-fix code path (errors, not a false "created" count).
    _simulateTotalFailure() { simulateTotalFailure = true; },
    _stopSimulatingTotalFailure() { simulateTotalFailure = false; },

    get insertManyCallCount() { return insertManyCallCount; },

    // Seeds a doc directly (bypassing insertMany/its uniqueness bookkeeping) for route tests that
    // need pre-existing notification rows to read back via GET /api/notifications.
    _seed(doc) {
      const _id = doc._id || new ObjectId();
      const stored = { ...doc, _id };
      byId.set(_id.toHexString(), stored);
      if (doc.userId !== undefined && doc.gameId !== undefined) {
        uniqueKeys.add(`${String(doc.userId)}:${doc.gameId}`);
      }
      return _id;
    },
  };

  return collection;
}

function createFakeNotificationsDb() {
  const notificationsCollection = createFakeNotificationsCollection();
  return {
    collection(name) {
      if (name !== 'notifications') {
        throw new Error(`fakeNotificationsDb: no fake collection for "${name}"`);
      }
      return notificationsCollection;
    },
  };
}

// notificationsJob.js reads from db.collection('users') AND db.collection('notifications') in
// the same run — neither test/lib/fakeUsersDb.js nor this file alone is a full `db`, so job tests
// and the internal-jobs route test (which injects a single db via _setDbForTest) need both
// wired into one object. Kept here (not in fakeUsersDb.js) since this is the file that actually
// needs both fakes at once; fakeUsersDb.js stays usable standalone for the auth/users tests that
// only ever touch the users collection.
function combineFakeDbs(usersDb, notificationsDb) {
  return {
    collection(name) {
      if (name === 'users') return usersDb.collection('users');
      if (name === 'notifications') return notificationsDb.collection('notifications');
      throw new Error(`combined fake db: no fake collection for "${name}"`);
    },
  };
}

module.exports = { createFakeNotificationsDb, createFakeNotificationsCollection, combineFakeDbs };
