// deterministicHash.js — shared sha1-over-JSON helper.
//
// graded-report and narrative each hand-rolled the same
// crypto.createHash('sha1').update(JSON.stringify(...)).digest('hex') boilerplate to turn
// a deterministically-shaped input object into a cache/version key. Callers remain
// responsible for building a stable input shape (sorted arrays/objects) — this only
// wraps the crypto calls.
const crypto = require('crypto');

function sha1Json(obj) {
  return crypto.createHash('sha1').update(JSON.stringify(obj)).digest('hex');
}

module.exports = { sha1Json };
