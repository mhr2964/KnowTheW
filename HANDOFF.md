# HANDOFF — KnowTheW

Forward-looking handoff for the active work-stream. **Overwrite** each session; history lives in git. Durable architecture/design rules live in `docs/design/` (see `docs/design/design.md`), not here — this file is transient work-stream state only.

```yaml
last-model: claude-sonnet-5
last-session: 2026-08-04 (server/routes/api.js God-Module refactor — split into teams/players/playerAnalysis/reports/meta + lib/ helpers, 500→502 error-code standardization — all pushed to origin/master, commit 5e3b533)
state: green — nothing pending; local master in sync with origin/master
```

## Next action

Nothing queued. The `server/routes/api.js` refactor (route split + `lib/` helper extraction + error-code standardization) is shipped, tested (180/180, lint clean), and pushed. A previously-unpushed Sentry monitoring commit (`bc76520`, from an earlier session) went out in the same push — worth a quick sanity check that Sentry is behaving as expected in production if anyone's watching that dashboard, though it's DSN-gated and was already verified locally.

## Traps

- `server/routes/api.js` is now a thin aggregator only (`router.use(...)` x5) — it has no route logic. If you're hunting for a specific endpoint, it's in one of: `teams.js` (teams/roster/season-info/stats/history/schedule), `players.js` (profile/detailed-stats/gamelog/splits/percentiles), `playerAnalysis.js` (onoff/pbp-stats/pbp-table/advanced-pbp-all/archetype/similar), `reports.js` (graded-report AND narrative — both AI-generated cached content, grouped together even though one is player-scoped and one is team-scoped), or `meta.js` (search/status).
- Shared route helpers live in `server/lib/`: `routeValidation.js` (numeric-id middleware), `teamLookup.js` (find-team-by-id), `seasonQuery.js`, `adminAuth.js`, `legacyRoster.js`, `analysis/archetypeAttach.js`, `deterministicHash.js` (sha1-over-JSON, used by both routes in `reports.js`), `playerSeasonData.js` (shared by `players.js` and `playerAnalysis.js`). Don't reintroduce a duplicate inline copy of any of these in a new route file — grep `server/lib/` first.
- `graded-report`'s and `narrative`'s caching *strategies* are deliberately NOT unified (hash-baked-into-`_id` vs fixed-`_id`-with-hash-field-comparison) — only the hashing and admin-refresh-gate helpers are shared. Don't try to force them onto the same cache-aside function without re-reading why they differ (session note 2026-08-04).
- The Compare-page breakpoints and `BrefTable.jsx` export-ref pattern are still do-not-touch zones — see `docs/design/mobile-refresh.md` for specifics, not repeated here.
- AdSense application submitted 2026-07-20 — still awaiting Google review as of last check.
- `server/routes/sitemap.js`'s `activePlayersReady` guard is load-bearing — don't simplify it away. See `docs/design/seo.md`.

## Do not touch

- Nothing mid-edit as of this handoff.

## Recent context

- 2026-08-04: `server/routes/api.js` (1127 lines, ~20 endpoints across 5 unrelated resources) identified as a God Module and split across three commits — `10f863b` (teams/players/meta split + `lib/` extraction), `cd0f7b1` (500→502 standardization + fixed 3 silent `catch{}` blocks), `5e3b533` (further split: `playerAnalysis.js` + `reports.js` pulled out of the still-565-line `players.js`). Full reasoning in session note 2026-08-04.
- Live at `https://knowthew.net`; production Heroku auto-deploys on every push to `origin/master` (GitHub integration, not visible in the repo's own CI config).
- Prior work-streams (mobile refresh, SEO phase 1, Search Console verification, Sentry monitoring) all shipped in earlier sessions — see `docs/design/mobile-refresh.md` and `docs/design/seo.md` for permanent details.
