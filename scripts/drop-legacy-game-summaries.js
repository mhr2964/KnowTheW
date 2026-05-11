// One-off migration script: drop the gameSummaries collection freed by the playerSeasonPbp
// cache refactor. Idempotent — checks for the collection before attempting the drop.
// Run via: heroku run node scripts/drop-legacy-game-summaries.js -a knowthew
require('dotenv').config();
const { whenConnected } = require('../server/db');

(async () => {
  const db = await whenConnected();
  if (!db) {
    console.log('No MongoDB URI — nothing to drop');
    process.exit(0);
  }
  const cols = await db.listCollections({ name: 'gameSummaries' }).toArray();
  if (cols.length === 0) {
    console.log('gameSummaries already absent — nothing to do');
    process.exit(0);
  }
  await db.collection('gameSummaries').drop();
  console.log('Dropped gameSummaries collection');
  process.exit(0);
})().catch(err => {
  console.error('drop failed:', err.message);
  process.exit(1);
});
