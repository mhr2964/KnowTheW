// routes/api.js — aggregates the resource-focused route files (teams, players,
// playerAnalysis, reports, meta) into the single router server/index.js mounts at
// '/api'. Split out of a single 1127-line file that owned all of these endpoints
// directly (see refactor-log.md).
const express = require('express');
const router  = express.Router();

router.use(require('./teams'));
router.use(require('./standings'));
router.use(require('./players'));
router.use(require('./playerAnalysis'));
router.use(require('./reports'));
router.use(require('./meta'));
router.use(require('./auth'));
router.use(require('./users'));
router.use(require('./notifications'));

module.exports = router;
