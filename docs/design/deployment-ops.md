# Deployment & operations

## Heroku auto-deploys from `origin/master` — this is invisible in the repo

Heroku's dashboard-side GitHub integration (Deploy tab → GitHub), not anything in `.github/workflows/ci.yml` (that workflow is lint/test only), redeploys on every push to `origin/master`. Confirmed: a plain `git push origin master` (no `git push heroku master`) produces a new Heroku release within ~2 minutes, matching the pushed commit hash exactly.

**A push to `origin/master` IS a production deploy.** Don't treat "push to origin" and "deploy to Heroku" as two separately-confirmable actions — they're the same action. There is no staging environment; anything pushed to master is live.

## Env vars baked in at build time, not read at runtime

Client-side config (`VITE_GA_MEASUREMENT_ID`, `VITE_AD_SLOT_TOP`, `VITE_AD_SLOT_FOOTER`, `VITE_AD_SLOT_SIDEBAR`) is read via `import.meta.env.VITE_*`, which Vite bakes into the built JS bundle at build time — not read from the environment at request time. `heroku-postbuild` runs `npm run build --prefix client`, and Heroku config vars are exposed during that build step. **This means the config var must be set on Heroku *before* the deploy that's supposed to use it** — setting a var after the fact requires a rebuild (an empty commit + push is the standard trick, since Heroku won't rebuild on a config-var change alone unless the app has `runtime-dyno-metadata` or similar configured).

## Domain

`knowthew.net` is the live/canonical domain (Heroku ACM for the cert, Cloudflare for DNS + redirect from any old domain). Confirm current DNS/cert config directly on Heroku's Domains tab and Cloudflare's dashboard before assuming anything here is still accurate — this doc records the mechanism, not a live status snapshot.

## Data provider risk posture

See `provider-architecture.md` for the ESPN-endpoint legal/ToS risk analysis — the short version is: facts and stat usage are legally fine, hitting ESPN's *undocumented* endpoint specifically is the actual risk, and the mitigation is attribution + honest framing rather than avoiding ESPN entirely (no budget for a paid alternative yet).

## Security headers and CORS

`server/index.js` runs `helmet()` (added this session) as the first middleware, with `contentSecurityPolicy`, `crossOriginEmbedderPolicy`, and `crossOriginResourcePolicy` explicitly disabled — the site loads Google AdSense, Google Analytics, and cross-origin ESPN CDN images (headshots/logos), none of which send CORP headers, and a correct CSP allowlist covering all three is a meaningfully bigger task than "add security headers." Everything else helmet sets by default (`X-Content-Type-Options`, `X-Frame-Options`, HSTS, Referrer-Policy, `X-DNS-Prefetch-Control`, COOP) ships with zero risk of breaking ads/analytics/images. Treat a real CSP allowlist as a deliberately separate, deferred task — don't add one piecemeal without accounting for all three third-party surfaces at once.

CORS (also `server/index.js`) was tightened from a bare `cors()` (reflected any `Origin`) to an explicit allowlist (`https://knowthew.net`, `https://www.knowthew.net`). Every route in `server/routes/api.js` is GET-only with no cookies/auth beyond a custom `x-admin-token` header, so this is purely a browser-JS-origin restriction — it does not stop server-to-server scraping or `curl` (CORS is enforced by the browser, not the server). A mismatched `Origin` gets `callback(null, false)` (response still 200, just no `Access-Control-Allow-Origin` header) rather than an error, so it can't be used to reject/500 a request. If a second production domain is ever added, extend `ALLOWED_ORIGINS` in `server/index.js`.

Covered by `test/security-headers.test.js`.

## Rate limiting, compression, and caching

`server/index.js` applies `express-rate-limit` (100 req/min/IP) to the `/api` mount only — `server/routes/api.js` is GET-only with no cookies/auth, so this is purely an abuse/scraping brake, not an access-control mechanism. Not applied to `sitemap.js` (already 6h in-memory cached) or `socialPreview.js` (UA-gated to known bots).

`compression()` is mounted right after `helmet()`, before routes — Heroku's router doesn't gzip responses itself, so this has to happen at the app level.

`express.static` for the production client build is split into two mounts: `/assets` (Vite's content-hashed JS/CSS output) gets `maxAge: '1y', immutable: true` since a cached copy under a given hashed URL is never stale; everything else (`index.html`, `favicon.svg`, `manifest.json`, `robots.txt`) keeps default (no long-lived cache) headers so a deploy actually reaches returning visitors.

## `npm audit` triage

As of this session, `npm audit` reports a moderate-severity chain (`body-parser` → `qs` → `express`) with no semver-compatible fix available (`npm audit fix`, even with `--force`, is a no-op — confirmed via dry run). Checked whether the underlying advisories are actually reachable through this app's code before deciding to leave it:

- **`qs.stringify` crash (GHSA-q8mj-m7cp-5q26)** — the app never calls `qs.stringify` directly, and neither does `express`/`body-parser`'s own usage of `qs` (they only call `qs.parse`, for incoming query strings/bodies). Not a reachable path here.
- **`body-parser` "invalid limit silently disables enforcement" (GHSA-v422-hmwv-36x6)** — requires the caller to pass a bad `limit` value to `body-parser`. `server/index.js` calls `express.json()` with no options, so `body-parser`'s own default (100kb) limit applies unaffected.
- **`brace-expansion` / `js-yaml` (dev-only, via `eslint`'s config parsing and `nodemon`'s file watching)** — never shipped to production, never parse network/attacker-controlled input.

Nothing here is being silently ignored — revisit when a compatible upstream release actually exists (not on a timer; there's no code change being deferred, just a package version that doesn't exist yet).

## MongoDB Atlas capacity

Free-tier cap is 512MB. A prior incident (`pbp-cache-refactor.md`) saturated it by caching raw ESPN summaries per-game instead of computed aggregates — every deploy's release phase failed trying to `bulkWrite` into a full database. If Atlas usage climbs again, check what's being cached raw vs. computed before reaching for a paid tier.
