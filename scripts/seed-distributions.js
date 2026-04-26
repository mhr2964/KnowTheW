require('dotenv').config();
const { whenConnected } = require('../server/db');
const { warmDistributionCache } = require('../server/lib/percentileClient');

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
  process.exit(0);
})();
