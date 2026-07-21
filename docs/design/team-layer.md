# DESIGN: Team Layer for KnowTheW

## Problem

`/team/:slug` is a single-page roster grid today. The product calls for a four-page team layer — a hub dashboard with previews, a roster spoke, a stats spoke, and a history spoke that ends in an AI-generated franchise narrative. This design covers (1) the route and component split, (2) four new server endpoints, (3) the first LLM integration in this codebase, and (4) phased delivery so each piece ships independently.

Three open questions from the feature note are resolved here. Two ESPN-data blockers surfaced by scout — historical rosters returning empty `athletes[]`, coaching history HTTP 500 — are also resolved with explicit tradeoffs documented.

## Constraints grounded in the existing code

- `client/src/pages/TeamPage.jsx` is a 71-line single-view component. It owns the slug→team lookup, the `/api/teams/:id/roster` fetch (with `AbortController` cleanup), the back button, the team header, and the roster grid.
- `App.jsx` already passes the cached `teams` array and `teamsLoading` flag down as props. No team-layer state lives in the shell. The same prop pattern works for child pages.
- `react-router-dom` v6 is in use. The shipped routing design (`DESIGN-routing.md`) explicitly leaves nested routes open for "if/when more sub-pages appear under team" — that escape hatch is now needed.
- `server/lib/espnClient.js` already exports `fetchTeamStats(teamId, year)` (verified working historically) and `fetchTeamPtsAllowed(teamId, year)` which iterates the schedule. Neither is exposed as an HTTP route. The `withCache` wrapper is the established cache-aside pattern.
- `getTeams()` already enriches each team with `record`, `seedLabel`, `conference`, `location` from the standings join. The dashboard can read these directly off the team object without a new fetch.
- MongoDB is used, but optional. `db.js` exposes `getDb()` returning `null` when `MONGODB_URI` is unset, and the existing `advancedStats` collection is the reference for long-lived AI-style caches (`replaceOne` upsert, indexed by `_id`).
- KnowTheW has no LLM wiring today — no `@anthropic-ai/sdk`, no `ANTHROPIC_API_KEY`, no narrative routes. `Projects/rhymebook/server/workers/metadataWorker.js` is the canonical defensive-init pattern: warn-and-disable when key missing, `claude-haiku-4-5-20251001`, prompt caching via `cache_control: { type: 'ephemeral' }`.
- Scout-verified ESPN truth (do not re-test):
  - Standings work back to 2002 via `standings?season=YYYY` — wins, losses, seed, conference. **No champion field anywhere in ESPN.**
  - Playoff schedule via `schedule?season=YYYY&seasontype=3` includes round labels (Finals appears explicitly). Regular-season `seasontype=2` silently omits playoffs.
  - `roster?season=YYYY` returns empty `athletes[]` for all historical years. Historical rosters are **not retrievable** from ESPN.
  - `/coaches` returns HTTP 500 league-wide. Roster's embedded `coaches` field always returns the current coach regardless of the season parameter.

## Resolved open questions (with reasoning)

### Q1 — Championships: hardcode

ESPN has no champion marker, full stop. The three options scout floated:

- **(a) Hardcode `WNBA_CHAMPIONS`** — a small static map keyed by year → `{ team, finalsMVP? }`. WNBA has had ~28 champions; the list is short, semi-static, append-once-a-year. No round-trip cost. Source of truth is unambiguous (we control it).
- **(b) Parse `seasontype=3` Finals games** — read the playoff schedule, locate the round labelled "Finals", determine winner from final game score. Works in principle but compounds N requests, depends on ESPN's round-label string staying stable forever, and silently fails for any season ESPN ever drops or relabels. Hidden complexity for data we already know.
- **(c) Omit champions** — leaves a hole in the team-history page that fans will notice immediately for any franchise (Aces, Liberty, Lynx, Sparks, Mercury, Storm, Comets, Shock).

**Decision: (a).** Champion data lives in `server/constants/wnbaChampions.js` as a frozen object. Update once per October when the Finals end — it's an annual two-line PR. Code never trusts a derived champion. The history endpoint joins this constant with the season-by-season records and exposes a `champion: true` flag on the relevant year. The AI narrative prompt receives the same data so it doesn't have to recall championship years from training memory.

### Q2 — Stats page season selector: current season only for v1

The feature note flags this as TBD. The argument for a multi-season selector is weak in v1:

- All-time team-stat trend lines aren't a primary fan question. A new fan landing on Connecticut Sun wants "are they good *right now*?" — record + this season's pace and ratings. Career-long franchise feel lives on the **history** page, not the stats page.
- `fetchTeamStats(teamId, year)` already supports historical queries, so the eventual selector is one prop and one route param. No design decision is being foreclosed.
- Each season requires a separate ESPN call (no batched endpoint exists). A selector means UI thrash on every selection plus a per-year cache. Worth doing once we know fans want it.

**Decision: current season only.** The route accepts an optional `?season=YYYY` so the API contract is forward-compatible, but the v1 UI has no selector and always queries the current year. Document explicitly in the implementation outline that the next iteration is "add a season dropdown that re-runs the same fetch with a different year" — it is not a redesign, just a UI addition.

### Q3 — Dashboard hub card design

Three preview cards, one per spoke. Each card has a headline (the spoke name + contextual accent), 2-3 data points pulled from already-cached or already-fetched data, and a "View [Spoke] →" link.

**Roster card:**
- Headline: "Roster" + jersey count badge ("12 active players").
- Data points: top three by jersey number — headshot circle + last name + position. (Choosing "first three by jersey" instead of "top scorers" because no per-player season-stat aggregate is loaded at dashboard time, and we don't want a fetch waterfall just to populate a preview.)
- Link target: `/team/:slug/roster`.
- Source: existing `/api/teams/:id/roster` response, sliced to the first 3 entries.

**Stats card:**
- Headline: "Team Stats" + the season label ("2026").
- Data points: three single-line metrics — points per game, opponent points per game, three-point makes per game. These come straight off `fetchTeamStats` (`ptsPg`, derived `oppPpg` via `fetchTeamPtsAllowed`, `fg3mPg`). Choosing those three because they're concrete, mid-watch-relevant numbers a fan can read in two seconds, and all three are already computed by existing util functions.
- Link target: `/team/:slug/stats`.

**History card:**
- Headline: "Franchise History" + year-founded badge ("Est. 1999" — comes from championships constant or a separate `WNBA_FOUNDED` map; for v1 hardcode alongside champions).
- Data points: championship count ("3 titles"), most recent playoff appearance ("2024 — Lost in Finals"), seasons in operation ("26 seasons"). All three derive from `/api/teams/:id/history` (defined below) once that endpoint exists. Until then the card shows placeholder copy and a "Read franchise narrative →" link target — Phase 4 or a leading Phase 3.
- Link target: `/team/:slug/history`.

The hub also keeps the current header (logo, name, record/seed/conference/location meta line). Cards stack in a grid: 3-column desktop, 1-column mobile, matching the existing `team-grid` flow style.

### Q4 — Historical roster gap (scout blocker)

ESPN returns empty `athletes[]` for every past-season roster query. The history page has two honest options for "notable players per era":

- **Omit the section entirely.** Cleanest data integrity. Fans expecting to see "Tina Charles era" on the Liberty page won't find it.
- **Source it from Claude's training knowledge as part of the AI narrative.** Claude has working knowledge of WNBA stars and franchise eras. We treat the era summary as commentary, not a record — same way a beat-writer column would name "the Lauren Jackson years" without citing a database.

**Decision: keep the era section, source it from Claude, label the surface honestly.** The AI narrative is the only piece of the team-history page where Claude is the source of truth for who appears. Everywhere else (records, championships, playoff round results) the data comes from structured sources. Mark the rendered section with a small `(AI summary)` label so fans understand the provenance shift, and never display individual Claude-generated player stats — only narrative naming. The narrative prompt explicitly instructs Claude not to fabricate numbers; era descriptions name players and broad qualitative roles only.

This is the explicit tradeoff: AI-as-source-of-truth-for-narrative is acceptable; AI-as-source-of-truth-for-stats is the anti-pattern we forbid. See Anti-pattern check below.

### Q5 — Coaching history gap (scout blocker)

`/coaches` returns 500 league-wide. The roster's embedded `coaches` field returns the *current* coach regardless of season — actively misleading for historical use. There is no path through ESPN to get a real coaching timeline.

**Decision: do not display structured coaching history. Allow Claude to mention coaches in the narrative when relevant (e.g. "Bill Laimbeer's Liberty"), with the same provenance label as the era section.** Do not surface a "Head Coaches" sub-section on the history page. The coaches that appear in the AI narrative are commentary, not a roster.

If ESPN ever exposes a working coaches endpoint, add a structured "Head Coaches" section as an additive change — the design doesn't depend on the absence and won't fight the addition.

### Q6 — Schedule pagination uncertainty (build-phase verification)

Scout couldn't fully verify whether `schedule?season=YYYY` returns the entire 40-game regular season in a single response (WebFetch truncated the JSON). `fetchTeamPtsAllowed` already iterates `data.events` and the resulting averages look right, which is circumstantial evidence that the response is complete — but it's not proof. **Builder must verify on first implementation pass:** log `data.events.length` for a current-season team and confirm it equals the expected regular-season game count (40 for full WNBA seasons; less for shortened seasons like 2020). If pagination exists, `fetchTeamPtsAllowed` and the new `/schedule` route have a hidden bug. Mitigation if discovered: walk page links with `Promise.all` until `pagingDone`, or use the existing season-summary aggregator if ESPN exposes one. Logged as a Phase 2 check in the implementation outline.

## Architectural decisions

### Page split — confirmed (Outlet shell + 4 child pages)

The scout's proposal is the right call. The team-header is identical across all four spokes (logo, name, record/seed/conference/location meta line, back button), and the navigation between spokes should not unmount the header — that would re-flicker the team color stripe and re-trigger the no-op meta build every navigation. Pulling the header into a layout shell with `<Outlet>` is the cleanest match for react-router v6 nested routes.

```
/team/:slug                     → TeamPage (layout shell: header + nav tabs + <Outlet>)
  /                             → TeamDashboard          (default index route)
  /roster                       → TeamRosterPage         (current grid moves here)
  /stats                        → TeamStatsPage          (new)
  /history                      → TeamHistoryPage        (new)
```

**Where the team-level fetch lives.** The roster fetch moves out of the shell. The shell keeps only what is shared across all four children: the slug→team lookup, the team header, and the spoke-nav tabs. Each child page fetches its own data — there is no waterfall benefit to pre-fetching everything in the shell, and pre-fetching couples unrelated concerns (the dashboard doesn't need the full advanced-stats payload, the stats page doesn't need the AI narrative).

**How children get the team object.** `<Outlet context={{ team, onSaveDeck }} />` passes the resolved team object down. Children read it via `useOutletContext()`. This avoids prop-drilling through the route tree and avoids a context provider — `useOutletContext` is built for exactly this case in v6. `team` includes the standings-enriched fields (`record`, `seedLabel`, `conference`, `location`) plus `id`, `name`, `slug`, `logo`, `color`, etc. Children that need additional data fetch their own endpoints keyed off `team.id`.

**Spoke-nav tabs.** Below the team header, render four `<NavLink>` elements: Dashboard, Roster, Stats, History. NavLink's `isActive` styling marks the current spoke. Clicking a tab pushes a normal history entry — Back returns to the previous spoke. (This is opposite to the player tabs which use `replace: true`; the team spokes are full pages, not in-page tab swaps, and back-to-roster from history is genuinely useful.)

**Slug rewrite caveat.** Today `useEffect` in `TeamPage` keys on `team.id` for the roster fetch. After the split, this lives in `TeamRosterPage` and `TeamStatsPage`. Each child uses its own AbortController (the existing pattern). The shell does not own any AbortController.

### API additions

Four new routes. Response shapes below.

**`GET /api/teams/:id/stats?season=YYYY`** — exposes the existing `fetchTeamStats`. `season` is optional and defaults to the current WNBA year (compute server-side: `new Date().getFullYear()` — the WNBA season runs roughly May–October, so this is correct except for the November–April off-season window when "current" arguably means previous year. Resolved by always returning the most recent fetched season; if `fetchTeamStats(id, currentYear)` returns null, fall back to the previous year).

Response:

```json
{
  "season": 2026,
  "stats": {
    "fgaPg": 75.4, "fgmPg": 31.2, "fg3mPg": 8.1,
    "ftaPg": 18.2, "ftmPg": 14.0, "ptsPg": 84.5,
    "orbPg": 9.4, "drbPg": 26.1, "tovPg": 13.5, "astPg": 19.8,
    "oppPpg": 79.2
  }
}
```

`oppPpg` is computed via the existing `fetchTeamPtsAllowed` and merged into the same response so the client makes one round-trip. If either upstream fetch returns null, that field is omitted (do not return null fields — the client checks for presence).

**`GET /api/teams/:id/schedule?season=YYYY&seasontype=2|3`** — thin pass-through over `${ESPN}/teams/:id/schedule?season=YYYY&seasontype=N`. Normalizes events into `{ id, date, opponent: { id, abbreviation, logo }, atVs, result, teamScore, oppScore, roundLabel? }`. `roundLabel` is populated only when `seasontype=3` and ESPN provides it ("Finals", "Semifinals", etc.). `seasontype` defaults to 2.

This route is consumed by `TeamHistoryPage` (Phase 3) when it walks back through past seasons reconstructing playoff results. The stats page does not consume it in v1 — the dashboard's "next game" preview is out of scope (anti-feature list).

**`GET /api/teams/:id/history`** — the aggregator. Server walks back from the current season to 2002 (ESPN's standings cutoff) calling `standings?season=YYYY` for each year, joining with `WNBA_CHAMPIONS` and a per-year playoff-schedule fetch (only for years where the team made the playoffs — guard via `playoffSeed != null`).

Response:

```json
{
  "teamId": "9",
  "founded": 1997,
  "championships": [2008, 2024],
  "seasons": [
    {
      "year": 2026,
      "wins": 11, "losses": 17,
      "conference": "Eastern Conference",
      "seed": 5,
      "playoffResult": null,
      "champion": false
    },
    {
      "year": 2024,
      "wins": 27, "losses": 13,
      "conference": "Eastern Conference",
      "seed": 1,
      "playoffResult": "Won Finals",
      "champion": true
    }
  ]
}
```

`playoffResult` is one of: `null` (didn't make playoffs or year unavailable), `"Lost First Round"`, `"Lost Semifinals"`, `"Lost Finals"`, `"Won Finals"`. Derived from the `seasontype=3` schedule of the relevant year — find the team's last playoff game, look at its `roundLabel` and `result`. If the team appears in a "Finals" round and won the last Finals game, mark `champion: true` (cross-checked against `WNBA_CHAMPIONS` — they should agree; if they don't, trust the constant and log a warning so we can investigate).

Cache aggressively: a season's record never changes after the season ends. Cache the whole `/history` response in MongoDB keyed by `teamId`, with a `lastSeasonYear` field. On request, check if the current year's record has changed (re-fetch only the current year's standings, splice into cached `seasons`). This avoids walking 25 years of standings on every page view.

**`GET /api/teams/:id/narrative`** — the AI route. See AI integration section.

### AI integration

This is the first LLM in the project. The pattern is copied wholesale from Rhymebook with the differences below.

**Module location.** New file `server/lib/narrativeClient.js`. Exports `getNarrative(teamId)`. Uses defensive init: at module load, check `process.env.ANTHROPIC_API_KEY`, log warning if missing, set an internal `enabled = false` flag that the route checks before calling. Route returns `503 { error: 'narrative service unavailable' }` when disabled — the rest of the team-history page renders normally without it.

**Why a `lib` module not a `worker`.** Rhymebook's `metadataWorker` is a poller because lines arrive continuously. KnowTheW's narratives are request-driven and cached long-term — there's no queue. A simple `getNarrative(teamId)` function called from the route handler is enough.

**Anthropic SDK.** Add `@anthropic-ai/sdk` to root `package.json` dependencies. Model: `claude-haiku-4-5-20251001` (matches Rhymebook — the only justification for changing is if the narrative quality test rejects haiku output, in which case bump to sonnet and document the cost shift).

**Prompt structure (what Claude receives).** The route handler assembles a structured payload by calling `/api/teams/:id/history` internally, then sends:

- A system prompt establishing role: "You write franchise histories for WNBA teams. You receive structured data (records, championships, playoff results) and you may name players and coaches from your training knowledge. You must not invent statistics. When you mention a player or coach, do so as commentary, not as a quoted stat. Output structured JSON matching the provided schema." Caches via `cache_control: { type: 'ephemeral' }` since the system prompt is identical across all teams.
- A user message containing: team name, founded year, full `seasons[]` array, championships list, and a one-sentence dashboard meta ("Currently 11-17, 5th in Eastern Conference").
- A tool definition `franchise_narrative` forcing structured output.

Tool input schema (sketch — builder writes the JSON Schema, this is the shape):

```
{
  summary: string,        // 2-3 sentence franchise overview
  eras: [
    {
      label: string,      // e.g. "The Lauren Jackson Era (2003-2012)"
      yearStart: int,
      yearEnd: int,
      record: string,     // optional roll-up like "8 playoff appearances, 2 titles"
      narrative: string,  // 4-6 sentence prose
      keyPlayers: [string]  // names only, no stats
    }
  ],
  identity: string        // 2-3 sentence "what this franchise is" — culture, style
}
```

The route returns this object plus a `generatedAt` timestamp.

**Caching.** MongoDB collection `teamNarratives`, document `{ _id: teamId, data, generatedAt, sourceHash }`. `sourceHash` is a SHA-1 of the input payload (sorted JSON of the seasons + championships array). On request:
1. Look up by `_id`.
2. If `sourceHash` matches the current input payload's hash, return cached data immediately.
3. Otherwise call Claude, store, return.

This means a narrative regenerates *only* when the underlying structured data changes — i.e. once per year when the current season's record finalizes, or whenever the championships constant is bumped. No TTL is needed; the hash *is* the freshness check. This is pure cache-aside with content-addressing.

**Manual regeneration trigger.** A `?refresh=1` query param on the narrative route. When present *and* `req.headers['x-admin-token']` matches `process.env.ADMIN_TOKEN` (env-only, no DB role system in this app), force regeneration regardless of hash match. Without the admin token the param is ignored — never let anonymous traffic flush the AI cache. If `ADMIN_TOKEN` is unset, the manual trigger is unavailable (defensive default).

**Cost discipline.**
- One narrative per team per source-data change. With 12 teams and source data changing once a year, that's ~12 Claude calls per year. Trivial.
- Narratives are not generated on team-page load if MongoDB is unavailable (`getDb()` returns null) — fall back to a static "AI franchise summary unavailable" placeholder rather than calling Claude on every request. This protects against accidental no-cache loops if the DB layer breaks.
- Token budget: cap `max_tokens` at 2048 in the SDK call. Haiku output for a structured JSON of this size sits well under that.
- Response time budget: do not block the page on narrative load. The history page renders structured sections immediately and lazy-loads the AI section with its own loading state — same pattern as the player advanced-stats lazy fetch (`useLazyFetch.js`).

## SWEN framing

### Variability points

- **Champion list grows by one row per year.** Hardcoded constant; trivial to extend. Designed as a flat year→object map so adding `finalsMVP`, `losingFinalist`, or `seriesScore` later is additive.
- **Stats season selector arrives in v2.** API already takes `?season=YYYY`, just unused by v1 UI. The selector is a pure UI add — no server change, no new endpoint, no cache redesign.
- **Coaches endpoint may someday work.** History endpoint is structured to accept an additional `coaches: []` array with no breaking changes; the AI prompt's coach commentary can degrade gracefully into a structured list if real data appears.
- **Narrative model upgrade (Haiku → Sonnet).** Single string change in `narrativeClient.js`. Cost discipline rules don't change. Cache invalidates naturally because regenerations are gated on source-hash, not model — to force regen across all teams after a model upgrade, bump a `MODEL_VERSION` constant included in the source-hash input.
- **Adding a fifth spoke** (e.g. `/team/:slug/schedule` for an upcoming-games view). Trivial — add one `<Route>` in the shell, one `<NavLink>`, one page component. No refactor needed because the shell is already an Outlet.

### Named patterns at play

- **Layout shell + Outlet.** Standard react-router v6 nested-routes idiom. Solves the "shared header across sub-pages" problem without context providers or prop drilling.
- **Defensive init.** Copy from Rhymebook. Service module initializes at module load, sets a private enabled flag; route handlers check the flag and return graceful errors rather than 500-ing.
- **Cache-aside (with content-addressed invalidation).** Narrative cache uses source-hash for freshness, not TTL. History cache uses TTL only for the current season's mutable record.
- **Lazy-load on a stable surface.** History page renders structured sections synchronously and lazy-loads the AI narrative the same way the player page lazy-loads advanced stats.
- **Per-page fetch with AbortController cleanup.** Established codebase pattern; each spoke owns its own fetch lifecycle.

### Anti-pattern check

What we're explicitly avoiding:

- **AI as source of truth for stats.** Claude can name "Sue Bird's Storm" but never says "Sue Bird averaged 12.1 assists." Numbers come from ESPN or computed from PBP. The narrative prompt forbids inventing stats; the response schema doesn't even have a numeric field to put a fabrication in.
- **Fetch waterfalls in nested routes.** The shell does not pre-fetch the union of all child needs. Each spoke fetches what it uses. Shared data (the team object) comes from `<Outlet context>`, which is in-memory.
- **Using `view` state to switch sub-pages.** Old App.jsx had a `view` state machine. We don't reintroduce it inside `TeamPage` — the URL is the source of truth, NavLink and Outlet handle the rest.
- **Caching every request indefinitely.** History's current-season record is mutable; we don't permanently cache it. Champions list is part of the source-hash so a constant bump invalidates narratives correctly.
- **Calling Claude on every page view.** The route is gated by sourceHash equality; cold cache only happens on data change or manual refresh.
- **Letting the dashboard pre-fetch everything for the previews.** The roster card uses the roster fetch's first 3 entries — but only because that fetch is cheap and already wired. The history card does *not* trigger the AI narrative; it uses only the structured `/api/teams/:id/history` payload.

## Build phasing

Four phases. Each phase is independently shippable, lint-clean, and testable end-to-end before the next starts.

### Phase 1 — Page split + dashboard + roster (no new endpoints)

- Convert `TeamPage.jsx` into the layout shell. Move the existing roster grid and fetch into `TeamRosterPage.jsx`. Add a placeholder `TeamDashboard.jsx` that renders the three preview cards using only data already in `team` and roster.
- Add the spoke-nav tab strip and `<Outlet context={{ team, onSaveDeck }} />`.
- Update `App.jsx` route table to nest the four child routes under `/team/:slug`. Default index route → `TeamDashboard`.
- The dashboard's stats card and history card show "Coming soon" sub-copy; Phases 2 and 3 wire them. The roster card is fully functional.
- Smoke test: `/team/connecticut-sun` → dashboard. Click "Roster →" → roster grid (current behavior). Direct URL `/team/connecticut-sun/roster` → same. Back button returns to `/`.

**Why first:** zero new endpoints, zero new dependencies, refactor-only. Validates the Outlet pattern, the NavLink styling, and the dashboard card grid. Ships visible value (the dashboard) without external risk.

### Phase 2 — Stats page + `/api/teams/:id/stats` route

- New route in `server/routes/api.js` calling `fetchTeamStats` and `fetchTeamPtsAllowed` in parallel. Default season = current year.
- New `TeamStatsPage.jsx` reading the team object from `useOutletContext`, fetching `/api/teams/:id/stats`, rendering pace, ppg, oppPpg, three-point makes, etc. as a simple metric grid (not a table — the metrics aren't comparable rows).
- Wire the dashboard's stats card to the same fetch (pass cached data through context, or accept the dashboard does its own one-shot fetch — recommend the latter, simpler).
- **Build-phase verification (Q6):** log `data.events.length` from the schedule fetch on a current-season team and confirm full season is returned. If pagination exists, walk pages.

**Why second:** smallest endpoint surface, no caching strategy beyond the existing `withCache`, no AI. Tests the "child page fetches its own data via context-provided team object" pattern that Phases 3 and 4 reuse.

### Phase 3 — History page + `/api/teams/:id/history` route (no AI)

- New constant file `server/constants/wnbaChampions.js` and `server/constants/wnbaFounded.js`. Export frozen objects.
- New `/api/teams/:id/history` route. Walks standings 2002→current, joins champions, fetches playoff schedules for each year the team appeared in playoffs.
- MongoDB caching for `/history`: collection `teamHistories`, refresh strategy as described above (only current year's record is mutable).
- New `/api/teams/:id/schedule` route as a dependency of the playoff-result derivation. (Builder may inline the schedule fetch into the history route helper instead of exposing it as a public API; the public route is only required if some other client surface needs it. Recommend keep it public for symmetry — schedule is a natural endpoint and it's cheap to expose.)
- New `TeamHistoryPage.jsx`: renders the seasons list, championships banner, and a placeholder card where the AI narrative will land in Phase 4.
- Dashboard history card now reads from `/history` for the championship count, founded year, and most-recent playoff result.

**Why third:** still no AI dependency. The history page is fully usable with structured data alone. If Phase 4 slips, fans still get a season-by-season records page — that alone is a meaningful addition.

### Phase 4 — AI franchise narrative

- Add `@anthropic-ai/sdk` dependency. Add `ANTHROPIC_API_KEY` and `ADMIN_TOKEN` to env. Document both in `.env.example` (or whatever the local convention is — check at build time).
- New `server/lib/narrativeClient.js` with defensive init.
- New route `GET /api/teams/:id/narrative`. Source-hashed cache via MongoDB collection `teamNarratives`.
- `TeamHistoryPage` lazy-fetches the narrative below the structured sections. Loading state, error state, "AI summary" provenance label on rendered eras.
- Manual regeneration via `?refresh=1` + `x-admin-token` header.

**Why last:** introduces the only new external dependency in the entire feature, the only network risk that's outside ESPN, and the only cost-bearing call. Isolating it as the final phase means a key-leak, rate-limit incident, or cost surprise can't take down the rest of the team layer.

## File-by-file implementation outline (consolidated)

For the builder. Order matches the phases above.

### Phase 1

**`client/src/pages/TeamPage.jsx`** (refactor in place). Strip out the roster fetch and the roster grid. Resolve the team from slug as today. Render: back button, team header (logo + name + meta), spoke-nav `<NavLink>` strip, `<Outlet context={{ team, onSaveDeck }} />`. Loading and not-found states stay here (children should never run if team isn't resolved).

**`client/src/pages/TeamDashboard.jsx`** (new). `useOutletContext()` to get `team`. Fetch `/api/teams/:id/roster` for the roster preview's first 3 entries (or read from a shared cache if the shell exposes one — recommend independent fetch, parallel safe). Render three cards. Stats and history cards show placeholder copy until Phases 2 and 3.

**`client/src/pages/TeamRosterPage.jsx`** (new). The roster fetch and `<RosterTable>` rendering moves here verbatim from the old `TeamPage`. Reads `team` and `onSaveDeck` from `useOutletContext()`.

**`client/src/App.jsx`**. Replace the single `<Route path="/team/:slug" element={<TeamPage ... />} />` with a parent `<Route path="/team/:slug" element={<TeamPage teams={teams} teamsLoading={teamsLoading} />}>` containing four child routes — `index` for the dashboard, plus `roster`, `stats`, `history` paths. `onSaveDeck` flows in via Outlet context, not props.

**`client/src/App.css`**. Add styles for `.team-spoke-nav`, `.team-spoke-nav a`, `.team-spoke-nav a.active`, `.team-dashboard-grid`, `.team-dashboard-card`, `.team-dashboard-card-headline`. Match the existing dark-with-orange-accent palette; active NavLink uses `--accent`.

### Phase 2

**`server/routes/api.js`**. Add `GET /teams/:id/stats`. Pulls team via `getTeams()`, returns 404 if not found, runs `fetchTeamStats` and `fetchTeamPtsAllowed` in parallel, merges, returns `{ season, stats }`. Default season = current year, with off-season fallback to previous year.

**`client/src/pages/TeamStatsPage.jsx`** (new). `useOutletContext` for team. Fetch `/api/teams/:id/stats` keyed on `team.id`. Render a metric grid (no table) — pace, ppg, oppPpg, fg3mPg, etc. with stat-key labels and the season as a subheader. AbortController cleanup. Loading and error states match existing app conventions.

**`client/src/pages/TeamDashboard.jsx`** (edit). Wire the stats card to the same `/api/teams/:id/stats` fetch (or share via Outlet context if you decide to lift the fetch to the shell — but for v1 keep it independent, smaller blast radius).

### Phase 3

**`server/constants/wnbaChampions.js`** (new). Frozen object: `{ 1997: { team: 'Houston Comets' }, 1998: ..., ... }`. Use franchise display names matching `team.name` from ESPN to make joins straightforward.

**`server/constants/wnbaFounded.js`** (new). Frozen object: `{ '9': 1999, '18': 1999, ... }` — keyed by ESPN team id. Eight original franchises plus expansion teams.

**`server/lib/espnClient.js`** (edit). Add `fetchSchedule(teamId, season, seasontype)` — generalized version of the iteration in `fetchTeamPtsAllowed`. Returns the normalized event array. `fetchTeamPtsAllowed` may be refactored to consume this internally (optional cleanup).

**`server/lib/historyAggregator.js`** (new). Pure module that walks 2002→current for a given team id, joins standings + champions + playoff round-result. Returns the `/history` response shape. Caches via MongoDB if `getDb()` is non-null; otherwise re-aggregates per request (acceptable for dev without a DB).

**`server/routes/api.js`**. Add `GET /teams/:id/history` and `GET /teams/:id/schedule?season=YYYY&seasontype=2|3`.

**`client/src/pages/TeamHistoryPage.jsx`** (new). Fetches `/api/teams/:id/history`. Renders a championships banner if any, then a season-by-season list (year, record, conference, seed, playoff result, champion badge). Below the list, a placeholder for the AI narrative ("AI franchise summary loading…" → render or hide based on Phase 4 readiness).

**`client/src/pages/TeamDashboard.jsx`** (edit). Wire the history card to `/api/teams/:id/history` for championship count, founded year, most recent playoff appearance.

### Phase 4

**`package.json`** (root). Add `@anthropic-ai/sdk` to dependencies. Pin to a specific version.

**`.env.example`** (or local equivalent). Add `ANTHROPIC_API_KEY=` and `ADMIN_TOKEN=`. Document that both are optional and that absence degrades the narrative endpoint to 503 / disables manual refresh respectively.

**`server/lib/narrativeClient.js`** (new). Defensive init copying the Rhymebook pattern. Exports `getNarrative({ team, history, force })`. Builds the prompt, calls Claude, returns the structured result. Throws on Claude error so the route handler can return 502.

**`server/routes/api.js`**. Add `GET /teams/:id/narrative`. Calls the history aggregator first (reuse the cached result), hashes the input, looks up the cached narrative, calls `narrativeClient.getNarrative` only on miss or `?refresh=1` + admin token.

**`client/src/pages/TeamHistoryPage.jsx`** (edit). Lazy-fetch `/api/teams/:id/narrative`. Render the summary, eras (each labelled with `(AI summary)`), and identity sections. Loading state inline; error state collapses the section without breaking the page.

## Risks and mitigations

| Risk | Where it lives | Mitigation |
| --- | --- | --- |
| ESPN schedule pagination silently truncates the regular season, breaking record/playoff-result derivation | `fetchSchedule` in `espnClient.js` | Phase 2 verification step logs `events.length` against expected game count. If truncation is real, walk pages explicitly. |
| `wnbaChampions.js` not updated in October when a season ends — narrative is silently stale | constants file | Document the refresh as part of an end-of-season runbook task. The source-hash invalidation guarantees that bumping the file regenerates all narratives automatically — no client-side cache-bust needed. |
| Standings endpoint shape changes (children → groups, stat names rename) | `fetchStandings` in `espnClient.js` | Already defensively parsed (optional chaining throughout); a missing field omits the corresponding flag rather than crashing. History route propagates `null` for unknown years. |
| AI narrative drifts in tone or length over time | `narrativeClient.js` system prompt | Schema-locked output via tool use forces structure; tone is governed by the system prompt which is version-controlled. If the result stops feeling right, edit the prompt and bump `MODEL_VERSION` to invalidate the entire cache. |
| Anthropic rate-limit or outage takes down team-history page | `/api/teams/:id/narrative` route | The narrative section is lazy-loaded and isolated. Loading failure collapses to a small error notice; structured history above remains. The defensive-init pattern means a missing API key never throws — the route returns 503 and the client treats 503 as "narrative unavailable." |
| `?refresh=1` becomes a denial-of-service vector | route handler | Gated behind `ADMIN_TOKEN` env match; param is silently ignored without it. If `ADMIN_TOKEN` is unset, manual refresh is unavailable — fail-closed default. |
| Anonymous users invalidating MongoDB cache | `teamNarratives` collection writes | Same as above — cache writes only happen on cache miss against a hash, or on admin-token refresh. There is no public path that re-runs Claude on demand. |
| `useOutletContext()` returns `undefined` if a child renders before the shell resolves the team | shell rendering order | Shell guards: returns a status message and *does not render `<Outlet>`* until `team` is resolved (or the team-not-found state). Children can therefore safely assume `team` is non-null. |
| Champion constant and ESPN-derived champion flag disagree (data error) | `historyAggregator.js` | Trust the constant. Log a warning on mismatch. The constant is the audit-trail source of truth; ESPN's playoff-result string is parsed by us and may have edge cases. |
| Adding the SDK silently grows the deploy bundle on the server | `package.json` | Anthropic SDK is server-side only — not bundled into the client. Verify by inspecting `client/build` after the Phase 4 build that no `@anthropic-ai` reference appears. |
| Coaching question reopens later when ESPN fixes `/coaches` | `historyAggregator.js`, narrative prompt | History response shape includes an optional `coaches: []` field from day one (omitted when empty). When data lands, populate the field; the narrative prompt instruction "you may name coaches from training knowledge" becomes "you may use the structured coaches list when relevant." Additive change, no breaking. |

## Anti-features (explicitly out of scope)

- **No "next game" preview on the dashboard.** Live/upcoming game data is its own product surface; not in this scope.
- **No live-game indicator anywhere.** The team-context line already excludes this; the dashboard inherits the rule.
- **No advanced team metrics on the stats page** (offensive/defensive rating computed from PBP, etc.). v1 stats page consumes only what `fetchTeamStats` already returns. PBP-derived team ratings are a separate feature.
- **No multi-season comparisons on the stats page.** Season selector is documented as v2 future-add and explicitly excluded from v1.
- **No coaching history table** — pending a working ESPN endpoint. See Q5.
- **No premium gating on team layer.** All four spokes are free, including the AI narrative. The premium concept lives on the player-side advanced stats and is out of scope.
- **No social/sharing affordances** — no "share this franchise summary" button, no OpenGraph image generation for narratives.
- **No CMS for the AI narrative.** Output is generated, cached, displayed. There is no admin UI for editing the rendered narrative; if a fact is wrong, fix the input data (champions list, history aggregator) and regenerate.
- **No multi-language support** in the AI narrative. English only; not in any current product surface.
- **No "compare teams" page.** Out of scope.
- **No standings page.** Already excluded by `DESIGN-team-context.md`; reaffirmed here.
- **No analytics on spoke navigation.**
- **No SSR or pre-rendering** of narratives for SEO. The app is a SPA.

## Handoff

=== HANDOFF ===
did: produced 4-phase team-layer design at C:\Users\Owner\Desktop\AI\Projects\knowthew\DESIGN-team-layer.md — Outlet-shell + 4 child pages, four new server routes, first LLM integration via defensive-init pattern copied from Rhymebook
found: champions hardcoded in server/constants/wnbaChampions.js (ESPN has no source); v1 stats = current season only with ?season=YYYY API contract reserved for v2 selector; historical rosters omitted (ESPN returns empty athletes[]); coaching history omitted from structured data, allowed only as Claude commentary in AI narrative; narrative cache uses content-addressed hash of source data so regen is automatic when champs constant or current season's record changes; manual refresh gated behind ADMIN_TOKEN env; build-phase Q6 verification needed for ESPN schedule pagination
files-touched: C:\Users\Owner\Desktop\AI\Projects\knowthew\DESIGN-team-layer.md
next-suggested-agent: builder — start with Phase 1 (refactor TeamPage.jsx to layout shell, add TeamDashboard/TeamRosterPage, nest routes in App.jsx). No new dependencies until Phase 4.
blockers: none — all three open questions resolved; both scout-flagged data gaps resolved; pagination uncertainty deferred to Phase 2 builder verification
=== END HANDOFF ===
