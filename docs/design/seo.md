# SEO — indexing phase 1

Why: the site (a client-side-only React SPA — no SSR/prerendering, per `routing.md` and `team-layer.md`) had zero SEO infrastructure — no `robots.txt`, no sitemap, no meta description, no per-route `<title>`. Nothing about the site was individually indexable beyond the homepage. This document records the scoped fix and, deliberately, what was left out.

## What shipped

- **`client/public/robots.txt`** — allows everything except `/search`, `/compare/*`, `/similar/*` (thin/combinatorial pages, see below); points at the sitemap. Served statically by Express in production (same mechanism as `ads.txt`).
- **`server/routes/sitemap.js`** — dynamic `/sitemap.xml`, mounted unconditionally in `server/index.js` (works in dev too, not gated behind `NODE_ENV`). Enumerates:
  - the 5 static pages (`/`, `/about`, `/data-sources`, `/privacy`, `/terms`)
  - active teams (`getProvider().getTeams()`) × 5 sub-paths (dashboard/roster/stats/history/schedule)
  - defunct franchises (`LEGACY_DEFUNCT_TEAMS`) × the same 5 sub-paths
  - active players (`getProvider().getActivePlayers()`) — sourced from the ESPN provider's in-memory roster prefetch, no extra network calls
  - 1997-2001 legacy players (`Object.keys(LEGACY_PLAYERS_BULK)`) — static in-process data, also free

  Cached in-memory for 6h (`SITEMAP_TTL_MS`, matching the ESPN client's own `TEAMS_TTL_MS` convention) — **but only once `getActivePlayers()` is non-empty**. The startup roster prefetch (`providers/espn/client.js`) takes tens of seconds after a dyno boot (every deploy restarts it); a naive TTL cache would lock in a sitemap missing every active-player URL for a full 6-hour window if a crawler happened to hit it during that startup gap. Confirmed this race locally before adding the `activePlayersReady` guard — don't remove it without re-testing the boot-window timing.

- **`client/index.html`** — static fallback `<meta name="description">`, Open Graph/Twitter tags, and a `WebSite` JSON-LD block. These are the site-wide values seen before React hydrates (or by a scraper that doesn't execute JS).
- **`client/src/lib/pageMeta.js`** — `setPageMeta(title, description, { noindex })` / `resetPageMeta()`. Deliberately **not** `react-helmet-async`: the app already had a hand-rolled `document.title = ...` + cleanup `useEffect` on `PlayerRoutePage`/`TeamPage`/`ComparePage`. This extends that exact pattern (description, canonical, robots) instead of introducing a new dependency/abstraction for the same job. Canonical `<link>` is set client-side per route (`window.location.origin + pathname`) because there's no server-rendered per-route HTML to carry a correct one — a static canonical in `index.html` would have wrongly pointed every page at `/`.
- Wired into every page component: `HomePage`, `TeamPage` (covers all 5 team sub-pages via `location.pathname`, one effect), `PlayerRoutePage`, `ComparePage`, `SimilarPlayersPage`, `SearchPage`, `NotFoundPage`, and the four legal pages.

## Deliberately excluded from indexing (`noindex, follow` + excluded from sitemap + `robots.txt` disallow)

- **`/search`** — query-driven, thin/duplicate content across near-identical queries.
- **`/compare/:idA/:idB`** — combinatorial (every player × every player); indexing all pairs would be a thin/near-duplicate-content pattern search engines penalize. Real per-pair content still gets a correct title/description for tab titles and social shares — just not indexed.
- **`/similar/:id`** — derived from a player already in the sitemap via `/player/:id`; not a distinct enough landing page.
- **`NotFoundPage`** — the Express catch-all always returns HTTP 200 (it serves `index.html` for literally any unmatched path, by design, since the SPA needs client-side routing to work). That makes every truly-missing URL a "soft 404" from Google's perspective. `noindex` on the client-rendered not-found state is the mitigation; a real 404 status code isn't achievable without breaking the SPA catch-all.

## Explicitly deferred (not this pass)

- **Retired (2002+) players in the MongoDB `playerIndex` collection** — used by `/api/search` for retired-player lookups but not enumerated into the sitemap. Unlike the 1997-2001 bulk legacy data (a static in-process object, free to iterate), this needs a live Mongo query and its actual population/size wasn't audited this session. Worth adding once confirmed populated in production.
- **Prerendering / SSR / dynamic-rendering-for-bots** — the real fix for social-preview cards (Discord/Twitter/Facebook scrapers don't execute JS, so they'll only ever see the static `index.html` OG tags, never a player-specific one) and for the most reliable search-engine rendering. Explicitly scoped out of this pass per user direction ("do the stuff from option 3 at a later date" — see the `>>think` block in the session this shipped from). Options considered: bot-user-agent-triggered prerender middleware (e.g. a headless-browser render cache) vs. full SSR framework migration. Both are real rearchitecture work with their own tradeoffs (Heroku free/hobby dyno resource cost for a render step, one-way framework-choice door) — don't attempt piecemeal; revisit as its own `>>think` pass when picked back up.
- **Google Search Console verification + sitemap submission** — dashboard-only, tied to the user's Google account, same pattern as AdSense (see `Brain/Memory/project_knowthew_adsense_account.md`). Not something this assistant can do directly; can add a verification `<meta>` tag or file to the codebase once the user has one from the dashboard.
- **`og:image`** — omitted; no real image asset exists to point it at. A generic placeholder wasn't worth adding for this pass.
