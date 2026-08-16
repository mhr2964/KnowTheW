// fakeUsersDb.js — test-support only, not a *.test.js file so `node --test` won't run it as
// a suite. Implements just the subset of the Mongo Db/Collection API that server/lib/auth.js,
// server/routes/auth.js, and server/routes/users.js actually call against
// db.collection('users'): insertOne, findOne({username}|{_id}), updateOne({_id}, {$set}).
//
// Real ObjectId instances (not arbitrary strings) back every _id here because requireAuth does
// `new ObjectId(payload.sub)` on every request — an arbitrary fake id string would blow up that
// constructor (invalid hex) and mask real auth behavior behind a false 401.
const { ObjectId } = require('mongodb');

function createFakeDb() {
  const usersById = new Map(); // key: ObjectId hex string -> stored doc (includes real _id)

  const usersCollection = {
    async insertOne(doc) {
      if (doc && doc.username !== undefined) {
        for (const existing of usersById.values()) {
          if (existing.username === doc.username) {
            // Shaped like the real Mongo duplicate-key error: routes/auth.js's signup handler
            // checks `err.code === 11000` to turn this into a 409.
            const err = new Error('E11000 duplicate key error collection: users index: username_1');
            err.code = 11000;
            throw err;
          }
        }
      }
      // Mirrors real MongoDB: honor a caller-supplied _id (server/routes/auth.js's signup now
      // generates one up front so it can sign the JWT before inserting) rather than always
      // minting a new one, which would leave the stored doc's _id mismatched with the JWT sub.
      const _id = (doc && doc._id) || new ObjectId();
      const stored = { ...doc, _id };
      usersById.set(_id.toHexString(), stored);
      return { acknowledged: true, insertedId: _id };
    },

    async findOne(filter) {
      if (filter && filter._id !== undefined) {
        const doc = usersById.get(String(filter._id));
        return doc ? { ...doc } : null;
      }
      if (filter && filter.username !== undefined) {
        for (const doc of usersById.values()) {
          if (doc.username === filter.username) return { ...doc };
        }
        return null;
      }
      throw new Error(`fakeUsersDb.findOne: unsupported filter shape ${JSON.stringify(filter)}`);
    },

    async updateOne(filter, update) {
      if (!filter || filter._id === undefined) {
        throw new Error(`fakeUsersDb.updateOne: unsupported filter shape ${JSON.stringify(filter)}`);
      }
      const key = String(filter._id);
      const doc = usersById.get(key);
      if (!doc) return { matchedCount: 0, modifiedCount: 0 };
      if (update && update.$set) {
        Object.assign(doc, update.$set);
      }
      return { matchedCount: 1, modifiedCount: 1 };
    },
  };

  return {
    collection(name) {
      if (name !== 'users') {
        throw new Error(`fakeUsersDb: no fake collection for "${name}"`);
      }
      return usersCollection;
    },
  };
}

module.exports = { createFakeDb };
