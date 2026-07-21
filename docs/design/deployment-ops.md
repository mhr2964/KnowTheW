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

## MongoDB Atlas capacity

Free-tier cap is 512MB. A prior incident (`pbp-cache-refactor.md`) saturated it by caching raw ESPN summaries per-game instead of computed aggregates — every deploy's release phase failed trying to `bulkWrite` into a full database. If Atlas usage climbs again, check what's being cached raw vs. computed before reaching for a paid tier.
