# SEO — indexing phase 1 + social preview (phase 2) + favicon (phase 3) + structured data (phase 4)

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

## Phase 2 — social preview meta for bots (`server/middleware/socialPreview.js`)

Why: Discord/Twitter/Facebook/Slack/etc. link-preview crawlers don't execute JavaScript, so they never see the per-route title/description/`og:image` that `pageMeta.js` sets client-side after React mounts — every shared link showed the static `index.html` defaults regardless of which player or team it was. Googlebot itself doesn't have this problem (it executes JS and had already indexed per-route titles correctly, confirmed via Search Console), so this is purely a social-share-card fix, not an indexing fix.

Considered instead of this: full SSR migration (React Router v7 framework mode) — rejected via `>>think` as disproportionate to the actual problem. It would touch routing/data-loading across every page and the build/deploy pipeline, right after the mobile-refresh pass, for a benefit (real SSR HTML) nothing today actually needs.

What shipped: a small Express middleware, mounted unconditionally in `server/index.js` right after `sitemap.js` and before the production static/catch-all block.
- Matches request `User-Agent` against a known-bot allowlist (`facebookexternalhit`, `Twitterbot`, `Slackbot`, `Discordbot`, `LinkedInBot`, `WhatsApp`, `TelegramBot`, `redditbot`, `SkypeUriPreview`, `Pinterest`). Non-matching UAs (real users, Googlebot) hit `next()` immediately — zero overhead, SPA untouched.
- Only intercepts `/player/:id(/:tab)?` and `/team/:slug(/:sub)?` — the only routes with real per-entity data. Everything else (home, legal pages, `/search`, `/compare/*`, `/similar/*`, 404s) falls through to `index.html`'s static defaults, which is fine since the excluded routes are already `noindex` and generic defaults are a reasonable fallback for the rest.
- Player lookup chain: `findActivePlayer` (in-memory, sync) → `getRetiredPlayer` (live ESPN fetch, TTL-cached) → `LEGACY_PLAYERS_BULK` (static 1997-2001 data). Team lookup: `getTeams()` active list → `LEGACY_DEFUNCT_TEAMS`.
- `og:image` is only emitted when a real photo/logo exists (active-player ESPN headshot, active-team ESPN logo). Legacy/defunct entries have no photo on file — the card renders as a `summary` (title+description, no image) rather than a fake generic image. No sitewide placeholder graphic exists or was worth adding for this.
- On any lookup miss or error, falls through to `next()` (never renders a broken/empty card, never 500s).
- Verified locally in `NODE_ENV=production` with spoofed bot UAs against: an active player (headshot present), an active team (logo present), a legacy defunct team, a legacy 1997-2001 player (no headshot), a non-matching route (`/compare/...`), and an unknown id — all behaved correctly. Full `npm test` (172/172) still passes; this file has no dedicated test (same precedent as `sitemap.js` — verified via manual curl, not an automated suite entry).

## Explicitly deferred (not this pass)

- **Retired (2002+) players in the MongoDB `playerIndex` collection** — used by `/api/search` for retired-player lookups but not enumerated into the sitemap. Unlike the 1997-2001 bulk legacy data (a static in-process object, free to iterate), this needs a live Mongo query and its actual population/size wasn't audited this session. User explicitly OK'd leaving these out until a provider switch, since the current ESPN-provider data for these players isn't considered complete anyway.
- **Full SSR / framework migration** — would remove the JS-execution dependency entirely (faster first paint, one render path for everyone) but nothing today requires it: Googlebot already renders the SPA fine, and phase 2 above solves the social-card gap without it. Revisit as its own `>>think` pass if a concrete need shows up (e.g. real performance complaints).
- **`og:image` for pages without a real photo/logo** (home, legal pages, legacy/defunct entries) — no generic placeholder graphic exists; those cards render as `summary` (title+description only, no image) rather than get a fake image.

## Phase 3 — favicon in search results

Why: Google's own favicon-in-search requirements (checked directly against `developers.google.com/search/docs/appearance/favicon-in-search` before making this change) say the favicon has to be an independently crawlable file URL — Googlebot-Image fetches it separately from the page. The site's favicon was a `data:image/svg+xml` URI inlined straight into `index.html`'s `<link rel="icon">` — not a real fetchable resource, so it wasn't eligible to show in search results regardless of indexing state.

What shipped: the same orange-square "K" mark, pulled out into a real static file (`client/public/favicon.svg`), referenced via a normal `<link rel="icon" type="image/svg+xml" href="/favicon.svg" />`. Verified locally in `NODE_ENV=production`: served with `Content-Type: image/svg+xml` and a stable ETag, not blocked by `robots.txt`.

As of this session, `site:knowthew.net` returns zero Google results — the site was verified in Search Console only days ago, and indexing takes time regardless of code correctness. The favicon and per-route descriptions are both in the right shape now; nothing further to do here except wait for Google to crawl.

## Phase 4 — per-page structured data (`client/src/lib/structuredData.js`)

Why: the only JSON-LD on the site was the static, site-wide `WebSite` block baked into `index.html` — every route reported the same generic block, so nothing about a specific player or team was ever eligible for a Google rich snippet.

Considered instead of this: extending `server/middleware/socialPreview.js` (phase 2) to also emit JSON-LD. Rejected — that middleware's bot allowlist deliberately excludes Googlebot (it executes JS and already gets the real SPA, same as any user), and link-preview crawlers don't read `schema.org` markup anyway (they read `og:*` tags). JSON-LD only has value on the path Googlebot actually executes, so it has to live client-side.

What shipped: `setStructuredData(obj)`/`clearStructuredData()`, following `pageMeta.js`'s existing imperative-DOM pattern — one dedicated `<script id="page-jsonld">`, overwritten per route rather than appended fresh, so SPA navigation never accumulates stale tags. Wired into the same `useEffect`s that already call `setPageMeta` in `PlayerRoutePage.jsx` (`Person` schema: name, url, image, jobTitle, affiliation, birthPlace — only fields the API actually returns; no fabricated birth date or jersey-number property, since schema.org has no real "jersey number" field) and `TeamPage.jsx` (`SportsTeam` schema: name, url, sport, memberOf, logo, location — identity fields only, not the season-derived display strings computed later in that component's effect chain).

Verified locally in `NODE_ENV=production` via Playwright: `#page-jsonld` renders the correct `Person`/`SportsTeam` object on a real player/team page, is absent on routes that don't set it (home), and doesn't duplicate across navigation. No console errors. Full suite (176/176, 4 new in `test/security-headers.test.js` — see `deployment-ops.md`) passes.

## Done

- **Google Search Console** — verification file (`client/public/googlede4ffe6ab6d8b4dd.html`) shipped and confirmed live; site verified; sitemap submitted via the dashboard. Per-URL indexing requests were offered and declined by the user (not necessary — sitemap submission alone gets pages crawled).
- **Bing Webmaster Tools** — site added via "Import from Google Search Console" (carries over GSC verification, no separate file/DNS/meta-tag step); sitemap registered under Sitemaps.
- **Favicon** — now a real crawlable `/favicon.svg` file per Google's requirements (see Phase 3 above).
- **Structured data** — per-page `Person`/`SportsTeam` JSON-LD on player and team pages (see Phase 4 above).
- **PWA icon set** — `client/public/manifest.json`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png` (all generated from `favicon.svg`), plus `<meta name="theme-color">`. Deliberately minimal (`"display": "browser"`, no service worker) — this is a stats-lookup site, not an installable app, so Chrome's installability criteria are intentionally never met regardless of manifest content. Fixes the prior gap where iOS/Android home-screen saves and browser manifest checks had nothing but the SVG favicon (unusable for `apple-touch-icon`, since iOS doesn't support SVG there).
