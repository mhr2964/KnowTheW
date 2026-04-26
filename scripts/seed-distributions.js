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
  await warmDistributionCache();
  console.log('Distribution cache seeded.');
  console.log('Building player index...');
  await buildPlayerIndex();
  console.log('Player index built.');
  process.exit(0);
})();
