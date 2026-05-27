// Rebuild ONLY the fingerprint cache (playerFingerprints collection) for Cross-Era Similarity.
// Assumes the distribution cache + playerIndex are already seeded in Mongo (run seed-distributions
// for a full cold build). Use this for fast local re-builds after an AXES change / version bump.
require('dotenv').config();
const { whenConnected } = require('../server/db');
const { buildFingerprintIndex } = require('../server/lib/percentileClient');

(async () => {
  console.log('Waiting for MongoDB...');
  const db = await whenConnected();
  if (!db) {
    console.log('No MongoDB URI — skipping fingerprint seed');
    process.exit(0);
  }

  console.log('Building fingerprint index...');
  try {
    await buildFingerprintIndex();
    console.log('Fingerprint index built.');
  } catch (err) {
    console.warn('Fingerprint index build failed:', err.message);
  }

  process.exit(0);
})();
