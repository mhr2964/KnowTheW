require('dotenv').config();
const { whenConnected } = require('../server/db');
const { warmDistributionCache, buildPlayerIndex } = require('../server/lib/percentileClient');

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

  process.exit(0);
})();
