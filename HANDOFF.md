# HANDOFF — KnowTheW

Forward-looking handoff for the active work-stream. **Overwrite** each session; history lives in git. Durable architecture/design rules live in `docs/design/` (see `docs/design/design.md`), not here — this file is transient work-stream state only.

```yaml
last-model: claude-sonnet-5
last-session: 2026-07-22 (mobile refresh + SEO phase 1 + Search Console verified + social-preview middleware — all pushed to origin/master, commit 8c00a78)
state: green — nothing pending; local master in sync with origin/master
```

## Next action

Nothing queued. Mobile refresh, SEO phase 1 (sitemap/robots/per-route meta), Google Search Console verification + sitemap submission, and the phase-2 bot-only social-preview middleware (`server/middleware/socialPreview.js` — real `og:image`/title/description for player and team pages when a known crawler UA hits, see `docs/design/seo.md`) are all shipped, committed, and pushed (`8c00a78`). This is a live Heroku auto-deploy — give it a few minutes to roll out before verifying in production (e.g. Facebook's Sharing Debugger or `curl -A "facebookexternalhit/1.1" https://knowthew.net/player/<id>`).

Open threads, if picked back up later: retired (2002+) players missing from the sitemap (needs a Mongo `playerIndex` audit — user is fine deferring until a provider switch, since that data isn't considered complete under ESPN anyway) and full SSR (explicitly not needed right now — see `docs/design/seo.md` "Explicitly deferred").

Mobile refresh — everything shipped:
- Rounds 0-5: Player page (the named weak spot) — foundation, header/footer, sticky-column desync, control-row wrap + touch targets, archetype-card portal fix, hero-name clamp + column-hiding.
- A general fix (unrelated to the round numbering): Export CSV moved out of its own standalone row into each tab's existing control row, closing a visible UI gap the user flagged directly.
- Round 6: Team Roster overflow fix + Similar Players name-truncation fix (Team Stats verified already fine).
- Round 7 (Compare page): skipped — full viewport sweep found no regression.
- Round 8 (Home/Search/legal/Team Dashboard/History/Schedule): spot-check sweep, all clean, no changes needed.

## Traps

- The Compare-page breakpoints at `compare.css:567-574`/`585-596` are still the do-not-touch zone (commits `fd68637`/`5d7cb68`) — confirmed unaffected by this refresh, but still don't touch without reading those commits first.
- `.bref-col-low-priority` (GS/ORB/DRB/PF hidden at ≤480px) is scoped to Per Game/Totals only via `BrefTable.jsx`'s `viewMode` gate — don't assume it also applies to Advanced/Game Log/Splits/PBP.
- `BrefTable.jsx` no longer renders its own Export CSV button — it exposes an `exportRef` callback instead. Any new BrefTable consumer needs to create its own ref, pass it in, and render its own button (see GameLogTab.jsx/SplitsTab.jsx for the `.gl-controls` pattern, DetailedStats.jsx/AdvancedTab.jsx for the `.stat-table-header` pattern).
- AdSense application submitted 2026-07-20, still awaiting Google review.
- `server/routes/sitemap.js`'s `activePlayersReady` guard is load-bearing — don't simplify it away. Confirmed locally that the ESPN roster prefetch takes 20-30s+ after boot; without the guard, a crawler hitting `/sitemap.xml` in that window locks an active-player-less sitemap into the 6h cache. See `docs/design/seo.md`.

## Do not touch

- Nothing mid-edit as of this handoff.

## Recent context

- Live at `https://knowthew.net`; local `master` is 10 commits ahead of `origin/master` (mobile refresh) plus SEO phase 1 uncommitted on top — pending the user's push decision.
- `docs/design/mobile-refresh.md` has the full breakpoint convention, do-not-touch zones, and closed-out round-by-round summary.
- `docs/design/seo.md` (new this session): `robots.txt` + dynamic `/sitemap.xml` + per-route meta, what's excluded (`/search`, `/compare/*`, `/similar/*` — noindex, thin/combinatorial content) and what's deferred (retired-player sitemap entries from Mongo `playerIndex`, prerendering/SSR for real social-preview cards — user said explicitly to revisit that "at a later date", Search Console verification/submission).
- Compare-page round 18 (chunked sections, grade-notch bars, bigger photos) shipped and is live as of the prior session — no open thread there right now.
