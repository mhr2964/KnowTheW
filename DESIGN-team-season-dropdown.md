# Per-Team Season Dropdown — Design

**Status:** Proposed
**Date:** 2026-05-11
**Scope:** Add a season picker on team subpages so users can browse historical seasons (roster, stats, schedule, dashboard, history-tab interaction).

---

## 1. Problem restatement

Today, every team subpage (Dashboard, Roster, Stats, Schedule) silently fetches the **current** season. The user wants a dropdown on the team page that switches the entire subpage cluster to a chosen historical season (e.g. "2018 Seattle Storm") and shows that season's roster, schedule, stats, and dashboard preview.

---

## 2. Grounding — what the code actually does today

| Endpoint | Season-aware today? | ESPN underlying call shape |
|---|---|---|
| `/api/teams/:id/roster` | **No.** `getRoster()` calls `fetchRoster()` (no season arg). | `${ESPN}/teams/{id}/roster` — current only |
| `/api/teams/:id/stats` | **Partial.** Validates `?season=YYYY`, defaults to current calendar year. Already supports historical. | `${ESPN}/teams/{id}/statistics?season=YYYY&seasontype=2` (espnClient.js:157) |
| `/api/teams/:id/schedule` | **Yes.** Requires `?season=YYYY`, optional `?seasontype=` (2 reg, 3 playoffs). | `${ESPN}/teams/{id}/schedule?season=YYYY&seasontype=N` (espnClient.js:217) |
| `/api/teams/:id/history` | Multi-season by design — not a per-season fetch. Leave alone. |  |
| `/api/teams/:id/narrative` | Multi-season AI summary — leave alone. |  |

**Existing helper:** `fetchHistoricalRoster(teamId, season)` exists in `espnClient.js:250` and hits `${ESPN}/teams/{id}/roster?season=YYYY`. It returns a **thin** shape `{ id, position }` only — used today by `historyAggregator` for membership lookups, not for UI display. Designing for season-aware roster will likely require enriching that function or writing a sibling.

**Current "current season" derivation:** Several files use `new Date().getFullYear()` directly (TeamDashboard.jsx:88, TeamSchedulePage.jsx:15, api.js:56). There is no single source of truth.

**Team header data (TeamPage.jsx:20-22):** `team.record`, `team.seedLabel`, `team.conference`, `team.location` come from `/api/teams` (the live league standings — strictly current). They are **not** season-aware today.

**Franchise lineage:** `FRANCHISE_ALIASES` in `wnbaChampions.js:49-53` maps current display name → historical names. Already used by `historyAggregator` for championships. Founded years come from `WNBA_FOUNDED` keyed by ESPN team ID.

---

## 3. Two options spanning the design space

### Option A — Lean MVP (recommended)

**Scope:**
- URL query param `?season=YYYY` on team subpages.
- Dropdown in the team header (one place, visible on every spoke).
- Wire season → Roster, Stats, Schedule fetches.
- Backend: add `?season=` support to `/api/teams/:id/roster` (the only endpoint missing it).
- Dashboard: keep "Next Up" card but degrade gracefully — when `season < currentYear`, the card shows "Final Record" + last game of that season instead of next/last with a "Next" label.
- History tab: dropdown stays visible but does nothing (no-op) — franchise history is inherently multi-season.
- No new MongoDB caching. Rely on existing in-process `teamSeasonStatsCache` and re-fetch on dropdown change.
- Header context line (record / seed / conference) **stays current-season** in v1 — explicitly out of scope; flagged as known limitation. Adding season-aware standings means a new ESPN call (`STANDINGS?season=YYYY`) per dropdown change, plus deriving record/seed for past seasons — duplicates work `historyAggregator` already does.

**Pros:**
- One backend endpoint change (`/roster`). Two are already done or partial.
- One frontend state surface (`useSearchParams` in TeamPage, propagated via outlet context).
- No schema additions. No new constants needed (founded years already exist).
- Ships in a single dispatch — small enough to design-build-review in a day.

**Cons / costs:**
- Header line ("12-8 · 3rd in East · Seattle") still shows current-season values even when viewing 2018. Visually disjointed for power users.
- Every dropdown change fires fresh ESPN requests for past seasons (no MongoDB cache). 1-2s latency per switch. Acceptable for a browse-by-season feature, not great for rapid scrubbing.
- History tab dropdown being a no-op is a small UX surprise.

**Risk:** Low. The only new wiring is the `season` param threading through the outlet context, and adding `?season=` to one endpoint.

---

### Option B — Full fidelity

**Scope (everything in A, plus):**
- Header line becomes season-aware: fetch season-specific record/seed/conference from a new `/api/teams/:id/season-info?season=YYYY` endpoint backed by the same standings cache `historyAggregator` already populates per season.
- Add MongoDB caching for `roster` and `stats` keyed by `(teamId, season)` for past seasons (current season stays in-memory only — it's mutable).
- Dashboard's "Next Up" card becomes "Season Summary" for past seasons — record, playoff result, last game with a final-W/L pill.
- History tab: clicking a row's year navigates to `?season=YYYY` and switches to Dashboard.
- Disable dropdown options for seasons before `WNBA_FOUNDED[teamId]`, plus seasons in franchise-lineage gaps (e.g. Las Vegas Aces' year list shows 1997-present continuously with name labels for past identities: "2002 — Utah Starzz").

**Pros:**
- Fully coherent: header, dashboard cards, and tabs all reflect the same season.
- Cached past-season data is essentially free after first fetch — fast scrubbing through history.
- History tab is a launchpad for season browsing instead of a dead-end.

**Cons / costs:**
- 3-4x larger surface: new endpoint, two new MongoDB collections (`teamRosterBySeason`, `teamStatsBySeason`) or schema extension, season-info derivation logic, dashboard card variant, history-tab click handler.
- More test surface — past/current/future cases, cache invalidation rules, alias-name display.
- Likely 2-3 dispatches instead of 1.

**Risk:** Medium. Standings-by-season needs to handle ESPN's known quirks (corrupted `wins`/`losses` on some old seasons — already handled in `historyAggregator.fetchStandingsForYear`, would need to be extracted and shared).

---

## 4. Recommendation: **Option A**

**Rationale:**
- The user's stated request is "change the year of the team you are looking at via a dropdown for things like roster, schedule, stats." That's exactly Option A's deliverable.
- Header line being current-season is a defensible v1 limit because (a) header data is `/api/teams`-derived and not seasonal in the data model, (b) `team.record` is already absent in the offseason so users have seen the "no record" state, (c) the **subpages** are where season matters — the header is identity, not data.
- One endpoint change keeps the blast radius small.
- Option B's caching can be layered in later — the cache-key shape `(teamId, season)` is the obvious extension when latency becomes a problem.
- The History tab no-op is honest about the data model: history is multi-season, the dropdown picks one season, those don't compose.

---

## 5. Detailed design (Option A)

### 5.1 URL contract + state propagation

- **URL shape:** `/team/:slug/<spoke>?season=YYYY`. No `season=` means "current."
- **Default:** When the param is absent or invalid, fall back to the **current calendar year** (`new Date().getFullYear()`). Same heuristic already used in `TeamDashboard.jsx:88`, `TeamSchedulePage.jsx:15`, and `api.js:56`. Centralize this in a single client helper (e.g. `client/src/lib/currentSeason.js` exporting `getCurrentSeason()`) so we have one place to swap in a smarter "last completed season" rule later.
- **Invalid values:** Any `?season=` value that is non-numeric, not 4 digits, less than `WNBA_FOUNDED[teamId]`, or greater than the current year → treat as if absent. Do not redirect the URL — let the dropdown show the resolved-current value while the URL stays unchanged. (Avoids history.replaceState chains that confuse the back button.)
- **State owner:** `TeamPage.jsx` is the single owner. It calls `useSearchParams()`, derives `selectedSeason` (number), passes it via outlet context: `<Outlet context={{ team, onSaveDeck, season: selectedSeason, isCurrentSeason: selectedSeason === currentSeason }} />`.
- **Spokes consume:** Each spoke reads `useOutletContext()` and includes `season` in its fetch URL and effect deps.

### 5.2 Component placement

```
+------------------------------------------------------+
|  ← All Teams                                         |
+------------------------------------------------------+
|  [LOGO]  Seattle Storm                  [2018 ▾]    |   <- dropdown right-aligned in header
|          12-8 · 3rd in East · Seattle               |       (current-season meta line; v1 limitation)
+------------------------------------------------------+
|  Dashboard  Roster  Stats  History  Schedule         |   <- existing tab nav, unchanged
+------------------------------------------------------+
|                                                      |
|  <Outlet> — receives season via context              |
|                                                      |
+------------------------------------------------------+
```

**Why header (not tab strip):**
- Header is the team's identity row — the season picker belongs next to the team name conceptually ("which 2018 Storm").
- Tab strip already holds tab controls; mixing a value picker there crowds the spoke navigation.
- Per-spoke pickers (the rejected third option) lose shared context — switching tabs would reset season.

**Mobile (≤480px):**
- Header logo + name stays on row 1.
- Dropdown drops to row 2, full width, left-aligned. Meta line moves to row 3.
- This keeps the dropdown tappable without truncating the team name.
- Use the existing `.team-header` flex container; add a media query that switches `flex-direction` to column ≤480px and reorders children so the dropdown sits between name and meta.

### 5.3 The dropdown itself

- Native `<select>` (no custom dropdown). Aligns with KnowTheW's existing minimalism and is free for accessibility, keyboard, and mobile pickers.
- **Options list:** Generated client-side from `WNBA_FOUNDED[team.id]` to current year, newest first.
  - Aliasing decision: **defer to Option B.** v1 shows raw years without lineage labels. Tradeoff: a Dallas Wings user picking 2006 sees "2006 Dallas Wings" header even though it was the Detroit Shock then. We will not fetch the alias name in v1. Reasoning: the alternative requires baking the alias-by-year mapping into a new constant (when did Las Vegas become Las Vegas? 2018?), and lineage display is a polish detail orthogonal to the core "switch seasons" feature. Document the limitation; users who care can read the History tab.
  - Founded year for new expansion franchises that haven't played a season yet (Toronto 2026, Portland 2026) — only emit options up to `Math.min(currentYear, foundedYear)`. If a team's founded year equals current year, dropdown is still rendered (with one option) so the UI is uniform.
- **Disabled state on History tab:** Render the dropdown but apply `disabled` and a `title="History spans all seasons"` tooltip. Visually present, functionally inert. Keeps the layout stable when navigating tabs.

### 5.4 Backend changes

**Modify `/api/teams/:id/roster`:**
- Accept `?season=YYYY` query param. Default: current year (treat as "live current roster").
- Reject non-numeric / out-of-range with 400, same shape as `/stats` does today (api.js:54-61).
- When `season === currentYear` (or param absent), keep the existing path: `getRoster()` returns the in-memory cached current roster including full player metadata.
- When `season < currentYear`, call ESPN's historical roster endpoint. **Implementation note:** `fetchHistoricalRoster()` exists but returns only `{ id, position }`. We need richer data (name, headshot, jersey) for the roster page. Two paths:
  - **5.4a (preferred):** Extend `fetchHistoricalRoster` to return the same shape as `fetchRoster` by parsing the same fields ESPN's `roster?season=YYYY` endpoint returns. Confirm shape with an exploratory call first — both response formats (flat vs grouped `items`) are already handled in `fetchHistoricalRoster:256`.
  - 5.4b: Add a new function `fetchSeasonRoster(teamId, season)` and leave the lightweight aggregator helper alone. Avoids breaking history-aggregator callers if we discover ESPN's historical roster has gaps in some fields.
- Decision: 5.4a if the field set lines up; 5.4b if it doesn't. Builder verifies with one curl before coding.

**Modify `/api/teams/:id/stats`:**
- Already accepts `?season=`. **No change needed.** Verify the frontend now sends it.

**Modify `/api/teams/:id/schedule`:**
- Already requires `?season=`. **No change needed.** Verify the frontend's selected season is passed instead of `currentYear` hardcoded.

**Out of scope (Option B):**
- `/api/teams/:id/season-info` — not built. Header keeps current-season standings data.

### 5.5 Frontend file changes

| File | Change |
|---|---|
| `client/src/lib/currentSeason.js` | **New.** Export `getCurrentSeason()` returning `new Date().getFullYear()`. Single source of truth. |
| `client/src/components/SeasonPicker.jsx` | **New.** Renders the `<select>`. Props: `teamId`, `foundedYear`, `value`, `onChange`, `disabled`. |
| `client/src/constants/wnbaFoundedClient.js` | **New.** Client-side mirror of `WNBA_FOUNDED` from `server/constants/wnbaFounded.js`. Reason: founded-year decides the dropdown range, and the client doesn't currently get this from the API. Alternative is exposing it via `/api/teams` payload — slightly cleaner but a larger change. v1 mirrors the constant; track the duplication risk in a comment. |
| `client/src/pages/TeamPage.jsx` | Add `useSearchParams`, derive `selectedSeason`, render `<SeasonPicker>` in `.team-header` (right-aligned), set `disabled` when on History tab (`location.pathname.endsWith('/history')`), extend outlet context to `{ team, onSaveDeck, season, isCurrentSeason }`. |
| `client/src/pages/TeamDashboard.jsx` | Read `season` from outlet context. Add to all four fetches' URLs and to all four `useEffect` dep arrays. Change "Next Up" card: when `!isCurrentSeason`, render a "Season Summary" variant (final record + last game) instead of next/last game logic. The roster/stats/history cards stay the same structurally — they just refetch keyed by season. History card stays current-season-derived (it's franchise-wide, doesn't change per dropdown). |
| `client/src/pages/TeamRosterPage.jsx` | Read `season`, include in fetch URL, add to effect deps. Empty state copy: "No roster data available for the {season} season." |
| `client/src/pages/TeamStatsPage.jsx` | Read `season`, include in fetch URL, add to effect deps. The page already renders `{season} Team Stats` heading from the API response — confirm that displays the *selected* season. |
| `client/src/pages/TeamSchedulePage.jsx` | Replace `const currentYear = new Date().getFullYear()` with `const { season } = useOutletContext()`. Update both regular + playoff fetches. The `{currentYear} Schedule` heading becomes `{season} Schedule`. Decide on `needsPlayoffs` logic for past seasons — for past seasons, **always fetch playoffs** (the season is complete; if the team had playoff games they should display). |
| `client/src/pages/TeamHistoryPage.jsx` | **No code change.** Dropdown is disabled here, so reading it is a no-op. |
| `client/src/styles/*.css` | Add `.team-header-season-picker` styling (right-align in flex header, color matches team-color border). Add ≤480px media query to stack header column-wise. |

### 5.6 Per-spoke behavior matrix

| Spoke | season === current | season < current | season > current |
|---|---|---|---|
| **Dashboard** | Roster preview, stats preview, history preview, Next Up card with future/last game | Roster preview, stats preview, history preview, "Season Summary" card (final record, last game, playoff result if any) | Treated as invalid in the picker — not selectable. URL fallback applies. |
| **Roster** | Live current roster | Historical roster from ESPN | Not selectable |
| **Stats** | Current-season team stats | That season's team stats | Not selectable |
| **Schedule** | Regular + (optionally) playoffs for current year | Regular + playoffs always for past year | Not selectable |
| **History** | Multi-year table (unaffected by season) | Same (dropdown disabled) | n/a |

### 5.7 Caching strategy

**v1 strategy: in-process only.**
- `fetchTeamStats` already wraps `teamSeasonStatsCache` keyed by `${teamId}-${year}` — historical stats are cached for the life of the server process.
- `fetchTeamPtsAllowed` similarly cached via `teamPtsAllowedCache`.
- Roster (current and historical) is **not** in-process cached today beyond `rosterData[teamId]` which is current-only. For v1, accept that historical roster fetches hit ESPN every time. Watch latency in practice — if it's painful, layer a `historicalRosterCache` keyed by `${teamId}-${season}` using the same `withCache(...)` wrapper that's already in `espnClient.js:20`.
- Schedule has no caching today; not changing that.

**Why no MongoDB v1:** Historical seasons rarely change (a season's W/L record is fixed after final game). MongoDB caching for past-season roster/stats/schedule is the right long-term move but is an Option B concern. The dev-mode path also has to remain functional without MongoDB (see `historyAggregator.buildHistory` and `narrative` route fallbacks for the established pattern).

**Cache invalidation rule we're enforcing:** Current-year roster never reads from a stale cache — it always uses the live `rosterData[teamId]` map populated at startup. This preserves mid-season roster-change visibility for the current season.

### 5.8 Default-season + invalid-season handling

| URL state | Resolved season | URL action |
|---|---|---|
| `?season=` absent | `getCurrentSeason()` | None |
| `?season=2018` (valid for team) | 2018 | None |
| `?season=1995` (before founded) | `getCurrentSeason()` | None — silent fallback |
| `?season=2050` (future) | `getCurrentSeason()` | None — silent fallback |
| `?season=abc` (non-numeric) | `getCurrentSeason()` | None — silent fallback |

Silent fallback (rather than redirect) keeps the user's history stack clean and avoids loops if they navigate to a deep link they expected to work.

### 5.9 Mobile (≤480px)

- Header stacks column-wise; dropdown sits between name row and meta row.
- `<select>` is full width on mobile (max-width: 240px on desktop).
- Tab strip is already horizontally scrollable (presumed — verify in CSS pass).
- Test landscape orientation specifically: 480px width is portrait; landscape phones at 700-900px width should use the desktop layout.

---

## 6. SWEN axes + patterns

**Variability axes identified:**
1. **Season identity** — current vs past. This is *the* axis the feature adds. Surfaces in: data freshness (live vs immutable), card content (Next Up vs Season Summary), caching policy (in-memory only vs cacheable).
2. **Spoke type** — Dashboard / Roster / Stats / Schedule / History react differently to season. Captured in the per-spoke matrix.
3. **Franchise lineage** — current name vs historical alias. **Deferred to Option B.** Acknowledged but not implemented.

**Patterns used:**
- **Lifted state with shared context** (React Router outlet context): season state lives in `TeamPage`, propagated down — same pattern already used for `team` and `onSaveDeck`. No new mental model.
- **Single source of truth for "now"** (`getCurrentSeason()` helper): replaces three duplicated `new Date().getFullYear()` calls. SWEN: removing duplication that scattered the "what is current" decision.
- **Query-param-driven view state** (URL is the model): bookmarkable, refreshable, plays nicely with back/forward. Same pattern Schedule already uses internally.
- **Cache-aside with TTL fallback** (existing `withCache` wrapper): re-applied to historical roster if/when we add a cache. Not new — just extending the existing seam.

**Anti-patterns avoided:**
- Per-spoke season state (would force every spoke to mount a `<SeasonPicker>` and synchronize — broken on tab nav).
- Mutating header `team` object based on season (header is identity, not seasonal data — keep them separate).
- Building Option B's caching before the latency problem exists.

---

## 7. Implementation outline for builder

Order matters — backend first so the frontend has something to call.

1. **Verify ESPN's historical roster response shape.**
   - One-off curl to `https://site.api.espn.com/apis/site/v2/sports/basketball/wnba/teams/14/roster?season=2018` (Seattle Storm 2018).
   - Confirm whether full player metadata (headshot, jersey, height, weight, birthPlace, college) is present or whether only `id` + `position` come through. Record findings before coding.
2. **Extend `server/lib/espnClient.js`:**
   - If full metadata present: extend `fetchHistoricalRoster()` to return the full `fetchRoster()` shape. Update its existing caller in `historyAggregator` to either accept the richer object (most fields ignored) or pass a flag.
   - If metadata is thin: add a new `fetchSeasonRoster(teamId, season)` returning the rich shape, leaving `fetchHistoricalRoster` for aggregator use.
3. **Modify `/api/teams/:id/roster` in `server/routes/api.js`:**
   - Add `?season=` validation matching the `/stats` route pattern (404 invalid, default to current year if absent).
   - Branch: current year → `getRoster()` (existing). Past year → the new/extended fetcher.
   - Response shape unchanged: `{ team, players }`. Add `season` to the response for client confirmation.
4. **Create `client/src/lib/currentSeason.js`** with `getCurrentSeason()`.
5. **Create `client/src/constants/wnbaFoundedClient.js`** mirroring the server constant.
6. **Create `client/src/components/SeasonPicker.jsx`.**
   - Props: `value` (number), `onChange(year)`, `foundedYear` (number), `disabled` (bool).
   - Renders `<select>` with options from `foundedYear` to `getCurrentSeason()`, newest first.
7. **Modify `client/src/pages/TeamPage.jsx`:**
   - `const [searchParams, setSearchParams] = useSearchParams();`
   - Derive `selectedSeason` from `?season=` with validation + fallback.
   - Render `<SeasonPicker>` in `.team-header`.
   - `onChange`: `setSearchParams({ season: yyyy })`, preserving the pathname (i.e. stays on current spoke).
   - Disable picker when on `/history`.
   - Extend outlet context: `{ team, onSaveDeck, season: selectedSeason, isCurrentSeason: selectedSeason === getCurrentSeason() }`.
8. **Modify `TeamRosterPage.jsx`, `TeamStatsPage.jsx`, `TeamSchedulePage.jsx`:**
   - Read `season` from outlet context.
   - Append `?season=${season}` to fetch URLs.
   - Add `season` to `useEffect` dep arrays.
   - Update empty-state and heading strings to use `season`.
9. **Modify `TeamDashboard.jsx`:**
   - Same season-threading as above for the four card fetches.
   - Add the Season Summary variant for the Next Up card when `!isCurrentSeason`: show final record (derive from `regularEvents.filter(e => e.result).length` of W/L) + last game date + playoff result if available.
   - Leave the History card current-season-derived (it's franchise-wide).
10. **CSS pass:**
    - Add `.team-header-season-picker` styles.
    - ≤480px media query: stack `.team-header` children column-wise.
11. **Manual QA checklist:**
    - Load `/team/storm` (no season param) → dropdown shows current year, current roster loads.
    - Pick `2018` → URL updates to `?season=2018`, Roster shows Bird/Stewart/Loyd-era roster, Stats shows 2018 numbers, Schedule shows 2018 games incl. Finals.
    - Tab to History → dropdown disabled, history table renders normally.
    - Tab back to Roster → still on `?season=2018`, roster matches.
    - Bookmark `?season=2018/roster`, open in new tab → loads correctly.
    - Invalid URL `?season=1900` → dropdown shows current, page renders current data.
    - Mobile width (Chrome DevTools 375px) → header stacks, dropdown is tappable.

---

## 8. Risks + mitigations

| Risk | Lives in | Mitigation |
|---|---|---|
| ESPN's historical roster endpoint returns thin data for some seasons | `espnClient.fetchHistoricalRoster` | Detect missing fields in the response, render what we have. Roster card shows `?` headshot placeholder already. |
| Header shows current-season meta on past seasons — user confusion | `TeamPage.jsx` header line | Document as v1 limitation in a code comment. Option B addresses. |
| Dashboard "Next Up → Season Summary" derivation of final record assumes schedule API returns full regular-season events with `result` set on each | `TeamDashboard.jsx` | If `events.length === 0`, render "No game data for this season" placeholder. Already the empty-state pattern. |
| Dropdown disabled on History tab is invisible to users who haven't seen it enabled | `TeamPage.jsx` | Tooltip `title="History spans all seasons"`. Lower priority — visual disabled state should be self-explanatory. |
| Franchise alias names (e.g. "2006 Detroit Shock" while viewing Dallas Wings) are missing | Cross-cutting | Documented as deferred to Option B. Surface in user-facing docs or onboarding tip if it becomes a complaint. |
| `season` param threaded through outlet context could break existing tests that destructure `useOutletContext()` | Client | Verify destructuring uses `const { team, ... } = useOutletContext()` rather than positional access. Existing code already does. |
| Latency on rapid dropdown scrubbing through past seasons | Network | Acceptable for v1 — feature is "browse a specific season," not "scrub." Track if real-world usage demands cache. |
| Concurrent old fetches arriving after a new dropdown change | `useEffect` cleanup | All existing spokes already use `AbortController` cleanup — pattern is solid. New `season` in dep array ensures the previous controller aborts. |

---

## 9. Out of scope (explicit)

- Header line season-awareness (record / seed / conference for past seasons).
- MongoDB caching for past-season roster, stats, schedule.
- History-tab row-click → switch dropdown season.
- Franchise lineage name display ("2006 Detroit Shock" when viewing Dallas Wings).
- Coach data per season (not present in ESPN API today either).
- Player pages (`/player/:id`) being season-aware on cross-link from a past-season roster. Today they show the player's full career stats — that's correct and doesn't need to change.

These are documented for the user and tracked as Option B candidates. Per workspace memory, retired ideas would archive to `Archive/` — none retired here, all deferred.

---

## 10. Handoff

=== HANDOFF ===
did: Designed per-team season dropdown for KnowTheW with two options (lean MVP vs full fidelity); recommended Option A
found: `/api/teams/:id/stats` and `/schedule` already accept `?season=`; `/roster` does not — that's the one backend change. `fetchHistoricalRoster` exists but returns thin shape; needs verification or enrichment. `WNBA_FOUNDED` (server/constants/wnbaFounded.js) is the source for dropdown range. Three frontend files duplicate `new Date().getFullYear()` — centralize in a `getCurrentSeason()` helper. Header context line (record/seed) is current-season only and deferred to Option B with rationale.
files-touched: Projects/knowthew/DESIGN-team-season-dropdown.md
next-suggested-agent: backend-builder (start with verifying ESPN historical roster shape, then extend `/api/teams/:id/roster` + `espnClient`); then frontend-builder for SeasonPicker + TeamPage wiring + per-spoke threading
blockers: none — open question on whether ESPN's `roster?season=YYYY` returns full player metadata vs thin shape; builder verifies with one curl before choosing the 5.4a vs 5.4b implementation path
=== END HANDOFF ===
