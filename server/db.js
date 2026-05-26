const { MongoClient } = require('mongodb');

let db = null;
let _resolveConnected;
const connectedPromise = new Promise(resolve => { _resolveConnected = resolve; });

// Skip the real DB connection under test: it keeps an open handle (hanging the test runner) and
// tests must not depend on Atlas. Routes already degrade gracefully when getDb() returns null.
if (process.env.MONGODB_URI && process.env.NODE_ENV !== 'test') {
  MongoClient.connect(process.env.MONGODB_URI)
    .then(client => {
      db = client.db('knowthew');
      console.log('MongoDB connected');
      _resolveConnected(db);
    })
    .catch(err => {
      console.error('MongoDB connection failed:', err.message);
      _resolveConnected(null);
    });
} else {
  _resolveConnected(null);
}

module.exports = { getDb: () => db, whenConnected: () => connectedPromise };
