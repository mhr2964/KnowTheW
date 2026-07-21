# DESIGN: Client-side routing for KnowTheW

## Problem
The SPA stays at `/` for every view, browser Back exits the app instead of navigating between pages, and there are no shareable URLs. We need bookmarkable, refreshable URLs for teams, players, and the active stat tab — minimum: `/team/:slug`, `/player/:id`, `/player/:id/:tab`.

## Options

### Option A — react-router-dom v6 with slug-and-id URLs
Pull in `react-router-dom` (~10kb gzipped, the de-facto React router). Routes:
- `/` — home
- `/team/:slug` — team page (slug → look up team in the already-loaded teams list to get the id for the roster fetch)
- `/player/:id` — player page, default tab
- `/player/:id/:tab` — player page with a specific stat tab active (perGame, gamelog, advanced, etc.)
- `/search?q=foo` — search results as a real route (URL is the source of truth for the query)

Back-button semantics: rely entirely on browser history. From `/player/X` Back goes to whatever route was previous (team page, search, or home). The bespoke `prevView` machinery is deleted. The "Back" button inside `PlayerPage` calls `navigate(-1)` instead of an `onBack` prop.

**Pros**
- Industry-standard API (`useParams`, `useNavigate`, `<Link>`, `<Outlet>`) — easy onboarding for any future contributor.
- Free history integration: Back/Forward, refresh, deep links, bookmarks all work.
- Search-as-route is trivial via `useSearchParams`.
- Nested-route support if/when more sub-pages appear under team or player.

**Cons**
- ~10kb gzipped bundle add (currently the app ships zero router code).
- Some boilerplate restructuring of `App.jsx` to a `<Routes>` tree.

**Cost** — ~half a day of work; low risk because the routing model lines up cleanly with existing view states.

---

### Option B — Wouter (tiny router, ~1.5kb)
Drop-in minimalist router with a hooks API similar to react-router. Same URL shape and Back semantics as Option A.

**Pros**
- ~6× smaller than react-router-dom.
- Hooks API (`useRoute`, `useLocation`) is even lighter than v6.
- No `<BrowserRouter>` ceremony.

**Cons**
- Smaller ecosystem. If we later need scroll restoration, route-level data loaders, or nested layouts, we hit limits or DIY them.
- Less familiar to contributors; the project gains a dep with a smaller community.
- Saves a few kilobytes that don't matter on a stats app already pulling team logos and ESPN payloads.

**Cost** — same dev time as Option A; small ongoing risk if router needs grow.

---

### Option C — Hand-rolled `popstate` + `pathname` parser, no library
Listen to `window.location` and `popstate`, parse the pathname manually, replace `view`/`selectedTeam`/`selectedPlayer` state with a derived `route` object, push history entries on navigation.

**Pros**
- Zero new dependencies. Fits the "minimalism" constraint literally.
- Full control over every transition.

**Cons**
- Re-implements work that's already a solved problem. Path-matching for `/player/:id/:tab` is easy; doing it well (trailing slashes, encoded chars, ignoring hash, search params) is fiddly.
- Every new route is hand-edited match logic.
- Easy to introduce subtle bugs (double history pushes, stale closures over `location`, missing `popstate` cleanup).
- No `<Link>` equivalent — every nav button has to remember to push history *and* update state.

**Cost** — same dev time as Option A but higher long-term maintenance and bug-surface tax.

## Recommendation
**Option A — react-router-dom v6.** The bundle delta is small, the API matches the navigation patterns already in App.jsx, and it removes the custom `prevView` state machine outright (browser history *is* the back stack). Wouter would also work, but the ecosystem familiarity of react-router is worth the 8kb on a desktop stats app, and the project doesn't currently optimize aggressively for bundle size. Option C violates the "don't reinvent solved problems" instinct that small codebases actually depend on.

URL-shape decisions baked into the recommendation:
- **Teams use slug**, not id. The `team` object already carries `slug` from ESPN; slugs are human-readable (`/team/las-vegas-aces` beats `/team/3`). On the team page, resolve slug → team object via the already-cached teams list, then use `team.id` for the roster fetch. No new server endpoint needed.
- **Players use id only**, not `/player/:id/:slug`. Player names aren't unique to the app's data model and there's no slug field server-side. Adding SEO-style slugs is out of scope; it would need a server change.
- **Stat tab in URL**: `/player/:id/:tab` where `:tab` is one of the existing `activeType` keys (`perGame`, `gamelog`, `advanced`, etc.). When `:tab` is missing, default to `perGame`. Unknown tab → fall back to `perGame` silently (do not 404).
- **Search as a route**: `/search?q=foo`. The query string is the source of truth; typing in the search bar calls `navigate(\`/search?q=...\`)`, and the search effect keys off `useSearchParams`. This makes search results bookmarkable and refreshable.
- **Active deck / StudyFlow stays ephemeral.** It's a modal launched from a button, with no use case for sharing a "currently studying" link. Keeping it in component state keeps the URL clean.
- **Back-button semantics**: rely on browser history. From `/player/X`, Back goes to whatever the user was on before — team, search, or home. `prevView` state is removed. The "Back" button on `PlayerPage` calls `navigate(-1)`.

## Implementation outline

**1. `client/package.json`** — add `react-router-dom` to dependencies. Run install.

**2. `client/src/main.jsx`** — wrap `<App />` in `<BrowserRouter>`.

**3. `client/src/App.jsx`** — split into a routing shell and per-route page components. The shell owns:
- The teams fetch (still needed everywhere — header search bar resolves slugs, home grid renders cards).
- The recent decks hook.
- The header (logo, search bar) — search submission calls `navigate(\`/search?q=...\`)` instead of mutating state.
- The active StudyFlow modal state.
- A `<Routes>` block with one `<Route>` per page below.

Drop entirely: `view`, `selectedTeam`, `roster`, `searchResults`, `selectedPlayer`, `prevView`, `searchInput`, all the abort refs that follow per-view fetches, `handleTeamClick`, `handlePlayerClick`, `handleSearch`, `goHome`, `goBack`. Their state moves into the page components below.

**4. New file `client/src/pages/HomePage.jsx`** — receives `teams`, `decks`, `onRestudy` from the shell (or via context if the shell prefers; props are simpler here). Renders RecentDecks, the team grid, and PremiumBanner. Each TeamCard becomes a `<Link to={\`/team/${team.slug}\`}>` (or an onClick that calls `useNavigate`).

**5. New file `client/src/pages/TeamPage.jsx`** — uses `useParams()` to read `slug`. Receives the cached teams list (props or context). Resolves slug → team object; if not found, shows "Team not found." Otherwise fetches `/api/teams/{team.id}/roster` in a `useEffect` keyed on `team.id` (with AbortController cleanup, copying the existing pattern). Renders the team header and `<RosterTable>`. Each row navigates to `/player/{playerId}` via the existing `onPlayerClick` prop, which now calls `useNavigate`.

**6. New file `client/src/pages/PlayerPage.jsx`** — wraps the existing `components/PlayerPage.jsx`. Reads `:id` and optional `:tab` from `useParams()`. Fetches `/api/players/{id}` keyed on id (with AbortController). Passes `:tab` down to `DetailedStats` as a new `initialTab` (or `tab`/`onTabChange`) prop. The "Back" button calls `navigate(-1)`.

   - **`components/PlayerPage.jsx`** — change `onBack` prop to no longer be required; either accept it optionally or remove and have the page-level wrapper render the back button. Cleanest: page-level wrapper passes `onBack={() => navigate(-1)}`.
   - **`components/DetailedStats.jsx`** — `activeType` initialization needs to take an `initialTab` prop and validate it against `ALL_TABLE_TYPES`. When the user clicks a tab, call a new `onTabChange(tabKey)` prop so the page can `navigate(\`/player/${id}/${tabKey}\`, { replace: true })`. Use `replace: true` so tab switches don't pollute history (Back from `gamelog` should not go to `perGame` of the same player — it should leave the player).

**7. New file `client/src/pages/SearchPage.jsx`** — uses `useSearchParams()` to read `q`. Fetches `/api/search?q=...` in a `useEffect` keyed on `q` (AbortController cleanup). Renders the existing teams + players result blocks. Result clicks navigate to `/team/:slug` or `/player/:id`. The header's `SearchBar` lifts into the shell and on submit calls `navigate(\`/search?q=${encoded}\`)`; the input's controlled value can either live in the shell or sync from `useSearchParams` on the search page.

**8. `server/index.js`** — already does `app.get('*', ...)` SPA fallback under `NODE_ENV=production`. Verify the fallback runs *after* the `/api` mount (it does). One subtle hazard: `app.get('*')` will also intercept unknown `/api/*` routes and serve the SPA HTML. If any deep link matches a path the API also serves (it doesn't currently — all API paths are under `/api`), it'd break. Recommend leaving the wildcard but adding an explicit "if path starts with `/api`, return 404 JSON instead of HTML" guard to make refresh of a typo'd API URL behave sanely. Strictly optional; not blocking.

**9. Lint and smoke test**:
   - `cd client && npm run lint`
   - `npm run build`
   - Manual: home → team → player → tab change → refresh (URL persists, page rehydrates) → Back (returns to team) → Back (returns to home).
   - Manual: paste `/player/4433404/gamelog` directly into address bar — page loads with gamelog tab active.
   - Manual: search "wilson" → URL becomes `/search?q=wilson`, results render, refresh keeps results.

## Risks and mitigations

- **Risk: shell needs the teams list to resolve `:slug` on TeamPage, but TeamPage may render before teams have loaded.** Mitigation: the shell fetches teams once on mount; while teams are loading, TeamPage shows the existing "Loading..." status. After load, slug resolution is synchronous.

- **Risk: tab in URL desync with `DetailedStats` internal state.** Mitigation: treat the URL as the source of truth. `DetailedStats` accepts `tab` as a prop and calls `onTabChange` on click; the page component owns the URL-update side. Avoid storing `activeType` in `DetailedStats` if it's now driven by URL — convert it to a derived value. (If retrofitting fully is too invasive, a smaller delta is to keep internal state but seed it from `initialTab` and call `onTabChange` in the existing click handler — accept the small redundancy.)

- **Risk: Back from a stat-tab change unwinds tabs one-by-one instead of leaving the player.** Mitigation: use `navigate(url, { replace: true })` for tab switches so they don't push history. Real navigations (team → player) use the default `push`.

- **Risk: search input in header competes with `useSearchParams` on `/search` route.** Mitigation: input is uncontrolled-ish — local state in the SearchBar, seeded from `useSearchParams().get('q')` only on the `/search` page (or always). On submit, navigate. Don't try to bind the input to URL on every keystroke.

- **Risk: production refresh on `/team/foo` 404s if SPA fallback misorders.** Mitigation: `server/index.js` already has the wildcard `app.get('*')` after the API mount; keep that order. Verified during this design pass.

- **Risk: SearchPage and TeamPage re-fetch on every navigation back to them.** Mitigation: acceptable for now (matches current behavior). If it becomes a problem, add a tiny in-memory cache keyed on slug/q in the shell — but explicitly out of scope for this change.

## Anti-features (explicitly NOT in scope)
- 404 page styling beyond a plain "not found" message.
- Redirects from old URLs (there are none — the app was always at `/`).
- Adding a `slug` field to player API responses or routes.
- Server-side rendering, route-level data loaders, or `loader`/`action` APIs from react-router v6.4 data mode.
- Scroll restoration on navigation.
- Caching previously-fetched roster/player/search responses.
- URL-encoding the active deck or StudyFlow state.
- Analytics/page-view tracking on route changes.
- Adding a state manager (Zustand, Redux, etc.) — props and `useSearchParams` are sufficient.

## Handoff

=== HANDOFF ===
did: produced routing design for KnowTheW SPA at C:\Users\Owner\Desktop\AI\Projects\knowthew\DESIGN-routing.md
found: react-router-dom v6 recommended; team URLs use slug (already on team object), player URLs id-only (no slug server-side), stat tab as path segment with replace-history on switch, search as ?q= route, browser history replaces custom prevView state; server SPA fallback already in place at server/index.js
files-touched: C:\Users\Owner\Desktop\AI\Projects\knowthew\DESIGN-routing.md
next-suggested-agent: builder
blockers: none
=== END HANDOFF ===
