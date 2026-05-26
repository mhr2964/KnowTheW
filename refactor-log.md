# Refactor Log — KnowTheW

**Skill:** `RefactorDeep` (`System/skills/refactor.md`), 12-category single-pass evaluation.
**Mode:** In-place on branch `refactor-pass` (not the skill's default sibling copy) — this is a live git repo on `master` we keep building features on, so git is the diff/comparison tool and this log carries the skill's required per-file reasoning.
**Source:** `C:/Users/Owner/Desktop/AI/Projects/knowthew`
**Date:** 2026-05-26
**Excluded:** `node_modules`, `client/dist` build artifacts, lock files, binary assets, `.playwright-mcp/`.

Categories: 1 I/O & Perf · 2 Error Handling & Correctness · 3 Security · 4 React Hooks & Rendering · 5 DRY & Cohesion · 6 Naming & Clarity · 7 Dead Code & Deps · 8 CSS · 9 HTML & a11y · 10 Server/API Design · 11 Architecture & File Structure · 12 Design Patterns.

> Note: `server/providers/**` was just rebuilt in the M0–M9 swappability refactor (Facade + Strategy + Factory + Adapter + Decorator). Per plan, Cat 11 re-architecture there is logged as an opportunity, not implemented.

---

## Area 1 — Server `lib/` + `routes/`

### `server/lib/anthropic.js` (NEW)
- **Created** a shared Anthropic SDK access layer: one-time client init (`@anthropic-ai/sdk`), `enabled` getter, and the `callWithRetry` transient-retry helper.
- **Reasoning:** Cat 12 (Singleton) + Cat 5 (DRY). `gradedReportClient.js` and `narrativeClient.js` each independently `new Anthropic(...)` with an identical defensive-init IIFE, and each carried a **verbatim copy** of `callWithRetry`. The skill's Singleton signal is exactly "multiple modules independently initializing the same API client." Centralizing init means the missing-key warning logs once (not twice) and there's a single client instance.
- **Potential Issues:** `enabled` is destructured (snapshot) by the two callers; this is safe because the init IIFE runs synchronously at first `require`, so `enabled` is final before either caller reads it and never changes afterward. If init were ever made async this assumption would break.

### `server/lib/gradedReportClient.js` — CHANGED
- Removed the local init IIFE + `callWithRetry`; now imports `{ getClient, callWithRetry, enabled }` from `./anthropic`. `callClaude` resolves the client via `getClient()`.
- **Reasoning:** Cat 5 dedup (see anthropic.js). Behavior identical: same key check → 503, same retry policy, same `enabled` re-export so the route's `gradedReportClient.enabled` is unchanged.
- **Potential Issues:** None functional. Warning text on missing key changed from `[gradedReportClient]` to `[anthropic]` (log-only).

### `server/lib/narrativeClient.js` — CHANGED
- Same extraction as gradedReportClient: dropped duplicate init + `callWithRetry`, imports from `./anthropic`, `getNarrative` uses `getClient()`.
- **Reasoning / Potential Issues:** as above.

### `server/routes/api.js` — CHANGED
- **`VALID_REPORT_MODES`** hoisted to a module-level `const Set` (was `new Set([...])` rebuilt inside the graded-report handler on every request). *Cat 1.*
- **`parseSeasonQuery(req)`** helper extracted; the identical "default to current year / accept 4-digit / else 400" block was repeated in the roster, season-info, and team-stats handlers. Returns `{ season, currentYear }` or `{ error }`. *Cat 5.*
- **`authorizeAdminRefresh(req)`** helper extracted; the constant-time `?refresh=1` + `x-admin-token` timing-safe check was duplicated verbatim in the graded-report and narrative handlers. One tested source for a security-sensitive comparison. *Cat 5 + Cat 3.*
- **Reasoning:** Three real duplications across the app's core route file. The season/admin extractions preserve control flow exactly (early-return on error / boolean result).
- **Potential Issues:** The team-stats handler's 400 example year changed from `"e.g. 2026"` to the unified `"e.g. 2024"` (cosmetic; no test asserts the string — `teams-route.test.js` only checks `/teams` status, `smoke.test.js` checks `/status`). The team-stats route still has **no** founding-year range check (unchanged — only roster/season-info do that check, after the shared parse).

### `server/lib/historyAggregator.js` — CHANGED
- Extracted **`buildSeasonRecord(teamId, teamName, year, { warnOnMismatch })`** — the per-year sequence (fetch standings → entry lookup → playoff fetch/derive → WNBA_CHAMPIONS override → record) that was duplicated between the cold-build (`aggregateHistory`) and warm-refresh (`buildHistory`) loops. Returns a tagged result (`no-standings` / `no-entry` / `ok`) so each caller keeps its own control flow and logging. *Cat 5.*
- **Reasoning:** ~30 lines of genuine duplication collapsed to one helper; data output is byte-identical. `warnOnMismatch` keeps the champion-mismatch warning cold-path-only (prior behavior).
- **Potential Issues:** In the rare playoff-fetch-failure case, the warm path's log prefix changed from `historyAggregator cache refresh: playoff fetch failed` to `historyAggregator: playoff fetch failed` (the helper uses one message). Log-only; data unaffected. This path has no direct unit test (fetch-coupled); guarded by lint + smoke and the byte-identical record shape.

### Reviewed and unchanged
- **`server/lib/advancedStats.js`**, **`statFormulas.js`** — dense, deliberate BRef/Oliver math, locked by characterization tests (`pbp-extract`, gamelog) and well-commented; already reuse `teamSeasonCache` helpers. Refactoring risks silent numeric regression for zero clarity gain.
- **`server/lib/statsParser.js`** — the three row-mappers (`avgMapToRow`/`totalsMapToRow`/`per36MapToRow`) map *different* field-name sets, so they aren't trivially DRY-able; structure is clear.
- **`server/lib/percentileClient.js`** — already source-agnostic; `getOrBuildDistribution` is a clean Proxy-style cache-aside with in-flight dedup. No findings.
- **`server/lib/gradedReportInputs.js`** — clean. Its advanced-row build mirrors `api.js` /advanced-pbp-all but the two have deliberately diverged (prompt bundle vs display payload); unifying would be a large, risky cross-file change in fetch-coupled, untested code → **logged as opportunity, not implemented** per Cat 12 proportionality.
- **`server/lib/seasonInfo.js`**, **`server/lib/ordinal.js`** — pure, single-responsibility, freshly organized in M9. No findings.
- **`server/lib/teamSeasonCache.js`** — clean cache-aside helper; the write-gate logic is well-documented. No findings.

---

## Area 2 — Server `providers/**` + `db.js` + `index.js`

### `server/providers/espn/playerStats.js` — CHANGED
- Extracted **`fetchAthlete(playerId)`** — `getPlayerBasics` and `getRetiredPlayer` opened with the identical 5-line fetch (`${ESPN_WEB}/athletes/${playerId}` → `res.ok` guard → `data.athlete ?? null`). Both now build their (different) shapes from the shared fetch. *Cat 5.*
- **Reasoning:** real duplication, mechanical and safe. **Potential Issues:** none; the two callers keep their distinct field mapping (basics has the `fullName`/`'Unknown'` fallback; retired does not).

### Reviewed and unchanged
- **`server/providers/espn/client.js`** — the HTTP layer. **Every `fetch()` has its `res.ok` guard before `.json()` (Cat 2 satisfied)**; `withCache` is the already-extracted Proxy helper; cache-staleness/refresh on `getTeams` is correct. URL params are built with template literals but every value (teamId, season, seasontype, eventId) is numeric and validated at the route boundary, so the Cat-2 "use URLSearchParams" point is a non-issue here — logged, not changed.
- **`server/providers/espn/gamelog.js`** — uses `URL`/`searchParams` for query building; pure transforms (`normalizeGameLog`, `extractGameLogEvents`) split out for characterization tests. Clean.
- **`server/providers/espn/gameSummary.js`** — the absorbed PBP/boxscore extraction; WNBA play-detection rules documented + characterization-tested. Clean.
- **`server/providers/espn/leagueStats.js`** — the fragile byathlete positional-index coupling, fully documented + characterization-tested; `fetchWithTimeout` uses AbortController correctly. The in-flight cache-dedup boilerplate repeats twice here (and once, with different null-caching, in `percentileClient.getOrBuildDistribution`) — a **Cat 12 Proxy/memoization opportunity logged but NOT implemented**: it's just-written code, the win is ~10 lines, the three instances differ in caching behavior, and the cache mechanics aren't test-covered (only the index mapping is), so a subtle dedup bug wouldn't be caught.
- **`server/providers/espn/index.js`** — the Facade mapping the contract onto `./client` + submodules; wraps with `withValidation` (M7). Clean (M9-current header).
- **`server/providers/index.js`** — Factory (`getProvider`) with memoization + fail-fast on unknown `STATS_PROVIDER`; test override seam. Clean.
- **`server/providers/SportsDataProvider.js`** — contract base class with throwing defaults (the M8 leak-test safety net). Clean.
- **`server/providers/sportradar/index.js`** — stub inheriting all throwing defaults. Clean.
- **`server/providers/types.js`** — JSDoc typedefs + `PBP_OC_KEYS` contract export. Clean.
- **`server/providers/schemas.js`**, **`server/providers/validation.js`** — M7 Zod schemas + the `withValidation` Proxy decorator; covered by `validation.test.js`. Clean.
- **`server/db.js`** — Singleton Mongo getter with test-skip + graceful-null degradation. Clean.
- **`server/index.js`** — minimal Express bootstrap. Verified the production static path `../client/build` matches `vite.config.js` `build.outDir: 'build'` (not a `dist` mismatch). Clean.

---

## Area 3 — Server `constants/`

No code changes — static frozen data + clean helper functions.

### Reviewed and unchanged
- **`server/constants/legacyPlayerBulk.js`** (4312L) — bulk historical dataset + helpers (`isBulkLegacyId`, `resolveLegacyId`, `searchBulkLegacyPlayers`, `buildBulkLegacyProfile`, `buildBulkLegacyDetailedStats`). Helpers are clear and single-purpose; the per-game/career row builders mirror the ESPN table shape deliberately. No findings.
- **`server/constants/wnbaAccolades.js`** — award maps + `getPlayerAccolades` (name-alias + last-first fallback matching) + a documented dev-mode `verifyAllWnbaFirstTeam` data-integrity guard. Clean.
- **`server/constants/wnbaChampions.js`** — champions map + `deriveAliasesFromLineage` cross-checked against an `EXPECTED_ALIAS_SNAPSHOT` (intentional boot-time data guard). Clean.
- **`server/constants/wnbaFranchiseLineage.js`**, **`wnbaFounded.js`**, **`leagueAverages.js`**, **`legacyTeamRosters.js`** — frozen lookup tables + small pure resolvers. Clean.
- **Cat 7 observation (logged, not changed):** several constants are exported but consumed only inside their defining module — `LEGACY_ID_REDIRECTS` (legacyPlayerBulk), `nameForYear` (franchiseLineage), and `LEGACY_TEAM_ROSTERS`/`BBREF_TO_ESPN`/`ESPN_TO_BBREF`/`DEFUNCT_ID_TO_TRICODE` (legacyTeamRosters) have zero external importers (grep-verified). Trimming the export surface is safe but near-zero-value churn on frozen data, so left as-is per the plan's "constants expected unchanged."

---

## Area 4 — Client `lib/` + `hooks/` + entry

No code changes — pure utilities and a textbook fetch hook.

### Reviewed and unchanged
- **`client/src/hooks/useLazyFetch.js`** — the shared fetch hook. **Correct `AbortController` cleanup** (abort on unmount/url change, plus a dedicated unmount-only effect), **`res.ok` guard before `.json()`**, functional `refetch` via `useCallback`, and a `fetchedRef` guard against refetch-after-success. Cat 2 + Cat 4 fully satisfied — this is the reference implementation other components should match.
- **`client/src/hooks/useRecentDecks.js`** — localStorage-backed; lazy `useState(load)` initializer, functional `setDecks` updates, `useCallback`-wrapped `saveDeck`. Clean.
- **`client/src/lib/{statsColumns,compareStats,statFormatters,currentSeason,gradeUtils,initials,statDefinitions}.js`** — pure, single-purpose modules with named lookup sets/maps. No findings. (`statsColumns.js` holds the client-side stat label/`PCT_COLS` knowledge that the plan's deferred "server emits `columns`/`STAT_COLUMNS`" decoupling would later relocate — out of scope for this pass.)
- **`client/src/main.jsx`** — standard React 18 `createRoot` + `BrowserRouter` + `StrictMode`. Clean.
- **`client/src/constants/{wnbaFoundedClient,wnbaFranchiseLineageClient}.js`** — frozen data **intentionally mirrored** from `server/constants/` (header comment says "update both"). Cross-tier duplication (Cat 5) is unavoidable without a shared package — client is ESM/Vite, server is CJS/Node. Logged, not changed.

---

## Area 5 — Client `components/` + `pages/` (JSX)

The client is exceptionally consistent. **Verification method:** grep-swept *every* `.jsx` for the cross-cutting concerns — raw `fetch(`, `<button`, `target=`, `<img`, deprecated JSX props, `dangerouslySetInnerHTML` — and read the large/complex/interactive components in full (App, TeamDashboard, ComparePage, GameLogTab, StudyFlow, HeaderTooltip). Findings below; one fix.

### `client/src/pages/ComparePage.jsx` — CHANGED
- `deriveLastTeamName` read the team abbreviation via the **magic positional index** `lastRow?.[1]` (with a comment "Index 1 is TEAM_ABBREVIATION per ESPN_DETAILED_HEADERS"). Replaced with a **name-based lookup off the response's own `headers`**: `table.headers?.indexOf('TEAM_ABBREVIATION')`. *Cat 6.*
- **Reasoning:** removes the client's dependency on the server's column *ordering* (a silent-break risk if headers are ever reordered). Behavior-identical today (`indexOf` returns 1). Distinct from — and a safe subset of — the plan's deferred "server emits an explicit `teamAbbr` field" decoupling.
- **Potential Issues:** none. Both the ESPN (`ESPN_DETAILED_HEADERS`) and bulk-legacy (`BULK_PG_HEADERS`) detailed-stats payloads carry `headers` with `TEAM_ABBREVIATION`; an absent header yields `idx = -1` → `null`, the same fallback as before.

### Reviewed and unchanged (highlights)
- **Cat 2 — every raw `fetch()` is correct.** All non-`useLazyFetch` fetches (App, TeamDashboard ×4, TeamStatsPage, TeamSchedulePage, TeamHistoryPage ×2, TeamRosterPage, SearchPage, GameLogTab, ComparePickerModal) use the same `r => { if (!r.ok) throw new Error(); return r.json() }` guard, an `AbortController` with a `controller.abort()` cleanup return, and `err.name !== 'AbortError'` filtering. No missing `res.ok`, no missing cleanup.
- **Cat 9 — every `<button>` carries an explicit `type`** (grep-verified across all JSX), and every `<img>` has either descriptive `alt` or `alt=""`+`aria-hidden` for decorative logos/headshots. No deprecated JSX props, no `dangerouslySetInnerHTML`.
- **Cat 4** — `StudyFlow` `useCallback`s `next`/`prev` (consumed by the keydown effect) and cleans up its listener; `useLazyFetch`/`useRecentDecks` covered in Area 4. No callbacks leak unstable refs into memoized children (the app doesn't lean on `React.memo`). Module-level constants (`STAT_GROUPS`, `GL_PAGE_SIZES`, `MONTH_NAMES`, `TEAM_ABBR_MAP`) are already hoisted.
- **`GameLogTab.jsx`** — custom multi-season fetch-cache (fetch-once-per-season keyed by a `Set`); richer than `useLazyFetch`'s single-URL model, so not a dedup candidate. Correct abort/res.ok/cleanup.
- **`HeaderTooltip.jsx`** — `useId` + full aria (`aria-label`/`aria-expanded`/`aria-describedby`/`role="tooltip"`) + portal + outside-click cleanup. Exemplary.
- The remaining presentational components (GradeGrid, GradeCard, BrefTable, ScheduleTable, CompareVerdict, CompareModeToggle, ComparePickerModal, RosterTable, AdvancedTab, RecentDecks, PremiumBanner, PlayerPage) and thin route pages (HomePage, SearchPage, TeamPage, Team{Roster,Stats,Schedule,History}Page, PlayerRoutePage, NotFoundPage) — grep-verified clean on all cross-cutting concerns; no findings.
