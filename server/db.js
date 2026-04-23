const { MongoClient } = require('mongodb');

let db = null;
if (process.env.MONGODB_URI) {
  MongoClient.connect(process.env.MONGODB_URI)
    .then(client => { db = client.db('knowthew'); console.log('MongoDB connected'); })
    .catch(err  => console.error('MongoDB connection failed:', err.message));
}

module.exports = { getDb: () => db };
