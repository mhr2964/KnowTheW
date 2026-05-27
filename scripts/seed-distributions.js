require('dotenv').config();
const { whenConnected } = require('../server/db');
const { warmDistributionCache, buildPlayerIndex, buildFingerprintIndex } = require('../server/lib/percentileClient');

(async () => {
  console.log('Waiting for MongoDB...');
  const db = await whenConnected();
  if (!db) {
    console.log('No MongoDB URI — skipping distribution seed');
    process.exit(0);
  }

  console.log('Seeding league distribution cache...');
  try {
    await warmDistributionCache();
    console.log('Distribution cache seeded.');
  } catch (err) {
    console.warn('Distribution cache seed failed:', err.message);
  }

  console.log('Building player index...');
  try {
    await buildPlayerIndex();
    console.log('Player index built.');
  } catch (err) {
    console.warn('Player index build failed:', err.message);
  }

  // Fingerprint cache depends on the player index + warm distributions above (it reuses the cached
  // percentile distributions, so it must run last). Powers Cross-Era Similarity.
  console.log('Building fingerprint index...');
  try {
    await buildFingerprintIndex();
    console.log('Fingerprint index built.');
  } catch (err) {
    console.warn('Fingerprint index build failed:', err.message);
  }

  process.exit(0);
})();
