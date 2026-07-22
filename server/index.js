require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5051;

// CSP/COEP/CORP left off: the site loads Google AdSense, Google Analytics, and cross-origin ESPN
// CDN images, none of which send CORP headers — a correct CSP allowlist covering all of them is a
// separate, larger task (see docs/design/deployment-ops.md). Everything else helmet sets by
// default (X-Content-Type-Options, X-Frame-Options, HSTS, Referrer-Policy, COOP, etc.) is safe.
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: false,
}));

// GET-only public API, no cookies/auth beyond a custom header (server/routes/api.js) — this
// allowlist only stops browser JS on other sites from reading responses, it's not an access-
// control mechanism. `callback(null, false)` (not an Error) so a mismatched Origin just omits the
// ACAO header instead of erroring the request — server-to-server/curl callers are unaffected.
const ALLOWED_ORIGINS = ['https://knowthew.net', 'https://www.knowthew.net'];
app.use(cors({
  origin(origin, callback) {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(null, false);
  },
}));
app.use(express.json());

app.use('/api', require('./routes/api'));
app.use(require('./routes/sitemap'));
app.use(require('./middleware/socialPreview'));

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
  });
}

// Listen only when run directly (`node server/index.js`), not when imported by tests.
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
