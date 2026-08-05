// adminAuth.js — admin-gated ?refresh=1 check shared by the graded-report and narrative
// routes. Moved out of routes/api.js verbatim during the God-Module split — no behavior
// change.
//
// Constant-time check: returns true only when refresh=1 AND the x-admin-token header
// matches the ADMIN_TOKEN env var. Timing-safe compare prevents a length/byte oracle that
// would expose a cache-flush vector (each successful guess also triggers a paid Claude
// call). Fail-closed when ADMIN_TOKEN is unset.
const crypto = require('crypto');

function authorizeAdminRefresh(req) {
  if (req.query.refresh !== '1') return false;
  const adminToken  = process.env.ADMIN_TOKEN;
  const headerToken = req.headers['x-admin-token'];
  if (!adminToken || !headerToken) return false;
  const aBuf = Buffer.from(adminToken,  'utf8');
  const bBuf = Buffer.from(headerToken, 'utf8');
  if (aBuf.length !== bBuf.length) return false; // timingSafeEqual requires equal-length buffers
  return crypto.timingSafeEqual(aBuf, bBuf);
}

module.exports = { authorizeAdminRefresh };
