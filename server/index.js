require('dotenv').config();

// Sentry's auto-instrumentation patches other modules (express, http, etc.) at require time, so
// this has to run before they're required — no-ops entirely if SENTRY_DSN isn't set (local dev/test).
const Sentry = require('@sentry/node');
if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN });
}

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5051;

// Heroku terminates TLS and proxies every request through exactly one router hop, so without this
// Express sees the router's socket IP for every request (not the real client IP), which both
// breaks IP-based rate limiting (apiLimiter/authLimiter below would bucket the entire site under
// one IP) and makes express-rate-limit throw ERR_ERL_UNEXPECTED_X_FORWARDED_FOR on proxied
// requests. `1` trusts exactly one hop (Heroku's router) rather than an arbitrary/attacker-
// controlled X-Forwarded-For chain. Express reads this setting per-request (not at construction
// time), but it's set up front so req.ip is correct everywhere, including the limiters below.
app.set('trust proxy', 1);

// CSP/COEP/CORP left off: the site loads Google AdSense, Google Analytics, and cross-origin ESPN
// CDN images, none of which send CORP headers — a correct CSP allowlist covering all of them is a
// separate, larger task (see docs/design/deployment-ops.md). Everything else helmet sets by
// default (X-Content-Type-Options, X-Frame-Options, HSTS, Referrer-Policy, COOP, etc.) is safe.
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: false,
}));

// Heroku's router doesn't compress responses itself — gzip JSON API responses and the static
// JS/CSS bundle at the app level instead.
app.use(compression());

// Mostly GET-only public API; /api/auth/* and /api/users/me/* (server/routes/auth.js,
// server/routes/users.js) are the exception and use httpOnly cookies for session auth, the rest
// of the API stays cookie-free. This allowlist only stops browser JS on other sites from reading
// responses, it's not an access-control mechanism. `callback(null, false)` (not an Error) so a
// mismatched Origin just omits the ACAO header instead of erroring the request — server-to-server/
// curl callers are unaffected.
//
// Deliberately NOT `cors({ credentials: true })`: the app's own requests are same-origin in both
// dev (Vite proxies /api) and prod (single Heroku dyno serves client + API), so the browser sends
// the ktw_token cookie automatically without needing CORS credential opt-in. Adding it here would
// only matter for cross-origin callers, which this allowlist already isn't meant to authenticate.
const ALLOWED_ORIGINS = ['https://knowthew.net', 'https://www.knowthew.net'];
app.use(cors({
  origin(origin, callback) {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(null, false);
  },
}));
app.use(express.json());
app.use(cookieParser());

// Most of the API is public GET-only with no cookies/auth beyond a custom header; /api/auth/* and
// /api/users/me/* now read the ktw_token httpOnly cookie for session auth (see server/lib/auth.js).
// 100 req/min/IP is generous for a single page load (which fans out to several API calls) but
// stops scripted scraping/DoS. Not applied to sitemap.js (already 6h in-memory cached) or
// socialPreview.js (UA-gated to known bots).
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', apiLimiter, require('./routes/api'));
app.use(require('./routes/sitemap'));
app.use(require('./middleware/socialPreview'));

if (process.env.NODE_ENV === 'production') {
  // Vite content-hashes filenames under /assets on every build, so a cached copy under a given
  // URL is never stale — safe to cache for a year, immutable. Everything else (index.html,
  // favicon.svg, manifest.json, robots.txt, ...) is unhashed and must stay revalidate-on-request
  // so a deploy actually reaches returning visitors.
  app.use('/assets', express.static(path.join(__dirname, '../client/build/assets'), {
    maxAge: '1y',
    immutable: true,
  }));
  app.use(express.static(path.join(__dirname, '../client/build')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
  });
}

// Must come after all routes but before any other error-handling middleware (there isn't one here).
if (process.env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app);
}

// Listen only when run directly (`node server/index.js`), not when imported by tests.
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
