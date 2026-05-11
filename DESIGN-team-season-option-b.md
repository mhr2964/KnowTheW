# Team Season Dropdown — Option B Design

**Status:** Proposed
**Date:** 2026-05-11
**Scope:** The three items deferred from `DESIGN-team-season-dropdown.md` (Option A, shipped) — making the team-header line season-aware, surfacing franchise-lineage names in the picker (and header), and adding MongoDB caching for past-season data.

---

## 1. Problem restatement

After Option A shipped, switching seasons on a team page swaps the spoke data (roster/stats/schedule) but leaves three rough edges: the header still shows current-season record/seed/conference; the picker shows raw years even when the franchise had a different name in those years (e.g. Dallas Wings in 2006 was the Detroit Shock); and past-season payloads re-fetch from ESPN on every cold process even though that data is immutable. This design closes those three gaps as one coherent Option B ship.

---

## 2. Grounding — what the code does today

| Area | Current state | File(s) |
|---|---|---|
| Team header line | Renders `team.record · seedLabel in conference · location` from `/api/teams` payload — strictly current-season; `fetchStandings()` hits the live `STANDINGS` endpoint with no `?season=`. | `client/src/pages/TeamPage.jsx:52-54`, `server/lib/espnClient.js:67-92` |
| Picker label | Plain `<option>{year}</option>` — no franchise-name suffix. | `client/src/components/SeasonPicker.jsx:23` |
| Franchise lineage data | `FRANCHISE_ALIASES` (server) maps current display name → set of historical names but has **no year ranges**. Aliases listed today: Dallas Wings, Las Vegas Aces, Connecticut Sun. | `server/constants/wnbaChampions.js:49-53` |
| Past-season standings | `historyAggregator.fetchStandingsForYear(year)` already does the heavy lifting: walks ESPN `STANDINGS?season=YYYY`, sums Home+Road for corrected wins/losses, and produces `{ conference, wins, losses, seed }` per team. Result is folded into `teamHistories` MongoDB cache via `buildHistory()`. | `server/lib/historyAggregator.js:87-127` |
| Existing caches | `teamSeasonStatsCache` and `teamPtsAllowedCache` are **in-process only**, keyed `${teamId}-${year}`, no TTL, cache `null` on failure. Schedule has **no cache** at all. Historical roster (`fetchSeasonRoster`) — no cache. `teamHistories` is the only MongoDB cache for team data today. | `server/lib/espnClient.js:14-24, 155-205`, `server/lib/historyAggregator.js:230-255` |
| ESPN historical-roster reality | ESPN ignores `?season=` on the roster endpoint — `fetchSeasonRoster` always returns current roster regardless of season. Documented in `espnClient.js:268-273`. Caching this is worthless. | `server/lib/espnClient.js:279-301` |

**Key insight for item 1:** `fetchStandingsForYear()` already extracts `{ conference, wins, losses, seed }` for **every team** in one ESPN call per year. The Option B "season-info" endpoint is mostly a thin lookup on top of that function — no new ESPN call shape, no new parsing logic. Reusing it (not duplicating) is the design lever.

**Key insight for item 2:** The existing `FRANCHISE_ALIASES` string list is order-preserved (`['Detroit Shock', 'Tulsa Shock']`) but lacks year boundaries. We need to upgrade it to a year-range structure. The Wikipedia-confirmed boundaries (section 5 below) are unambiguous — no franchise had a mid-season name change.

**Key insight for item 3:** Of the three payloads (stats, schedule, season-info), all are immutable once a past season ends. The `teamHistories` cache already proves the pattern: cold build, store, current-year refresh on warm. Reuse the same shape per `(teamId, season)`.

---

## 3. Two options

### Option B1 — All three items at MVP scope (recommended)

**Scope:**
- New `GET /api/teams/:id/season-info?season=YYYY` endpoint returning the season-correct header tuple.
- New `WNBA_FRANCHISE_LINEAGE` constant (server) + `WNBA_FRANCHISE_LINEAGE_CLIENT` mirror with year-range tuples. Picker labels aliased years; non-aliased years remain raw.
- MongoDB cache for three collections: `teamSeasonStats`, `teamSeasonSchedule`, `teamSeasonInfo`. Skip past-season-roster caching (ESPN data is wrong; caching wrong data is worse than re-fetching it).
- Single in-process cache layer remains for the **current** season only (mutable). Past seasons go to MongoDB and skip in-process entirely — keeps the read paths simple (one cache lookup, not two).
- Frontend wires: picker labels, header line consumes `/season-info` (with fallback to current `team.*` when the call fails), per-spoke fetches unchanged (they already pass `?season=`).

**Pros:**
- Closes all three deferred items in one dispatch.
- Reuses `fetchStandingsForYear` — no new ESPN integration to verify.
- Cache layer is uniform: same `(teamId, season)` key, same write path, same fallback behavior — three collections share one helper.
- Header consistency: picker label "2006 — Detroit Shock" and header name "Detroit Shock" come from the same lineage constant.

**Cons:**
- Three new MongoDB collections to provision indexes for.
- Header fallback path (when `/season-info` fails) silently shows the current-season values for the past season — visually it will look like Option A again, which can mask a regression. Mitigate with explicit logging.
- Adds a new fetch (header `/season-info`) on every team-page mount.

**Costs:** 1 dispatch. ~6 backend files (1 new route, 1 new lib, 1 constant, 3 collections via the lib), ~4 frontend files (constant mirror, picker label, header consumer, lib helper).

**Risk:** Medium-low. The standings-by-year path is proven (history page uses it). The franchise lineage year boundaries are confirmed via Wikipedia. Cache fallback follows the established `historyAggregator` pattern.

---

### Option B2 — Everything in B1 plus polish

**Scope (everything in B1, plus):**
- Admin-gated `DELETE /api/admin/cache/team-season?teamId=&season=` to invalidate a single cache row (uses the same `x-admin-token` + `timingSafeEqual` pattern as `/narrative` refresh).
- History tab row clicks navigate to `?season=YYYY` on the Dashboard tab — turns the history page into a launchpad rather than a dead-end.
- Compare page (player vs player) annotates a player's career row with their franchise-of-record at that season (e.g. "Detroit Shock — 2006") when the team was a relocated lineage. Uses the same lineage constant.

**Pros:**
- History tab becomes interactive instead of read-only.
- Compare page surfaces lineage without the user having to know to look.
- Admin cache invalidation is a real operational need the moment we have past-season caching — without it, the only fix for a bad cache row is a `db.collection.deleteMany` from the shell.

**Cons:**
- 2-3x the surface. Admin route alone adds an auth path that needs careful timing-safe handling (the narrative route is the template, but it's still net-new code). History click-navigation adds a routing concern and a UX decision (does it switch tab to Dashboard? Roster? — design discussion needed). Compare-page annotation requires per-player season-to-team mapping that doesn't exist yet (would need `fetchPlayerSeasonData` to surface team identity per season).
- Probably 2 dispatches, not 1.

**Costs:** 2 dispatches. Admin endpoint + history navigation + compare-page lineage are independently scoped and each could ship on its own week.

**Risk:** Medium. History tab navigation has an interaction-design risk (where does the click land?); compare-page lineage has a data-mapping risk (do we have season → team-of-record for every player row?).

---

## 4. Recommendation — Option B1

**Rationale:**
- B1 closes the three explicitly-deferred items. That's the assignment.
- The admin cache invalidation is a real concern but **v1 manual invalidation via `db.collection.deleteMany({})` is acceptable** because past-season data is immutable. The realistic invalidation scenario is "ESPN corrected a 2007 record" which happens maybe once every few years — not worth an authenticated endpoint up front.
- History-tab click-navigation has an unresolved UX question (which tab does the row click land on?) — that's a separate design conversation, not a bundling concern.
- Compare-page lineage labels are a polish concern dependent on data plumbing that doesn't exist yet; pursuing it would balloon scope without strengthening the season-dropdown experience itself.
- B1 ships in one design-build-review pass and leaves clean seams for B2 items to be added later (the lineage constant, the season-info endpoint, and the cache lib are all extensible).

---

## 5. Detailed design (B1)

### 5.1 Item 1 — Season-aware header (the `/season-info` endpoint)

**Endpoint:** `GET /api/teams/:id/season-info?season=YYYY`

**Validation:** Same shape as `/roster` (api.js:35-57) — numeric `:id`, 4-digit `season`, within `[foundedYear, currentYear]`. Reject with 400 outside that range.

**Response shape (success):**

```
{
  "teamId":     "14",
  "season":     2018,
  "name":       "Seattle Storm",      // franchise-of-record name for this season (see item 2)
  "location":   "Seattle",            // franchise-of-record city for this season
  "record":     "26-8",               // "wins-losses" string, omitted if both null
  "seedLabel":  "1st",                // ordinal suffix already applied; omitted if null
  "conference": "Western Conference", // omitted if null
  "champion":   true                  // optional; true only if this team won the title that year
}
```

**Field-by-field derivation:**

- `name` and `location` come from the new lineage constant (see 5.2) — `lookup(teamId, season)`. For non-aliased teams or for years inside the current name's range, both fall back to `team.name` / `team.location` from `getTeams()`.
- `record`, `seedLabel`, `conference` come from `fetchStandingsForYear(season)[teamId]`. Apply `formatSeedLabel` from `espnClient.js:94-99` to the integer seed. Omit a field when its source value is null (matches `getTeams()` behavior — fields are absent rather than `null` so client null-checks stay uniform).
- `champion` comes from `isChampion(season, team.name)` — already defined in `historyAggregator.js:31-37`. Surface it so the header could (future) add a trophy glyph; v1 frontend ignores it. Cheap to include.

**Current-season fast path:** When `season === currentYear`, **proxy `getTeams()` directly** — don't call `fetchStandingsForYear` (it would just duplicate `fetchStandings()` work for live data). The proxy maps the team's existing `{ record, seedLabel, conference, location, name }` into the response shape. This:
- avoids a redundant ESPN roundtrip for the most common case (loading any team page without a `?season=` param)
- guarantees the current-season header value stays in sync with what `/api/teams` reports (no divergence between header and other pages that consume `/api/teams`)
- keeps the MongoDB cache off the hot path for current-season

**Cache key:** `(teamId, season)` in collection `teamSeasonInfo`. Past seasons cache-aside. Current season is NOT MongoDB-cached (mutable mid-season).

**Pre-2003 quirk handling:** `fetchStandingsForYear` already handles the "corrupted ESPN scalar wins/losses" issue (sums Home+Road instead). Do not duplicate — call the existing function. Document the dependency in a comment so a future refactor of `historyAggregator` doesn't strand `/season-info`.

**Error/fallback states:**

| Condition | Response | Client behavior |
|---|---|---|
| `fetchStandingsForYear` returns null (ESPN down) | 200 with `{ teamId, season, name, location }` only (lineage fields populated; record/seed/conference omitted) | Header renders just the name + location segments — same shape as offseason 0-0 today |
| Standings has no entry for `teamId` that year (team didn't exist or didn't play) | 200 with `{ teamId, season, name, location }` only | Same as above |
| MongoDB down | 200 with live `fetchStandingsForYear` result, no cache write | Identical experience, hotter on every reload |
| Invalid season (out of range) | 400 with `{ error: 'invalid season' }` | Frontend's pre-validation should prevent this; if it slips through, header falls back to `team.*` |

**Frontend integration in `TeamPage.jsx`:**

- New `useEffect` keyed on `(team?.id, selectedSeason)` fetches `/api/teams/:id/season-info?season=YYYY`.
- Local state `seasonInfo` (object or null) replaces the four `team.record / seedLabel / conference / location / name` references on lines 52-54 and 69.
- During fetch (transient) or on fetch error, fall back to `team.*` (the current values). This means the worst-case behavior is **exactly Option A's behavior** — the user sees current-season meta on a past-season page rather than wrong-season meta. Acceptable degraded state.
- Add `AbortController` cleanup (matches every other useEffect pattern in the codebase).

### 5.2 Item 2 — Franchise lineage on the picker (and header)

**Authoritative year ranges (Wikipedia-confirmed):**

| Current team | Identity by year |
|---|---|
| **Dallas Wings** (id 3) | Detroit Shock 1998–2009 · Tulsa Shock 2010–2015 · Dallas Wings 2016–present |
| **Las Vegas Aces** (id 17) | Utah Starzz 1997–2002 · San Antonio Silver Stars 2003–2013 · San Antonio Stars 2014–2017 · Las Vegas Aces 2018–present |
| **Connecticut Sun** (id 18) | Orlando Miracle 1999–2002 · Connecticut Sun 2003–present |

**Sources:**
- https://en.wikipedia.org/wiki/Dallas_Wings — confirms 1998 founding as Detroit Shock, relocation to Tulsa before 2010 season, relocation to Dallas before 2016 season.
- https://en.wikipedia.org/wiki/Las_Vegas_Aces — confirms Utah Starzz 1997–2002, San Antonio Silver Stars from 2003, name shortened to San Antonio Stars for the 2014 season, relocation to Las Vegas before 2018 season.
- https://en.wikipedia.org/wiki/Connecticut_Sun — confirms Orlando Miracle 1999–2002, sale and relocation to Connecticut for the 2003 season.

All boundaries are clean season-to-season transitions; no mid-season name changes. The existing `FRANCHISE_ALIASES` is missing the **San Antonio Silver Stars / San Antonio Stars** distinction (it lists both flat in a single array). The new constant fixes that.

**Locations to match:** Detroit → Auburn Hills MI (use "Detroit" for the header to match ESPN convention), Tulsa → Tulsa OK, Dallas → Arlington TX (use "Dallas"), Utah → Salt Lake City (use "Utah"), San Antonio → San Antonio TX, Las Vegas → Las Vegas, Orlando → Orlando FL, Connecticut → Uncasville CT (use "Connecticut"). Match the abbreviation that ESPN uses for the current entries (`team.location` strings observed: "Seattle", "Dallas", "Las Vegas", "Connecticut").

**Constant shape — chosen: range tuples.**

```
const WNBA_FRANCHISE_LINEAGE = {
  '3': [
    { startYear: 1998, endYear: 2009, name: 'Detroit Shock',  location: 'Detroit' },
    { startYear: 2010, endYear: 2015, name: 'Tulsa Shock',    location: 'Tulsa' },
    { startYear: 2016, endYear: null, name: 'Dallas Wings',   location: 'Dallas' },
  ],
  '17': [
    { startYear: 1997, endYear: 2002, name: 'Utah Starzz',             location: 'Utah' },
    { startYear: 2003, endYear: 2013, name: 'San Antonio Silver Stars', location: 'San Antonio' },
    { startYear: 2014, endYear: 2017, name: 'San Antonio Stars',       location: 'San Antonio' },
    { startYear: 2018, endYear: null, name: 'Las Vegas Aces',          location: 'Las Vegas' },
  ],
  '18': [
    { startYear: 1999, endYear: 2002, name: 'Orlando Miracle',  location: 'Orlando' },
    { startYear: 2003, endYear: null, name: 'Connecticut Sun',  location: 'Connecticut' },
  ],
  // teams without an entry use their current name/location for every year
};
```

**Defense of this shape over alternatives:**
- **Flat year-to-name map** (`{ 1998: 'Detroit Shock', 1999: 'Detroit Shock', ... }`) — fastest O(1) lookup, but ugly to maintain: each year is a separate line, totaling 30+ entries for Dallas Wings alone. A typo in one year silently breaks one season. Not worth the lookup speedup over a 4-entry linear scan.
- **String array `['Detroit Shock', 'Tulsa Shock']` (existing shape)** — no year information at all. Doesn't solve item 2.
- **Range tuples (chosen)** — one entry per identity, compact (max 4 entries per team observed), easy to audit against Wikipedia. Lookup is O(n) where n ≤ 4. Negligible.

**Lookup helper:**

```
function getFranchiseIdentity(teamId, season, fallbackTeam) {
  const entries = WNBA_FRANCHISE_LINEAGE[teamId];
  if (!entries) return { name: fallbackTeam.name, location: fallbackTeam.location };
  const match = entries.find(e =>
    season >= e.startYear && (e.endYear === null || season <= e.endYear)
  );
  if (!match) return { name: fallbackTeam.name, location: fallbackTeam.location };
  return { name: match.name, location: match.location };
}
```

`endYear: null` means "current identity, ongoing." The helper falls back to `fallbackTeam` when the team has no lineage entry (i.e., the franchise has only ever used one name — Seattle Storm, Phoenix Mercury, etc.). The fallback lets the lookup be unconditional in the route handler without a separate "is this a relocated team?" branch.

**Backward compatibility with `FRANCHISE_ALIASES`:**

`FRANCHISE_ALIASES` is used by `historyAggregator.isChampion()` and `getChampionships()` to match championship-year team names against the current display name. The new `WNBA_FRANCHISE_LINEAGE` carries strictly more information — the name list is derivable from `entries.map(e => e.name).filter(n => n !== currentName)`. Two paths:

- **Keep both constants** (recommended for v1). `FRANCHISE_ALIASES` stays unchanged; `WNBA_FRANCHISE_LINEAGE` is added alongside. The aggregator code is untouched. Risk: two sources of truth — if someone adds a relocation to one and forgets the other, they drift. Mitigate by **deriving `FRANCHISE_ALIASES` from `WNBA_FRANCHISE_LINEAGE` at module load**: replace the `FRANCHISE_ALIASES = Object.freeze({...})` line with a one-time computation `const FRANCHISE_ALIASES = Object.freeze(deriveAliasesFromLineage(WNBA_FRANCHISE_LINEAGE, getTeams))`. Avoids drift, keeps the aggregator API surface unchanged.
- Note: `getTeams()` is async; deriving aliases at module load needs the current-name lookup which depends on team IDs. Simpler alternative: hardcode `currentName` into each lineage entry's last record (the entry where `endYear === null`) and derive aliases from `entries.slice(0, -1).map(e => e.name)`.

The simpler alternative is what to ship — no async dependency, no module-load ordering trap.

**Client mirror:** `client/src/constants/wnbaFranchiseLineageClient.js` exports `WNBA_FRANCHISE_LINEAGE_CLIENT` with the same structure. Same duplication-risk comment as `wnbaFoundedClient.js`.

**Picker label rendering:**

- For a team **with** a lineage entry, each `<option>` displays:
  - The label is `{year}` if the year falls in the current identity's range (i.e., `getFranchiseIdentity(teamId, year, team).name === team.name`).
  - Otherwise the label is `{year} — {historical name}` (e.g. `2006 — Detroit Shock`).
- For a team **without** a lineage entry, every `<option>` displays just `{year}` — no visual noise for the 12 of 15 teams that have never relocated/renamed.
- Em-dash separator (`—`, U+2014) matches the style already in use elsewhere in the codebase ("history spans all seasons" tooltip uses an em-dash convention).

**Picker label table example (Dallas Wings):**

```
2026                           <- current identity
2025                           <- current identity
...
2016                           <- current identity (Dallas Wings 2016-present)
2015 — Tulsa Shock
2014 — Tulsa Shock
...
2010 — Tulsa Shock             <- Tulsa Shock 2010-2015
2009 — Detroit Shock
2008 — Detroit Shock
...
1998 — Detroit Shock           <- Detroit Shock 1998-2009
```

**Header impact:** The `/season-info` endpoint (item 1) consumes the same `getFranchiseIdentity` helper server-side, so the header's name and location stay in lockstep with the picker label. Picking "2006 — Detroit Shock" displays "Detroit Shock · Detroit" in the header for that page load.

### 5.3 Item 3 — MongoDB caching for past-season data

**Collections (3):**

| Collection | Cache key | Document shape | Source endpoint |
|---|---|---|---|
| `teamSeasonStats` | `(teamId, season)` | `{ _id: '${teamId}-${season}', teamId, season, payload: <stats response>, cachedAt: Date }` | `/api/teams/:id/stats?season=` |
| `teamSeasonSchedule` | `(teamId, season, seasontype)` | `{ _id: '${teamId}-${season}-${seasontype}', teamId, season, seasontype, payload: <schedule response>, cachedAt: Date }` | `/api/teams/:id/schedule?season=&seasontype=` |
| `teamSeasonInfo` | `(teamId, season)` | `{ _id: '${teamId}-${season}', teamId, season, payload: <season-info response>, cachedAt: Date }` | `/api/teams/:id/season-info?season=` |

**Skipping past-season-roster cache:** ESPN ignores `?season=` on the roster endpoint and returns the current roster. Caching the current roster keyed by a past season would serve **stale-but-believable wrong data** indefinitely. Bug-amplifying. Pass.

**Cache key choice — string `_id` over compound index:**
- Using `_id: '${teamId}-${season}'` lets MongoDB's default `_id` index serve as the lookup index. No additional `createIndex` call.
- Schedule cache adds `seasontype` to the composite — `'${teamId}-${season}-${seasontype}'` — to differentiate regular (2) and playoffs (3).
- Alternative `{ teamId: Number, season: Number }` with a separate compound index works fine but adds a startup step. The string-key approach is what `teamHistories` (`_id: teamId`) and `teamNarratives` (`_id: teamId`) already use — keeps the persistence patterns uniform.

**TTL:** None. Past-season data is immutable. Manual invalidation (deferred to B2) is acceptable for the rare correction case.

**Shared helper — `server/lib/teamSeasonCache.js` (new):**

```
// Pseudocode (not real code — design only)
async function readOrFetch(collectionName, key, fetchFn) {
  const db = getDb();
  if (!db) {
    // Dev path: no MongoDB — just fetch.
    return fetchFn();
  }
  const coll = db.collection(collectionName);
  let cached;
  try { cached = await coll.findOne({ _id: key }); }
  catch (err) { console.error(`[teamSeasonCache] read failed coll=${collectionName} key=${key}:`, err.message); cached = null; }
  if (cached) return cached.payload;

  const fresh = await fetchFn();
  if (fresh != null) {
    coll.replaceOne({ _id: key }, { _id: key, payload: fresh, cachedAt: new Date() }, { upsert: true })
      .catch(err => console.error(`[teamSeasonCache] write failed coll=${collectionName} key=${key}:`, err.message));
  }
  return fresh;
}
```

This helper is the **only** new caching abstraction. All three collections route through it.

**Read path (per endpoint, past season case):**

1. Route handler validates `season < currentYear`.
2. Call `readOrFetch('teamSeasonStats', '${teamId}-${season}', () => fetchAndAssembleStats(teamId, season))`.
3. The `fetchAndAssembleStats` callback runs the existing route logic (in-process `teamSeasonStatsCache` + `fetchTeamPtsAllowed` merge) and returns the response payload.
4. Cache miss → callback runs, result written to MongoDB and returned.
5. Cache hit → MongoDB doc returned directly.

**Write path:** Inline in `readOrFetch`. Fire-and-forget (`.catch` logs and swallows). A failed write doesn't break the response — next request will just re-fetch from ESPN.

**Current-season path:** Unchanged. The route handlers branch on `season === currentYear`:
- Current → use the existing in-process caches (`teamSeasonStatsCache`, `teamPtsAllowedCache`). These have mid-session-mutable behavior already.
- Past → `readOrFetch` (MongoDB → ESPN).

The in-process caches stay for current-season-only use. **Past-season values never enter the in-process cache** under this design — keeps the cache contract clean (in-process = mutable current; MongoDB = immutable past). Today `teamSeasonStatsCache` ends up holding past-season values too because the cache key includes year — under the new design, past-season keys go through `readOrFetch` and never write to the in-process cache. Less code surface, simpler invalidation story.

> **Builder note:** This requires a small refactor — `fetchTeamStats(teamId, year)` today wraps everything in `withCache(teamSeasonStatsCache, ...)`. The route handler will need to skip that wrapper for past seasons (call a sibling `fetchTeamStatsRaw` or pass a `skipCache: true` flag) and rely on `readOrFetch` instead. Same for `fetchTeamPtsAllowed`. Detail in the file list.

**Fallback when MongoDB is unavailable (dev / Heroku outage):**

`getDb()` returns null → `readOrFetch` calls `fetchFn` directly, no cache. Identical to the `historyAggregator` and `narrative` paths today. **No crash, one log warning.** This is established workspace pattern.

**Single-vs-two-tier choice:** The prompt asks whether to keep in-process L1 + MongoDB L2 or just MongoDB. **Recommend MongoDB only** for past seasons, in-process only for current. Reasoning:
- A MongoDB hit on `_id` lookup is single-digit milliseconds — same order as in-process map access for a single request, and the request is going to do other work (assemble the response, send to client) in the same order of magnitude.
- Two-tier caches require write-through logic (when MongoDB hits, also populate L1 for the next request) and a memory-pressure concern (L1 grows unbounded across past seasons × teams). Not worth the operational footprint.
- Heroku replicas would benefit from MongoDB hits being shared; in-process L1 is per-dyno and per-restart.

### 5.4 Per-page behavior matrix (updated)

| Page | season === current | season < current | New endpoint dependency |
|---|---|---|---|
| **Header (all subpages)** | `getTeams()` proxy via `/season-info` | `/season-info` → past name/location/record/seed/conference | New |
| **Dashboard** | In-process cache → ESPN | `readOrFetch` MongoDB → ESPN for stats + schedule cards; `/season-info` for header | Schedule + stats + season-info cached |
| **Roster** | Live `getRoster()` (in-process) | ESPN direct (not cached — data is wrong anyway) | Unchanged |
| **Stats** | In-process cache → ESPN | `readOrFetch` MongoDB → ESPN | Stats cached |
| **Schedule** | No cache today; remains uncached for current | `readOrFetch` MongoDB → ESPN, keyed `(teamId, season, seasontype)` | Schedule cached |
| **History** | n/a (multi-season) | n/a | Unchanged — already MongoDB-cached as `teamHistories` |

### 5.5 Files to modify

**Backend:**

| File | Change |
|---|---|
| `server/constants/wnbaFranchiseLineage.js` | **New.** Export `WNBA_FRANCHISE_LINEAGE` (object) and `getFranchiseIdentity(teamId, season, fallbackTeam)` helper. |
| `server/constants/wnbaChampions.js` | Replace the hand-maintained `FRANCHISE_ALIASES` literal with a derivation from `WNBA_FRANCHISE_LINEAGE` (slice off the current-identity entry, map to names). Module export contract unchanged. |
| `server/lib/teamSeasonCache.js` | **New.** Export `readOrFetch(collectionName, key, fetchFn)`. See pseudocode in 5.3. |
| `server/lib/espnClient.js` | Add `fetchTeamStatsRaw(teamId, year)` — same body as `fetchTeamStats` but without the `withCache` wrapper, for past-season callers that route through `readOrFetch`. Add `fetchTeamPtsAllowedRaw(teamId, year)` similarly. Keep the cached versions for current-season use. |
| `server/lib/seasonInfo.js` | **New.** Export `buildSeasonInfo(team, season, currentYear)` — for current year, proxy `getTeams()` entry; for past year, call `fetchStandingsForYear(season)`, then `getFranchiseIdentity`, then `formatSeedLabel`, then `isChampion`. Returns the response shape from 5.1. |
| `server/lib/historyAggregator.js` | Export `fetchStandingsForYear` (currently private) so `seasonInfo.js` can call it without duplicating. Export `formatSeedLabel` from `espnClient.js` if not already. |
| `server/routes/api.js` | (a) New route `GET /teams/:id/season-info` — validate params, call `buildSeasonInfo`, wrap past-season in `readOrFetch('teamSeasonInfo', ...)`. (b) Modify `/stats` to branch on `season === currentYear`: current → existing path; past → `readOrFetch('teamSeasonStats', ...)` with `fetchTeamStatsRaw` + `fetchTeamPtsAllowedRaw`. (c) Modify `/schedule` similarly: current → existing direct `fetchTeamSchedule`; past → `readOrFetch('teamSeasonSchedule', ...)`. |

**Frontend:**

| File | Change |
|---|---|
| `client/src/constants/wnbaFranchiseLineageClient.js` | **New.** Mirror of `WNBA_FRANCHISE_LINEAGE` (server constant). Include the same `getFranchiseIdentity` helper. |
| `client/src/components/SeasonPicker.jsx` | Accept new `teamId` prop. For each year option, look up `getFranchiseIdentity(teamId, year, { name: currentName })` (where `currentName` is the current-identity name, also passed via a prop) and render `{year} — {historicalName}` when the names differ, else just `{year}`. |
| `client/src/pages/TeamPage.jsx` | (a) Pass `team.id` and `team.name` to `<SeasonPicker>`. (b) Add `useEffect` for `/api/teams/:id/season-info?season=${selectedSeason}` keyed on `(team?.id, selectedSeason)`. (c) Replace `team.record / seedLabel / conference / location / name` in the header render with `seasonInfo?.record / .seedLabel / .conference / .location / .name` falling back to `team.*`. |
| `client/src/lib/seasonInfo.js` | **New (optional).** Helper to fetch and merge `/season-info` with the local `team` fallback. Could live inline in `TeamPage.jsx`; promoting it to its own file makes it reusable if `Compare` or `Search` ever wants the same season-aware label. |

### 5.6 SWEN — variability axes and patterns

**Variability axes addressed by this design:**

1. **Season immutability** (past vs current). Drives the cache-policy split: current uses in-process (mutable, hot path), past uses MongoDB cache-aside (immutable, durable). One axis, two policies.
2. **Franchise identity over time**. Drives the lineage constant — a single source of truth (`WNBA_FRANCHISE_LINEAGE`) feeds both the picker label, the header name/location, and the existing championships-by-alias logic (via the derived `FRANCHISE_ALIASES`).
3. **Cache backing store availability** (MongoDB up vs down). Drives the `readOrFetch` helper to degrade transparently when `getDb()` returns null.

**Patterns used:**

- **Cache-aside with no TTL for immutable data** — same shape as `teamHistories` already uses. The `readOrFetch` helper is the explicit re-extraction of that pattern into a shared lib so three collections can share it without each route handler reimplementing the read-fetch-write dance.
- **Single source of truth for franchise lineage** — `WNBA_FRANCHISE_LINEAGE` is the only place year boundaries live. `FRANCHISE_ALIASES` becomes a derived view. Picker label, header label, and championships lookup all consume the same constant.
- **Graceful degradation** — every new path has a documented fallback (MongoDB down → ESPN direct; standings null → omit fields; no lineage entry → use current name). No surprise crashes.
- **Builder/Visitor pattern (mild) — `buildSeasonInfo`** is a pure function that assembles the response from inputs (`team`, `season`, `standings`, `lineage`). Pulling it out of the route handler keeps the handler thin and lets a future caller (e.g., a `/api/seasons/:year/standings` endpoint) reuse the same assembly logic.

**Anti-patterns avoided:**

- **Two-tier cache without write-through coordination** — rejected (5.3). One-tier per use case keeps invalidation tractable.
- **Hand-maintained `FRANCHISE_ALIASES` next to a new `WNBA_FRANCHISE_LINEAGE`** — rejected. Drift bait. Derive aliases from lineage instead.
- **Flat year-to-name lineage map** — rejected (5.2). 30+ entries per team is noise; a typo silently breaks one year and is undetectable.
- **Caching ESPN's wrong-data roster response** — explicitly skipped (5.3). Caching incorrect data magnifies the bug.

---

## 6. Authoritative-data research (item 2)

See section 5.2 for the consolidated year-range table. Per-franchise sources:

- **Dallas Wings lineage** (id 3) — https://en.wikipedia.org/wiki/Dallas_Wings
  - Detroit Shock: founded 1998, last season 2009.
  - Tulsa Shock: 2010 (relocated for 2010 season), last season 2015 (relocation announced July 20, 2015 for the 2016 season).
  - Dallas Wings: 2016–present.
- **Las Vegas Aces lineage** (id 17) — https://en.wikipedia.org/wiki/Las_Vegas_Aces
  - Utah Starzz: 1997–2002 (original WNBA franchise, relocated after 2002).
  - San Antonio Silver Stars: 2003–2013 (relocated for 2003 season; "Silver Stars" branding through 2013).
  - San Antonio Stars: 2014–2017 (name shortened in 2014; relocated to Las Vegas after 2017).
  - Las Vegas Aces: 2018–present.
  - **Note:** The existing `FRANCHISE_ALIASES` lists `'San Antonio Silver Stars'` and `'San Antonio Stars'` as separate names — correct. The new lineage constant splits them into separate year-range entries with a 2014 boundary.
- **Connecticut Sun lineage** (id 18) — https://en.wikipedia.org/wiki/Connecticut_Sun
  - Orlando Miracle: 1999–2002.
  - Connecticut Sun: 2003–present (relocated and renamed January 28, 2003, before the 2003 season).

**Cross-check against `FRANCHISE_ALIASES` (server/constants/wnbaChampions.js:49-53):**

| Current name | Aliases listed today | Aliases derivable from new lineage |
|---|---|---|
| Dallas Wings | ['Detroit Shock', 'Tulsa Shock'] | ['Detroit Shock', 'Tulsa Shock'] — match |
| Las Vegas Aces | ['Utah Starzz', 'San Antonio Silver Stars', 'San Antonio Stars'] | ['Utah Starzz', 'San Antonio Silver Stars', 'San Antonio Stars'] — match |
| Connecticut Sun | ['Orlando Miracle'] | ['Orlando Miracle'] — match |

The derivation is **set-equal** to today's hand-maintained list. Safe to switch the source of truth.

**Defunct franchises explicitly NOT in scope:** Houston Comets (1997–2008), Sacramento Monarchs (1997–2009), Charlotte Sting (1997–2006), Miami Sol (2000–2002), Portland Fire 1.0 (2000–2002, distinct from the 2026 expansion team that reuses the name), Cleveland Rockers (1997–2003). No current team inherits these — they have no entry in `FRANCHISE_ALIASES` today and have none in `WNBA_FRANCHISE_LINEAGE` either. Their championship years (Houston 1997–2000, Sacramento 2005) remain in `WNBA_CHAMPIONS` and surface in the History page narrative without being attributed to a current team.

**Portland Fire name-reuse subtlety:** The 2026 expansion team is named **Portland Fire** — the same name as the 2000–2002 defunct franchise. They are *distinct franchises*, not a lineage. ESPN's team ID (`132052`) is brand new. The lineage constant correctly omits Portland Fire because the current team's first season is 2026 and there's no relocation in its history. No conflict.

---

## 7. Risks + mitigations

| Risk | Where it lives | Mitigation |
|---|---|---|
| Lineage year boundary off by one (e.g., is 2010 Tulsa or Detroit?) — silent wrong header/picker label | `wnbaFranchiseLineage.js` | Wikipedia confirms each transition was a season-boundary relocation, no mid-season changes. The constant's start/end years are inclusive. Add a unit test that asserts `getFranchiseIdentity('3', 2010)` returns "Tulsa Shock" and `getFranchiseIdentity('3', 2009)` returns "Detroit Shock" — covers the two-year boundary in one assertion. |
| `FRANCHISE_ALIASES` derivation breaks `historyAggregator.isChampion()` if the derivation differs from the hand-maintained list | `historyAggregator.js` | Cross-check table in section 6 shows set-equality with today's list. Add a runtime invariant check at module load: assert derived `FRANCHISE_ALIASES` matches a frozen snapshot of the old list — fail noisily at boot, not silently in production. |
| MongoDB cache stores a transient ESPN error response (e.g., empty stats) and serves it forever | `teamSeasonCache.js` | `readOrFetch` should only write when `fresh != null` AND not an `{ empty: true }` envelope. Past-season "empty" might mean ESPN had a hiccup; re-fetch next time. The route layer normalizes the empty envelope, so the helper checks `fresh && !fresh.empty` before writing. Document this in the helper. |
| Picker label for an aliased year is visually noisy on narrow mobile (em-dash + name doubles the option width) | `SeasonPicker.jsx` | Native `<select>` on mobile opens the OS native picker, which has its own width handling. Test on iOS Safari and Chrome Android. If overflow appears on the closed `<select>` element specifically, fall back to showing only the year in the picker's *closed* state via CSS `text-overflow: ellipsis` while keeping the full label in the dropdown list. |
| The new `/season-info` fetch adds a third round-trip on every team-page mount (after `/api/teams` and the spoke's own fetch) | `TeamPage.jsx` | `getDb()` MongoDB hit is fast; current-season case proxies `getTeams()` (already cached server-side, no ESPN call). The new fetch is light. If timing measurements show user-perceived lag, layer a 5-minute client-side cache on `seasonInfo` keyed `(teamId, season)` using a simple module-scoped map. |
| Schedule cache key collision between `seasontype=2` and `seasontype=3` if the helper key forgets to include seasontype | `api.js` / `teamSeasonCache.js` | Helper signature is generic (`readOrFetch(collectionName, key, fetchFn)`) — the caller is responsible for assembling the right key. Route handlers explicitly include `seasontype` in the key for the schedule collection. Document this in a comment in `api.js`. |
| Pre-2003 standings have known ESPN data quirks already handled in `fetchStandingsForYear` (corrupted wins/losses). If `/season-info` is called for 1997 (Utah Starzz, Aces lineage), this path is exercised but the user is unlikely to look | `seasonInfo.js` | `seasonInfo` reuses `fetchStandingsForYear` directly — the quirk fix is inherited. Don't duplicate the parsing. Document the dependency in a comment. |
| Lineage rename later (e.g., a future relocation) requires updating both server and client constants | `wnbaFranchiseLineage.js` + client mirror | Same drift risk as `WNBA_FOUNDED` / `WNBA_FOUNDED_CLIENT` today. Acceptable v1; track as "TODO: expose lineage via `/api/teams` to eliminate the client mirror" — same trajectory the founded-year constant should eventually take. |

---

## 8. Handoff

=== HANDOFF ===
did: Designed Option B (three deferred items: season-aware header, franchise-lineage picker labels, MongoDB past-season cache) for KnowTheW team-season feature. Two options spanning scope (B1 minimal-viable, B2 with admin/history-nav/compare polish); recommended B1 for single-dispatch ship.
found: `fetchStandingsForYear` in `server/lib/historyAggregator.js` already produces the {conference, wins, losses, seed} tuple needed for the new `/season-info` endpoint — no duplication needed. `FRANCHISE_ALIASES` and new `WNBA_FRANCHISE_LINEAGE` are set-equal (cross-checked in section 6) — `FRANCHISE_ALIASES` should be **derived** from lineage to eliminate drift, not re-maintained. ESPN's roster endpoint **ignores `?season=`** (already documented in `fetchSeasonRoster`) so past-season roster caching is explicitly skipped — would cache wrong data. MongoDB caching uses string `_id` keys (`'${teamId}-${season}'`) matching the established pattern in `teamHistories` and `teamNarratives`. Single-tier cache (no in-process L1 over MongoDB L2) chosen for simplicity. Wikipedia-confirmed lineage year boundaries: Dallas Wings (Detroit 1998-2009, Tulsa 2010-2015, Dallas 2016-), Las Vegas Aces (Utah 1997-2002, SA Silver Stars 2003-2013, SA Stars 2014-2017, LV 2018-), Connecticut Sun (Orlando 1999-2002, Conn 2003-).
files-touched: Projects/knowthew/DESIGN-team-season-option-b.md
next-suggested-agent: backend-builder first — implement `wnbaFranchiseLineage.js` + helper, derive `FRANCHISE_ALIASES` from it, build `teamSeasonCache.js`, add `seasonInfo.js`, wire `/season-info` route, branch `/stats` and `/schedule` on past vs current to route past through the cache. Then frontend-builder for `wnbaFranchiseLineageClient.js`, `SeasonPicker` label upgrade, `TeamPage.jsx` season-info fetch.
blockers: none — Wikipedia year boundaries resolved; constant-shape and cache-shape decisions made.
=== END HANDOFF ===
