// fakeUsersDb.js — test-support only, not a *.test.js file so `node --test` won't run it as
// a suite. Implements just the subset of the Mongo Db/Collection API that server/lib/auth.js,
// server/routes/auth.js, server/routes/users.js, and server/lib/notificationsJob.js actually
// call against db.collection('users'): insertOne, findOne({username}|{_id}),
// updateOne({_id}, {$set}), distinct('teamRepId', {teamRepId:{$ne:null}}), and
// find({teamRepId}).project({_id:1}).toArray().
//
// Real ObjectId instances (not arbitrary strings) back every _id here because requireAuth does
// `new ObjectId(payload.sub)` on every request — an arbitrary fake id string would blow up that
// constructor (invalid hex) and mask real auth behavior behind a false 401.
const { ObjectId } = require('mongodb');
const { matchesFilter } = require('./fakeMongoFilter');

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

    // notificationsJob.js: db.collection('users').distinct('teamRepId', { teamRepId: { $ne: null } })
    // — every distinct team a user currently reps, so the job only checks schedules for teams
    // that actually have someone to notify.
    async distinct(field, filter = {}) {
      const values = new Set();
      for (const doc of usersById.values()) {
        if (!matchesFilter(doc, filter)) continue;
        const value = doc[field];
        if (value !== undefined && value !== null) values.add(value);
      }
      return Array.from(values);
    },

    // notificationsJob.js: db.collection('users').find({ teamRepId: teamId }).project({ _id: 1 }).toArray()
    // — everyone repping a given team, id-only. Real projection would also suppress _id given an
    // explicit {_id:0}, but nothing here calls it that way, so that's out of scope.
    find(filter = {}) {
      const matched = Array.from(usersById.values()).filter(doc => matchesFilter(doc, filter));
      return {
        project(projection = {}) {
          const keys = Object.keys(projection).filter(key => projection[key]);
          return {
            async toArray() {
              return matched.map(doc => {
                const projected = {};
                for (const key of keys) projected[key] = doc[key];
                return projected;
              });
            },
          };
        },
        async toArray() {
          return matched.map(doc => ({ ...doc }));
        },
      };
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
