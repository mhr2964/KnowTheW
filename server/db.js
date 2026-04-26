const { MongoClient } = require('mongodb');

let db = null;
let _resolveConnected;
const connectedPromise = new Promise(resolve => { _resolveConnected = resolve; });

if (process.env.MONGODB_URI) {
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
