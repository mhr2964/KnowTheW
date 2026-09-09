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

---

## Area 6 — Client CSS

### `client/src/App.css` — DELETED (Cat 7, the largest single finding)
- Removed 2,625 lines of **orphaned dead CSS**. `App.css` is imported by nothing (`App.jsx` imports only `./styles/*.css`; grep across `.jsx/.js/.html/.css` found zero references), and git history shows it predates the CSS split in commit `c2fd366` ("refactor … CSS"). Its selectors are duplicated by the live `styles/*.css`.
- **Reasoning:** because it's never imported, none of its rules ever reached the DOM — deleting it provably cannot change rendering. Notably the live `styles/` total only 2,619 lines, so App.css was effectively a full stale duplicate of the entire stylesheet.
- **Potential Issues:** none for current behavior (verified by the post-deletion Playwright smoke — the app already rendered entirely from `styles/`). Recovery is `git show` if ever needed.

### `client/src/styles/global.css` + `player/team/compare/layout/shared.css` — CHANGED (Cat 8)
- Added five **semantic color custom properties** to `:root` (`--win`, `--loss`, `--error`, `--champion`, `--champion-text`) and replaced the repeated literals with them: `#4ade80` (win) and `#f87171` (loss) each appeared in 3 files (team/player/compare), `#e05555` (error) in 3 places (compare ×2, layout), and the champion golds `#c8960c`/`#e8c84a` across team.css. Also fixed one palette literal: a `#1a1a1a` gradient stop in shared.css → `var(--surface)`.
- **Reasoning:** these are values-that-must-stay-in-sync across files — the exact Cat-8 signal. A design tweak to the win-green or loss-red now happens in one place. Values are byte-identical, so rendering is unchanged.
- **Potential Issues:** none expected; confirmed visually via the final Playwright smoke (win/loss colors on gamelog + schedule, error states, champion rows on team history).

### Reviewed and unchanged
- The live `styles/*.css` already use the `:root` palette pervasively (var references: compare 155, team 101, shared 67, etc.), so most Cat-8 literal-promotion was already done. The remaining hardcoded hexes are genuine one-offs (`#fff`, dark gradient endpoints like `#1f1208`, single-use grade-band shades). **Not deeply audited:** exhaustive dead-rule detection (cross-referencing every selector against dynamic `className` usage) — high effort, high false-positive risk on dynamically-composed class names; left for a focused pass if needed.

---

## Area 7 — `test/`

Reviewed, no changes. The 7 test files (`smoke`, `teams-route`, `providers`, `validation`, `gamelog-normalize`, `leaguestats-map`, `pbp-extract`) are clear, well-commented characterization + contract tests — the safety net for this whole pass. The only repetition is standard per-file boilerplate (`process.env.NODE_ENV='test'`, the `node:test`/`assert` requires), which is intentionally kept so each file runs independently. Touching passing tests to dedupe boilerplate would weaken the net for no real gain.

---

## Summary

First `>>refactor` pass on KnowTheW (no prior pass to compare against — convergence note N/A). The codebase was found **exceptionally clean** — unsurprising, since the server `providers/` tree was just rebuilt in the M0–M9 swappability refactor and the client follows one disciplined pattern throughout. The high-value findings were concentrated, not scattered.

**Files changed: 13 (+1 new, −1 deleted). Reviewed-and-unchanged: ~60.**

Findings applied, by category:
- **Cat 1 (I/O & Perf):** 1 — hoisted `VALID_REPORT_MODES` Set to a module constant (api.js).
- **Cat 2 (Error/Correctness):** 0 changes — **verified clean**: every `fetch()` (server provider + every client site) guards `res.ok`; every client effect aborts via `AbortController` with a cleanup return.
- **Cat 3 (Security):** folded into Cat 5 — the timing-safe admin-refresh check now lives in one place (`authorizeAdminRefresh`).
- **Cat 4 (React hooks):** 0 changes — hooks already correct (`useLazyFetch` cleanup, `useCallback` where it matters, hoisted option/constant objects).
- **Cat 5 (DRY & Cohesion):** 5 extractions — `server/lib/anthropic.js` (shared client + `callWithRetry`, killing two verbatim copies), `parseSeasonQuery` (3 route handlers), `authorizeAdminRefresh` (2 handlers), `buildSeasonRecord` (historyAggregator cold+warm), `fetchAthlete` (playerStats).
- **Cat 6 (Naming/Clarity):** 1 — ComparePage magic index `row[1]` → name-based `headers.indexOf('TEAM_ABBREVIATION')`.
- **Cat 7 (Dead code):** 1 major — deleted `client/src/App.css` (2,625 orphaned lines). Logged-not-changed: over-broad constant exports.
- **Cat 8 (CSS):** semantic color custom properties (`--win/--loss/--error/--champion/--champion-text`) extracted from literals repeated across 3+ files; one `--surface` gradient fix. (Palette was already well-established.)
- **Cat 9 (HTML/a11y):** 0 changes — **verified clean**: every `<button>` typed, every `<img>` has deliberate `alt`/`aria-hidden`, no deprecated JSX props.
- **Cat 10 (Server/API):** 0 changes — route ordering + status codes already correct (literal `/teams/legacy` before dynamic segments; 400/404/502 used deliberately).
- **Cat 11 (Architecture):** 0 changes — the `providers/` tree was just deliberately structured (Facade + Strategy + Factory + Adapter + Decorator); per plan, no re-architecture.
- **Cat 12 (Design Patterns):** 1 implemented (Singleton — shared Anthropic client). Logged-not-implemented (proportionality): the in-flight cache-dedup Proxy in `leagueStats`/`percentileClient`, and the advanced-row builder shared between `api.js` and `gradedReportInputs`.

Net effect: ~2,650 fewer lines (almost all the dead App.css), several duplications collapsed to single sources of truth (notably the Anthropic client and the security-sensitive admin check), and one client→server coupling (column ordering) removed — with no behavior change, gate green at every area, and a full Playwright smoke at the end.

---

# Pass 2 — 2026-07-18

**Skill:** `RefactorDeep` (`System/skills/refactor.md`), 12-category single-pass evaluation.
**Mode:** In-place on branch `refactor-pass-2`, same deviation from the skill's default sibling-copy mode as Pass 1 — this is a live git repo we keep shipping features on, so git is the diff/comparison tool.
**Scope deviation (deliberate):** Pass 1 covered the whole repo. Everything reviewed then is either unchanged since (~84 files) or already re-reviewed by whichever sub-area touched it. Rather than re-deriving 8 weeks of already-vetted code from scratch, this pass scoped to the **64 files actually changed** between the Pass 1 completion commit (`73e098d`, 2026-05-26) and now (`git diff --name-only 73e098d HEAD`) — new features (archetype badges, cross-era similarity, the BBRef-style Play-by-Play tab, the business/launch roadmap's legal pages, and this session's CSV export + game-splits work) that had never been checklist-reviewed. The other ~84 files were not re-opened; they're covered by Pass 1's own entries above.
**Execution:** dispatched 5 parallel agents, each in an isolated git worktree, over disjoint file buckets (client components / client pages+styles / server analysis+stats layer / server routes+providers / test suite), each running the full 12-category checklist plus `npm run lint` + `npm test` after every edit. Each agent's branch was reviewed, committed, and merged into `refactor-pass-2` individually; the full `npm run check` (lint + 172/172 tests) plus `npm run build` plus a live Playwright smoke pass (player page, sorting, CSV export, Compare search) were re-run on the fully merged result before this log was written.
**Excluded:** `node_modules`, `client/build`, lock files, binary assets, `.playwright-mcp/`.

---

## Area 1 — Client components (`client/src/components/`, `App.jsx`)

### `client/src/components/ComparePickerModal.jsx` — CHANGED, real bug fix
- **Cat 2 (Error Handling and Correctness).** The search-debounce effect built its `AbortController` *inside* the `setTimeout` callback and returned `() => controller.abort()` from inside that callback — `setTimeout` ignores callback return values, so that "cleanup" never actually ran on unmount/re-run. The effect's real cleanup only cleared the pending timer, never an already-in-flight fetch.
- **Failure mode this caused:** if the debounce had already fired and a fetch was in flight, and the user typed again before it resolved, the stale fetch was never aborted. An out-of-order response could land after a newer one and overwrite `results` with results for an earlier keystroke.
- **Fix:** moved `AbortController` construction into the effect body (outside `setTimeout`); cleanup now does both `clearTimeout(timer)` and `controller.abort()` — matching the already-correct pattern in `GameLogTab.jsx`/`SplitsTab.jsx` in the same file set.
- **Verified:** lint clean, 172/172 tests green, and live Playwright — typed "wilson" into the Compare modal, got correct results with zero console errors.

### `client/src/components/LegalFooterNav.jsx` — CHANGED
- **Cat 1 (I/O and Performance).** The 4-object `links` array was rebuilt on every render for data that never changes. Hoisted to a module-level `LEGAL_LINKS` constant.

### Reviewed and unchanged
`App.jsx`, `AdvancedTab.jsx`, `ArchetypeBadge.jsx`, `BrefTable.jsx`, `DetailedStats.jsx`, `FingerprintRadar.jsx`, `GameLogTab.jsx`, `OnOffTab.jsx`, `PlayByPlayTab.jsx`, `PlayerPage.jsx`, `RosterTable.jsx`, `SimilarPlayersSection.jsx`, `SplitsTab.jsx` — all clean; each respected the file's own documented traps (`BrefTable`'s intentional `eslint-disable` on `sortedRows`'s deps, `DetailedStats`'s seed-once `initialTab`, `RosterTable`'s dual-path row-click/keyboard-button interaction, `GameLogTab`'s deliberately-unparsed combined make-attempt strings).

**Logged, not implemented:** a shared `useKeyedFetchCache` hook could remove ~25 lines of duplicated fetch-cache-per-key boilerplate across `GameLogTab`/`SplitsTab`/`OnOffTab` — the clean home for it (`client/src/hooks/`) was outside this agent's assigned files. `DetailedStats.jsx`'s tab-type ternary chain is a plausible Strategy/lookup-map candidate, but the branches take heterogeneous props and share extra JSX in the fallback case — a map-based rewrite would add more code than it removes.

---

## Area 2 — Client pages + styles (`client/src/pages/`, `client/src/styles/`)

### `client/src/pages/PlayerRoutePage.jsx` + `SimilarPlayersPage.jsx` — CHANGED
- **Cat 1/5.** Both pages rebuilt an identical inline style object (`{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '2rem 0' }`) on every render for their error-with-retry message. Extracted to one `.status-msg--retry` class in `layout.css`, applied via `className` on both.

### `client/src/pages/PrivacyPage.jsx` — CHANGED
- **Cat 3 (Security).** The two `target="_blank"` ad-opt-out links (Google Ads Settings, aboutads.info) had `rel="noreferrer"` only. Added `noopener` explicitly — not an active vulnerability in current browsers, but now literally matches the checklist's `rel="noopener noreferrer"` requirement rather than relying on `noreferrer` implying it.

### `client/src/styles/player.css` — CHANGED
- **Cat 8 (CSS).** `.pbp-stat-value--good/--bad` referenced `var(--color-positive, #4caf50)`/`var(--color-negative, #e53935)` — custom properties declared nowhere in the codebase, so the rule always silently fell through to the fallback, duplicating (with slightly different hex values) the already-established `--win`/`--loss` vars used two lines away by `.gl-win`/`.gl-loss`. Switched both to `var(--win)`/`var(--loss)`.
- Four `.onoff-*` rules called `var(--win, #4caf72)`/`var(--loss, #e05252)` with fallbacks that can never trigger (`--win`/`--loss` are always defined at `:root`) and don't even match the real color. Dropped the dead fallbacks.

### Reviewed and unchanged
`AboutPage.jsx`, `DataSourcesPage.jsx`, `TermsPage.jsx` (deliberately near-duplicate legal-page structure, left as-is), `HomePage.jsx`, `ComparePage.jsx`, `compare.css`, `team.css`, `shared.css`, `legal.css`, `layout.css` (beyond the added modifier).

**Logged, not implemented:** `espnHeadshotUrl(id)` duplicated verbatim (3 lines) in `ComparePage.jsx` and `SimilarPlayersPage.jsx`; `handleBack()` duplicated verbatim across three route pages — both are exactly the "three similar lines can beat a premature abstraction" case, and their clean shared home (`client/src/lib/`/`hooks/`) sat outside the assigned file set. **Cross-file observation:** `PlayerRoutePage.jsx`'s `VALID_TABS` Set must stay in sync with `DetailedStats.jsx`'s `ALL_TABLE_TYPES`/`SOURCE_ACTIVE` — confirmed as the real dual-registration risk that caused the Splits-tab redirect bug fixed earlier this session; a single shared tab-definitions constant would eliminate the class of bug, but needs a coordinated change across both files (see "Do not touch" note in `HANDOFF.md`).

---

## Area 3 — Server analysis/stats layer (`server/lib/analysis/`, `onOffClient.js`, `pbpStatsClient.js`, `percentileClient.js`, `seasonWindow.js`, `advancedStats.js`, `gradedReportInputs.js`)

The highest-risk bucket — dense, characterization-tested basketball-stat math. Changes here were deliberately restricted to mechanical extraction (no arithmetic touched).

### `server/lib/analysis/onOff.js` + `server/lib/analysis/playerFingerprint.js` — CHANGED
- **Cat 1/6.** Each redefined a pure rounding helper (`round1`/`r1`) inside its compute function on every call, with no closure capture. Hoisted both to module scope — `playerFingerprint.js`'s `r1` alone was being recreated on every one of ~700 fingerprint builds during a full index rebuild. Verified behavior-identical against `onoff.test.js` and `fingerprint.test.js`/`archetype-truth-set.test.js` (24/24 truth-set cases still pass).

### `server/lib/percentileClient.js` — CHANGED
- **Cat 5.** Extracted `groupByPosition(entries)` (a 4-line all/G/F/C bucketing block duplicated verbatim in `buildLeagueDistribution` and `enrichWithIndividualStats`) and `indexedSeasonRange()` + `FIRST_INDEXED_SEASON = 2011` (a 3-line season-range loop duplicated in `warmDistributionCache` and `buildPlayerIndex`). Both are grouping/looping-only extractions — no arithmetic touched. No direct unit tests cover this file's internals; residual risk disclosed rather than hidden — the full suite staying green confirms no load-time/syntax regression, manual review confirms byte-identical logic.

### Reviewed and unchanged
`archetypes.js`, `pbpStats.js`, `pbpTable.js`, `similarity.js`, `onOffClient.js`, `pbpStatsClient.js`, `seasonWindow.js` (untouched per explicit instruction — `isPastSeason`/`latestCompletedSeason` are deliberately distinct), `advancedStats.js` (the densest file — no changes).

**Logged, not implemented:** `onOffClient.js`/`pbpStatsClient.js` are near-identical cache-aside wrappers (Template Method candidate) with no direct test coverage of their caching mechanics — same caution Pass 1 applied to `leagueStats`/`percentileClient`. `advancedStats.js`'s repeated `stat * GAME_MINUTES / (mp * denom)` scaling idiom (~9 occurrences) is a clean DRY case that directly touches the Oliver-formula lines this pass was told to treat as highest-risk — logged, not implemented. A recurring `Object.fromEntries(headers.map((h,i)=>[h,i]))` header-index idiom appears in `gradedReportInputs.js`, `advancedStats.js`, `pbpTable.js`, and `api.js` — its natural home (`statsParser.js`) and heaviest consumer (`api.js`) both sat outside this bucket; logged for a cross-bucket follow-up. `round1`/`r1`/`r3` rounding-helper variants across 5 files were hoisted *within* each file but not merged *across* files (subtly different null-handling per variant). `MIN_ON_GAMES = 5` is duplicated with an identical value in `onOff.js` and `pbpStats.js` gating two different aggregates — may be coincidentally equal rather than a shared tunable; not merged, per the `seasonWindow.js` precedent for similar-looking-but-independent thresholds.

---

## Area 4 — Server routes + providers (`server/routes/api.js`, `statColumns.js`, `statsParser.js`, `gameSplits.js`, `providers/`, `legacyPlayerBulk.js`, `scripts/`, `package.json`)

### `server/routes/api.js` — CHANGED
- **Cat 1.** Hoisted the `/players/:id/splits` type whitelist (`['homeaway','month','opponent'].includes(...)`) to a module-level `VALID_SPLIT_TYPES` Set, alongside the existing `VALID_REPORT_MODES` — the exact sibling of the pattern Pass 1 already fixed once in this same file.
- **Cat 5/10.** `/players/:id/graded-report`'s `careerYearRange` was computed twice with identical logic across the cache-hit and fresh-Claude-call branches. Moved the computation once, before the cache lookup; both paths now reuse it. Behavior-identical (`inputs.seasonRows` doesn't change between branches).

### `server/providers/espn/leagueStats.js` — CHANGED
- **Cat 2.** `getPlayerSeasonAverages` used a bare `fetch()` with no timeout, while every other call in the same file already uses its own `fetchWithTimeout` helper. Brought it in line — prevents an unbounded hang on a slow ESPN response.

### Reviewed and unchanged
`statColumns.js`, `statsParser.js`, `gameSplits.js` (new this session — matches the documented deliberate design), `SportsDataProvider.js`, `providers/espn/index.js`, `providers/espn/gameSummary.js` (the `foulDrawnOff`/`blkd`-stay-null pattern looked like a bug on first read, confirmed intentional per `pbpTable.js`'s nullable-when-provider-can't-supply handling), `providers/types.js`, `legacyPlayerBulk.js` (bulk data itself not re-reviewed, per Pass 1 precedent), `scripts/seed-distributions.js`, `scripts/seed-fingerprints.js`, `package.json` (Cat 7 dependency check: all 6 `dependencies` confirmed imported somewhere under `server/`/`scripts/` — none unused).

**Logged, not implemented:** `getSeasonPBPSummary` sums all 27 `PBP_OC_KEYS` into `totOC` but only ~16 are read back out — harmless (inert, no `NaN` risk) but wasted computation on a just-written method; left alone since restructuring risks behavior change in `advancedStats.js`, out of this bucket's scope. `/players/:id/onoff` and `/players/:id/pbp-stats` parse `?season=` via a silent `Number(...) || currentYear` fallback rather than the shared `parseSeasonQuery` helper — confirmed as a deliberate deviation (no 400 rejection wanted there), not a reinvention, so left unchanged; flagged as worth a design conversation if strict validation is ever wanted on those two routes.

---

## Area 5 — Test suite (`test/`)

**Ground rule respected throughout:** never change what a test asserts or what fixtures it uses — only structural/DRY cleanup of the test code itself.

### `test/fingerprint.test.js` — CHANGED
- **Cat 5.** Extracted `fpInput(season, totals)`, replacing 4 call sites that repeated an identical nested `{percentiles, seasonAverages}` object construction verbatim, varying only the season totals. A 5th, similar-looking two-season block was left inline — it doesn't fit the single-season helper shape without adding complexity for one use site.

### Reviewed and unchanged
`archetype-truth-set.test.js`, `archetypes.test.js`, `detailed-stats-columns.test.js`, `onoff.test.js`, `pbp-extract.test.js`, `pbp-stats.test.js`, `pbp-table.test.js`, `providers.test.js`, `season-window.test.js`, `similarity.test.js` — all already carry the shared-fixture-helper pattern Cat 5 would otherwise ask for. No stray `.only`/`.skip` found anywhere in the set.

**Flagged, not fixed (source-adjacent finding, correctly deferred by the reviewing agent):** `test/onoff.test.js`'s `'off-court stats sum to game total minus on-court'` test name and inline comment claim to verify the on/off-split-vs.-game-total invariant, but its actual assertions only check that `result.off.ortg`/`result.on.ortg` are non-null — never any arithmetic relationship. The test would still pass even if the off-court subtraction logic were wrong, as long as it produced *some* non-null ORTG. Not strengthened here (would change what the test asserts, outside this pass's ground rule for test files) — worth a deliberate follow-up decision on whether to add a real arithmetic assertion.

---

## Pass 2 Summary

**Scope:** 64 files (changed since Pass 1) reviewed in full across 5 parallel agents; the other ~84 files from the full repo were left to Pass 1's existing entries, not re-derived.
**Files changed: 9.** Reviewed-and-unchanged: 55.

Findings applied, by category:
- **Cat 1 (I/O & Perf):** 3 — `LegalFooterNav`'s links array, `round1`/`r1` rounding helpers (onOff.js, playerFingerprint.js), `VALID_SPLIT_TYPES` in api.js.
- **Cat 2 (Error/Correctness):** 2 real fixes — the `ComparePickerModal` stale-fetch race (the one true bug this pass found), and `getPlayerSeasonAverages`'s missing fetch timeout.
- **Cat 3 (Security):** 1 — explicit `noopener` on the Privacy page's two ad-settings links (belt-and-suspenders, not an active vuln).
- **Cat 4 (React Hooks):** 0 changes — verified clean across the whole client bucket.
- **Cat 5 (DRY & Cohesion):** 4 — `groupByPosition`/`indexedSeasonRange` (percentileClient.js), the shared `.status-msg--retry` class (2 pages), `careerYearRange` dedup (api.js), `fpInput` fixture helper (fingerprint.test.js).
- **Cat 6 (Naming/Clarity):** folded into the Cat 1/5 entries above — no standalone renames needed.
- **Cat 7 (Dead code/Deps):** 0 changes needed — `package.json` dependency check came back clean.
- **Cat 8 (CSS):** 2 — `.pbp-stat-value--good/--bad` pointed at an undefined custom property that always silently fell through to its fallback; 4 `.onoff-*` rules carried dead/mismatched fallbacks. Both fixed to reference the real `--win`/`--loss` vars directly.
- **Cat 9 (HTML/a11y):** 0 changes beyond the Cat-3 `rel` fix — verified clean otherwise.
- **Cat 10 (Server/API):** 1 — `careerYearRange` double-computation in the graded-report route (see Cat 5).
- **Cat 11 (Architecture):** 0 changes — no file in the changed set approached the 400-line split threshold in a way that warranted it.
- **Cat 12 (Design Patterns):** 0 implemented. Several genuine candidates logged-not-implemented across every bucket (see Areas 1–4) — consistently for the same two reasons Pass 1 also cited: the clean shared home for the extraction sat outside the assigned file bucket, or the risk-to-benefit ratio on dense/uncovered code didn't clear the proportionality bar.

**Convergence note:** this pass found 1 real behavior bug (the Compare-modal race) plus 8 small, low-risk mechanical improvements across 64 files that had never been checklist-reviewed before — a real, though modest, yield. It is not a "2-or-fewer, codebase has converged" result, but it's consistent with a codebase that's already been through one thorough pass: no repeated Cat-1/2/9 violations at scale, no new dead-code sprawl, and every "logged, not implemented" item was logged for a legitimate proportionality or cross-file-coordination reason rather than left out for lack of looking.

**Verification:** full `npm run check` (lint + 172/172 tests) on the fully merged `refactor-pass-2` branch, `npm run build` clean, and a live Playwright smoke pass (Per Game table sort/CSV export/Career-row pinning, Splits tab across all three split types, Compare-picker search) — all correct and byte-identical to pre-refactor output where compared directly.

---

# Pass 3 — 2026-09-07

**Trigger:** user feedback ("i see lots of inconsistancy visually and in general this is not professional") after a long session that shipped ~11 commits of new nav/UI/data features (BBRef-style nav dropdowns, mobile accordion, Players/Schedule/Playoffs/Season-Stats hubs, head-to-head grid, player awards trophy case, team game chart) directly on `master`. User granted explicit "creative freedom" for this pass.

**Mode:** in-place on branch `refactor-pass-3`, off `master` at `c8f6a0c` (all of that session's commits, including two follow-up bugfix commits from the user's own live-testing feedback). Same reasoning as Pass 1/2 for staying in-place rather than the skill's default sibling copy.

**Scope decision (stated up front, not discovered after the fact):** the literal skill instructions call for evaluating all ~350 tracked files. Two things changed that plan:
1. Pass 1 and Pass 2 already gave ~290 of those files a full checklist pass, and neither this session's git history nor a spot-check of unrelated files (`ComparePage.jsx`, `TeamStatsPage.jsx`, `percentileClient.js`) showed drift since — re-deriving findings Pass 1/2 already logged would not be genuine new evaluation.
2. The user's actual complaint ("visual inconsistency," "not professional") pointed at Cat 8 specifically, and investigating it surfaced something bigger than a per-file issue (see Area 1).

So this pass did a full 12-category evaluation of the 31 files touched by this session's 11 commits (where new-code drift actually lives), plus the depth-first Cat 8 investigation below, which by its nature had to span every CSS file, not just the 31. The other ~319 files are left to Pass 1/2's existing entries. This is a narrower scope than the skill's literal instructions — stated here rather than silently substituted.

## Area 1 — Cat 8, site-wide: the type scale existed but was never adopted

`global.css` already declares a type scale (`--text-2xs` through `--text-2xl`) and `--tracking-label`, with its own comment explaining why: *"Font sizes across styles/*.css had drifted into ~30 distinct values for what were mostly a handful of intended tiers... these steps are the scale going forward."* Checked whether "going forward" had actually happened: it hadn't. A tally across every `styles/*.css` file found **39 distinct hardcoded `font-size` values** and **8 distinct hardcoded label-tracking `letter-spacing` values** still in use — including in files Pass 1/2 already reviewed and in every file this session added. This is almost certainly the concrete shape of "looks inconsistent, not professional": dozens of near-identical text sizes (0.78/0.8/0.82/0.84/0.85/0.86/0.88rem all rendering as "the same size, sort of") scattered with no discipline, plus 8 different letter-spacing values all serving the identical "uppercase eyebrow label" role.

- **Changed (Cat 8):** every hardcoded `font-size` and label `letter-spacing` value across `auth.css`, `compare.css`, `layout.css`, `legal.css`, `player.css`, `responsive.css`, `shared.css`, `standings.css`, `team.css` — **233 individual declarations** — mapped to the nearest step in the existing scale (nearest-token by absolute rem distance; ties broken toward the larger step). Full mapping: 0.5/0.55/0.58/0.6/0.62/0.65/0.66/0.68 → `--text-2xs`; 0.7/0.72/0.73/0.74/0.75/0.76 → `--text-xs`; 0.78/0.8/0.82/0.84/0.85/0.86/0.88 → `--text-sm`; 0.9/0.92/0.94/0.95 → `--text-base`; 1/1.05/1.1 → `--text-md`; 1.15/1.2/1.25/1.3/1.35 → `--text-lg`; 1.4/1.5/1.6 → `--text-xl`; 1.75/2 → `--text-2xl`. Letter-spacing 0.03/0.04/0.05/0.06/0.08/0.1/0.12em (all uppercase-label contexts) → `var(--tracking-label)`.
- **Reasoning:** this is the textbook Cat 8 signal (`global.css`'s own comment states the intent) at a scale neither prior pass caught, because neither was looking for "declared design token, never migrated" — Pass 1 covered *color* literal consolidation (Cat 8's other half) and explicitly noted the type scale wasn't yet a thing to check for.
- **Deliberately not touched:** `.player-hero-img.placeholder`'s `2.4rem` (hero-avatar initials, legitimately above the scale's top step, same "genuine one-off" carve-out Pass 1's Area 6 used) and `.logo-sub`'s `0.15em` (brand wordmark tracking — the global.css comment's own drift range tops out at 0.15em as the *widest* observed value, and collapsing the brand mark's deliberately more dramatic spacing into the generic label token would be a real, visible identity change, not a consolidation). Two `em`-relative sizes (`.bref-sort-indicator`, `.stat-help-mark`) left alone — relative-to-parent by design, a different mechanism than the literal-rem drift this pass targeted.
- **Potential Issues:** a small number of values moved 2-6% in either direction where several near-duplicate literals were deliberately collapsed onto one token (e.g. 0.85/0.86/0.88rem all now render at 0.82rem) — confirmed visually via a live smoke pass (Home, a player page, a team dashboard, the roster table) with no perceptible or broken layout change. This was an automated batch substitution (not a per-line manual edit), verified by full `npm run build` + `npm run lint` clean immediately after, plus the live smoke pass; a wider Percy/screenshot-diff pass across every page was not run (out of scope for this turn).

## Area 2 — Cat 5, session-scoped: duplicated date formatting

- **Created `client/src/lib/dateFormat.js`.** `ScheduleTable.jsx` (pre-existing), `OddsHubPage.jsx` (pre-existing), and this session's `ScheduleHubPage.jsx`, `PlayoffsHubPage.jsx`, and `TeamDashboard.jsx` each independently declared their own `DAY_NAMES`/`MONTH_NAMES` arrays and a `formatDate`/`fmtDateShort`/`formatTime` function — three genuinely distinct formats (`"Sun Sep 17"`, `"Sep 17"`, `"9/17"`) duplicated 5 times combined. This session's three new files copied an already-duplicated pattern instead of consolidating it.
- **Changed:** all 5 files now import `formatDateWithDay` / `formatDateMonthDay` / `formatDateNumeric` / `formatTime` from the new shared module (aliased at the import site in files that already had local names like `formatDate`, so callsites needed no further changes). Kept the three formats as separate named exports rather than one options-bag formatter — each callsite already knows which one it wants; an options bag would just move the duplication into the call arguments.
- **Potential Issues:** none — byte-identical output, confirmed by reading each original implementation before extracting.

## Area 3 — Cat 11, session-scoped: `SearchBar` had no file of its own

- **Created `client/src/components/SearchBar.jsx`**, moved the `SearchBar` function (added this session, ~125 lines including the live-suggestions logic) out of `App.jsx` verbatim. Every other component in this codebase — including every other component this same session added (`NavDropdown`, `MobileNav`, `Breadcrumbs`, etc.) — gets its own file; `SearchBar` was the one exception, defined inline in the app shell.
- **Reasoning:** Cat 11 (file structure) + Cat 6 (consistency with the codebase's own established convention). `App.jsx` dropped from 393 to 259 lines.
- **Potential Issues:** none — verified via `npm run build` (identical JS bundle size) immediately after.

## Area 4 — Full 12-category pass, the 31 files this session touched

Read in full: `App.jsx`, `Breadcrumbs.jsx`, `HeadToHeadGrid.jsx`, `MobileNav.jsx`, `NavDropdown.jsx`, `PlayerAwardsBadges.jsx`, `PlayerPage.jsx`, `RosterTable.jsx`, `TeamChampionBadge.jsx`, `TeamGameChart.jsx`, `headToHead.js`, `navEntries.js`, `playoffSeries.js`, `PlayersDirectoryPage.jsx`, `PlayoffsHubPage.jsx`, `ScheduleHubPage.jsx`, `SeasonStatsPage.jsx`, `StandingsPage.jsx`, `TeamDashboard.jsx`, `TeamPage.jsx`, plus the 5 CSS files and 6 server files from the same commit range.

- **Cat 9 (a11y):** checked every new `<button>` for an explicit `type` — all correct (3 multi-line JSX button tags initially looked suspicious under a single-line grep; verified by reading full context, all three do have `type="button"` on the next attribute line).
- **Cat 2 (Error/Correctness):** every new `fetch()` guards `res.ok`; every new effect that fetches uses `AbortController` with a cleanup return (`HeadToHeadGrid`, `TeamChampionBadge`, `TeamGameChart`, `PlayerAwardsBadges`, `SearchBar` all verified individually).
- **Cat 11 (Architecture):** `server/providers/balldontlie/index.js` sits at 499 lines (this session added ~230 of those). Same call as Pass 1's Area 2: it's the deliberately-structured M0-M9 swappability facade — a real split needs multi-file coordination disproportionate to this pass. Logged as an opportunity, not implemented, consistent with the standing precedent.
- **Reviewed and unchanged:** `headToHead.js`, `playoffSeries.js`, `navEntries.js`, `RosterTable.jsx`, `Breadcrumbs.jsx`, `HeadToHeadGrid.jsx`, `TeamChampionBadge.jsx`, `StandingsPage.jsx`, `PlayerPage.jsx`, the 6 touched server files — no findings beyond what's already logged in Areas 1-3 above.

## Pass 3 Summary

**Scope:** 31 session-touched files given a full 12-category pass, plus a depth-first Cat 8 audit spanning all 11 CSS files (9 of them changed). The other ~319 files in the repo are left to Pass 1/2's existing entries — explicitly not re-derived this pass (see Scope decision above).

**Files changed: 15** (9 CSS files, `App.jsx`, 5 files updated to use the new `dateFormat.js`, plus 2 new files: `dateFormat.js`, `SearchBar.jsx`). Reviewed-and-unchanged: 16 (the rest of the 31-file session scope).

Findings applied, by category:
- **Cat 1 (I/O & Perf):** 0 — verified clean across the session-scoped files.
- **Cat 2 (Error/Correctness):** 0 changes needed — verified clean (see Area 4).
- **Cat 3 (Security):** 0 — no new external links or user-controlled paths in this session's files.
- **Cat 4 (React Hooks):** 0 changes — every new effect's dependency array was already correct on inspection.
- **Cat 5 (DRY & Cohesion):** 1 extraction — `dateFormat.js`, collapsing 5 duplicate implementations (Area 2).
- **Cat 6 (Naming/Clarity):** folded into Area 3 (SearchBar's file placement was the naming/consistency finding, not a rename).
- **Cat 7 (Dead code/Deps):** 0 — no new unused imports or dependencies found in the session scope.
- **Cat 8 (CSS):** the pass's real finding — 233 hardcoded font-size/letter-spacing declarations across 9 files consolidated onto the existing (but until now unused) type-scale tokens (Area 1).
- **Cat 9 (HTML/a11y):** 0 changes — verified clean (Area 4).
- **Cat 10 (Server/API):** 0 — the session's new routes (`/league/schedule`, `/league/season-stats`, `/players/:id/awards`) already follow this codebase's established route conventions (checked against Pass 1's Cat 10 findings, none recur).
- **Cat 11 (Architecture):** 1 extraction — `SearchBar.jsx` (Area 3). 1 logged-not-implemented — `balldontlie/index.js`'s 499 lines, same standing precedent as Pass 1.
- **Cat 12 (Design Patterns):** 0 implemented, 0 new candidates found in the session scope beyond what Pass 1/2 already logged.

**Convergence note:** not applicable in the usual sense — this pass deliberately scoped to new code + one deep cross-cutting Cat 8 investigation rather than the full repo, so a raw "files changed" count isn't comparable to Pass 1/2's full-repo numbers. Read narrowly (the 31-file session scope only), 3 of 31 files needed changes plus a 5-file DRY consolidation — consistent with "new code accumulates the same kind of drift a first pass would have caught, at a much smaller scale." The real finding wasn't file-count convergence, it was that a **declared** design-system fix (the type scale) had never been **adopted** — a gap neither Pass 1 nor Pass 2 was positioned to find, since Pass 1 predates the type scale's existence and Pass 2's Cat 8 section only checked the files in its own smaller changed-set.

**Verification:** `npm run lint` clean, `npm run build` clean, `npm test` full suite green except the pre-existing/unrelated `auth-jwt-secret-missing.test.js` (requires `JWT_SECRET` unset in the shell, fails identically on `master` with none of this pass's changes). Live smoke pass: Home, a player page (award badges + Per Game table), a team dashboard (game chart + roster with new columns), a team roster page — all rendered correctly with no visual regression from the token consolidation.

---

## Pass 3 Addendum — same day, after user pushback

User, after reviewing the live local build: *"i still see blatant ui inconsistcy on the local version... do a real one."* Correct. The token-scale consolidation above was a real fix but a subtle one — near-duplicate sizes converging by a few percent isn't what "blatant" means, and it wasn't the whole problem. This addendum is what an actual side-by-side visual audit (not "does it render without breaking," an honest look at multiple pages compared against each other) found.

### The real finding: three different visual treatments for the same "champion" concept

- `.team-history-champ-badge` (pre-existing, `team.css`) — a **solid**-fill tag: `background: var(--champion)`, black text, `border-radius: 3px`. Used both in the History page's championship banner and inline on each title-winning row.
- `.team-champion-badge` (this session's Area 1 work, before this addendum) — invented a **third**, different treatment: a translucent gold pill (`rgba(232,200,74,0.15)` fill, `border-radius: 999px`), sitting on the *same team's own header*, one click away from the solid-tag version on the History tab. Same concept, two incompatible styles, one page apart.
- `.player-award-badge` (this session's Area 4 "Reviewed and unchanged," which should not have been marked clean) — a **second**, separate invented treatment for the WNBA-Champ entry specifically: `rgba(232,200,74,0.12)` fill, `border: rgba(232,200,74,0.4)`, `font-weight: 700`. Numerically close to `.injury-badge`'s own tinted-pill formula, but confirmed live to read much louder in practice: `.injury-badge` only ever shows one red pill at a time, this showed up to 6 gold pills in a row on a player's hero, immediately next to the muted grey `.archetype-pill` ("Interior Anchor") and the plain-outline "Compare with.../Similar players" buttons -- three unrelated visual languages stacked in ~200px of vertical space.

**Root cause:** Area 4's file-by-file pass checked each new file in isolation against the 12 categories, which is exactly why it missed this — no single file's diff looks wrong on its own. The bug only shows up when you put the *rendered* elements next to each other, on the page, and compare them against what already existed for the same concept. A per-file code review is not a substitute for actually looking at the site.

- **Changed, `.team-champion-badge` (`layout.css`):** now `background: var(--champion); color: #000; border-radius: 4px;` — the same solid-tag family as `.team-history-champ-badge`/`.team-dashboard-badge`, just sized up slightly for sitting next to an `<h2>` instead of inline in a table cell. Verified live at desktop and 390px (wraps cleanly under the team name, no overflow).
- **Changed, `.player-award-badge` (`player.css`):** fill changed from the tinted-gold block to `var(--surface-2)` / `var(--border)` — the same neutral shell as `.archetype-pill`, with gold used only for the text (still `var(--champion-text)`), `font-weight` dropped from 700 to 600 to match. Now reads as the same pill family as its neighbors instead of a fourth competing style. Years-list sub-text color changed from a translucent gold (`opacity: 0.75` on `var(--champion-text)`) to plain `var(--text-muted)` at full opacity, matching how every other secondary/meta text on the site is styled (search-suggestion-meta, team-dashboard-player-pos, etc.) rather than another one-off.

### Checked and confirmed clean (not just assumed) elsewhere

Went through Injury Report, Awards History, League Leaders, All-Time Leaders, Notable Games, a Team Dashboard, a Game Box Score, Season Stats, Playoffs, and the Compare page specifically looking for this same class of bug (a new element clashing with an established one for the same concept). `RankBadge`/`leaderboard-rank` and `InjuryPill`/`.injury-badge` are both single shared implementations already, not duplicated. The Awards History table has one real, separate, pre-existing data issue (a player, "Skylar Diggins-Smith," renders as plain unlinked text instead of an orange link in the 2022 All-WNBA row — a name-resolution miss in `resolveEspnIdByName`, not a styling bug) — noted here, not fixed, since it's a data/identity-matching issue outside this pass's CSS-consistency scope. The Compare page's radar-chart/glance-card design is its own established, pre-existing visual language, untouched by this session, and was left alone.

**Verification:** `npm run lint` / `npm run build` clean. Live re-check of the player hero (badges now visually match `.archetype-pill`) and the team header at both `?season=2023` (title year, badge visible) and desktop/390px widths (wraps correctly, no overflow) — both confirmed by screenshot, not assumed from the diff.

---

## Pass 3 Addendum 2 — same day, "is that all??? ... look everywhere"

User's second round of pushback: one fixed badge family wasn't a full sweep. This addendum is an actual page-by-page walk (Home, Teams index, Standings, Shot Zone Leaders, League Leaders, All-Time Leaders, Notable Games, Awards History, Injury Report, Odds, Search, Players Directory, Schedule Hub, Playoffs Hub, Season Stats, all 5 Team sub-pages, a Game Box Score, Compare) with a genuinely critical eye, not a re-read of diffs. Five real, independent findings:

- **`ShotZoneLeadersPage.jsx` had no rank badges, no team logos, and no subtitle line** — the one ranked-leaderboard table on the site that didn't match `RankBadge`/`TeamBadge`/the `<h1>` + one-line-description pattern every other leaderboard page (`LeagueLeadersPage`, `CareerLeadersPage`, `NotableGamesPage`) already uses. Pre-existing, not part of this session's new work, but exactly the kind of "why does this one page look different" gap the user is describing. Fixed: added `RankBadge`/`TeamBadge` (now takes a `teams` prop, wired in `App.jsx`), added the missing subtitle.
- **`StandingsPage.jsx` and `TeamsPage.jsx` were also missing their subtitle line** — found by grepping every page's `<h1>` for what immediately follows it, not just eyeballing pages one at a time (legal pages/login/signup/account correctly don't have one — different, deliberate pattern, left alone). Both already had the right description text sitting unused in their own `setPageMeta(...)` call; reused verbatim as the visible subtitle rather than writing new copy.
- **The header search dropdown auto-opens on `/search` itself, floating over the page's own results.** Landing directly on `/search?q=X` (a refresh, a bookmark, a shared link) initializes `value` to the URL's `?q=`, which fires the same debounced suggestions fetch as if the user had just typed it, and pops the floating dropdown open on top of the full results list already rendered below it — confirmed live, a genuinely redundant double-UI nobody asked for. Fixed: the debounce effect now skips the fetch entirely while `location.pathname === '/search'`.
- **`SearchPage.jsx`'s back button was hardcoded to "← All Teams"** while navigating to `/` (Home) — a leftover/copy-pasted label that makes no sense reached via search from any other page. Changed to "← Home", matching where it actually goes.
- **Checked for content-level oddities, not just styling:** `/teams` legitimately lists an active 2026 expansion "Portland Fire" alongside a defunct 2000-2003 "Portland Fire" in Historical Franchises — the real WNBA reused the franchise name, this isn't a data bug, but it's genuinely disorienting with no distinguishing label on the active card (the defunct one shows its year range, the active one doesn't show anything to counter the "wait, didn't I just see this" reaction). Logged, not changed — the honest fix (an "Est. 2026" style label on freshly-founded active teams) is a real content-architecture addition, not a consistency fix, and out of scope for this pass without the user weighing in on it first.

**Verification:** `npm run lint` / `npm run build` clean, `npm test` — same 4 pre-existing/unrelated `auth-jwt-secret-missing.test.js` failures, nothing new. Live re-check: Shot Zone Leaders now shows medal-circle ranks and team logos identical to League Leaders; `/search?q=aces` reloaded directly no longer pops the dropdown open over its own results; `/search`'s back button reads "← Home".

---

## Pass 3 Addendum 3 — same day, judging pleasantness/intuitiveness, not just matching

User's third round: judge how pleasant and sense-making each page/element is on its own terms, not just whether it matches its neighbors. Tested actual interaction flows live (Compare picker → results, nav dropdowns, mobile menu) instead of only reading static screenshots, since "pleasant to use" is fundamentally about interaction feel.

### Real bug found: player names truncating on the Compare page with room to spare

Opened a live Compare (`A'ja Wilson` vs `Breanna Stewart`) and the "AT A GLANCE" headline showed **"BREANNA STEW..."** cut off mid-word, with visibly empty space on both sides of the card. Traced to `.compare-verdict-fight-name`'s `max-width: 9rem` (desktop tier) — a hard cap on a `justify-self`-sized flex item, present specifically so `overflow: ellipsis` has a box to clip against (a documented, deliberate choice — see the long comment above this rule from an earlier session, explaining why `max-width: none` broke mobile once). The cap itself is legitimate; 9rem specifically is just too tight for any real name past "A'ja Wilson"'s length. Widened to `13rem`, comfortably fitting "Breanna Stewart," "Napheesa Collier," "Skylar Diggins-Smith," etc. with the grid's `minmax(0, 1fr)` center column still bounding it (never `none`).

Checked the two other documented breakpoints for the same class rather than assuming they were fine:
- **481-975px tier** (`max-width: 3.3rem`): confirmed live, this truncated even the *shortest* realistic name — "A'ja Wilson" itself rendered as "A'JA..." Not a long-name edge case, every name at this width. Widened to `6rem`. Re-verified at both tier boundaries (490px, 970px) for the avatar-collision this tier's cap exists to prevent (per its own comment) — no overlap at either edge. Some truncation remains for longer names at this genuinely cramped width (the fight-score numbers also share this row), which is a proportionate tradeoff, not the "3 letters and done" state it was in before.
- **≤480px tier** (`max-width: 2.2rem`, smaller font): untouched — its own comment documents a specific, different fix (font-size drop + halved-avatar-column proportional sizing) that this pass didn't touch and didn't need to re-litigate.

### Interaction flows tested live, not just re-read

- **Compare picker → results**: typing a name shows a clean result card (headshot, name, position, team) — opening the modal, searching, and landing on the compare page all felt smooth; no friction found here beyond the truncation bug above.
- **Nav dropdown click-vs-navigate**: clicking "Teams"/"Players"/"Leaders"/"Scores" only opens the menu, it doesn't navigate anywhere itself (unlike bbref, where the label is also a real link to that section's index page). Considered fixing this, but: Players/Leaders/Scores are pure *groupings* with no single corresponding page to link to (there's no "Leaders hub" or "Scores hub" — those are sibling pages with nothing in common to land on), so a click-to-navigate affordance genuinely has nowhere sensible to go for 3 of the 4 dropdowns. Only "Teams" has a real destination (`/teams`, which is also the dropdown's own first item, one click away). Concluded this is a reasonable, common mega-menu tradeoff (many category-only nav triggers deliberately don't double as links, precisely to avoid "does clicking navigate or open a menu" ambiguity), not a bug — logged the reasoning here rather than silently deciding.
- **`TeamGameChart` on touch**: reconsidered whether tap-only interaction (no hover preview) is a gap. For BDL-covered seasons, tapping a bar goes straight to its box score — a normal, direct mobile pattern, not worse than desktop's hover-then-click. For pre-2008 seasons the bars are non-interactive and convey no per-game info on any device, touch or not — a real but narrow edge case (an old team's old-season chart on a phone), and the chart's aggregate win/loss shape still has value even without per-game drill-down. Not changed; logged as a known, low-priority limitation rather than silently accepted.

**Verification:** `npm run lint` / `npm run build` / `npm test` clean (same 4 pre-existing failures). Live re-check of the Compare page's name truncation at desktop width (full names visible), 970px and 490px (both near the middle tier's boundaries, no avatar overlap), and 600px (mid-tier, names no longer reduced to 3-4 characters).

---

## Pass 3 Addendum 4 — same day, "you went on all the pages?"

Direct, skeptical follow-up to Addendum 3: the "pleasant/intuitive" pass above had only actually tested 2-3 flows (Compare picker, nav dropdowns, touch charts) and leaned on Addendum 2's *different-lens* page sweep as if it already covered this one. It didn't — visual consistency and interaction pleasantness are different questions. This addendum is the honest follow-through: every Player-page stat tab, the Study flashcard flow, a Team's History/Roster/Schedule tabs, a Game Box Score's Play-by-Play tab, the Home page, and the Login page, actually opened and used.

### Real bug found and fixed: Study flashcards showed raw ISO timestamps

Built a Game Log study deck (Date front / PTS back) and the front of card 1 read **"2026-05-09T19:30:00.000Z"** instead of a formatted date — jarring, and inconsistent with every other date display on the site (the Game Log table two clicks away shows the same value as "May 9"). Root cause: `studyData.js`'s `buildStudyDeck` only special-cased `kind: 'pct'` when building each column's `type`, collapsing `'date'` (and everything else) into a generic `'text'` type; `StudyFlow.jsx`'s `fmtVal` then had nothing to format a date value with and fell straight through to `String(val)`.

- **Changed, `studyData.js`:** `buildStudyDeck` now also maps `kind: 'date'` through to `type: 'date'` instead of collapsing it into `'text'`.
- **Changed, `StudyFlow.jsx`:** `fmtVal` gained a `type === 'date'` branch using the same `formatDateMonthDay` helper (`lib/dateFormat.js`) the rest of the site already shares, with the same invalid-date guard `BrefTable.fmt`'s own `'date'` kind uses.
- Verified live: rebuilt the same deck, front of card 1 now reads "May 9"; back still correctly shows PTS 19 for that row.

### Real bug found and fixed (earlier in this session, folded in here): unrounded averaged +/-

Splits tables (Home/Away/Month/Opponent) average per-game plus-minus across games with no rounding at the data layer (`gameSplits.js`, correctly — rounding is the display layer's job, same convention as `pct`/`pct100`), but `BrefTable.jsx`'s `fmt()` had a `'signed'` branch written assuming a per-game (always-integer) value and skipped rounding entirely, so a Splits row showed **"+7.066666666666666"**. Fixed by rounding non-integer `'signed'` values to 1 decimal, same as every other numeric kind; CSV export shares the same `fmt()` so one change covers both surfaces. Verified live at `/player/3149391/splits`: +/- column now reads "+4.9" and "+7.1".

### Real data inconsistency found, investigated, and documented (not fixed): Usage/Defense tab game counts

The Usage tab's "G" column for the *current, in-progress* 2026 season reads **37**, while every other tab for the same player/season (Per Game, Totals, Advanced, Adj. Shooting, Play-by-Play, Game Log) correctly reads **31**. The Defense tab shows the identical 37 for the same season — both pull `gp` straight from BDL's `/player_season_advanced_stats` endpoint (`measure_type=usage` / `measure_type=defense` respectively; see `usageShare.js`/`defenseStats.js`), unlike every other tab, which derives its numbers from ESPN's per-game box scores. Ruled out two more benign explanations before concluding this is upstream data lag:
- Not a client display bug — hit `/api/players/3149391/usage?season=2026` directly, the server itself returns `gp: 37`.
- Not "37 = the team's total games this season" — Las Vegas's actual 2026 record is 27-13 (40 games), which doesn't match either.
- Historical seasons on the same endpoint are close but not exact (2022: BDL usage `gp` 36 vs. per-game 37; 2023: 40 vs. 41) — small, plausible box-score-coverage gaps, not the 6-game gap seen on the in-progress season.

Most likely explanation: BDL's advanced-tracking-stats endpoint (a heavier, more heavily-processed pipeline than raw box scores, per this codebase's own `usageShare.js`/`defenseStats.js` comments) updates on a slower cadence mid-season than the box-score data every other tab uses, so it's read a real-but-different-endpoint games-played count from a few games behind the season's current point. This also means `defenseStats.js`'s per-game defensive rate stats (BLK/STL/DRB/Opp Pts, all divided by this same `gp`) are quietly understated for the *current* season specifically, by a factor of roughly 31/37 -- not just a cosmetic "G" mismatch.

**Not fixed this pass, and here's why:** overriding the displayed G (and thus the per-game denominators) would require the `/usage` and `/defense` routes to also fetch the player's reliable per-game season data (currently only fetched by the separate `/detailed-stats` route) — a real architecture change (new provider round-trip on two routes, contract question about which source wins) rather than a one-line fix, and per this codebase's own `>>think`-gate convention that's a decision worth surfacing to the user rather than making unilaterally mid-sweep. It's also very likely self-correcting as BDL's backend catches up later in the season (the same 2022/2023 seasons show it nearly resolved once final). Flagging here for a future pass or a user decision on whether the added latency/complexity is worth it for a temporary in-season discrepancy.

### Checked and confirmed NOT bugs (verified by computation/data, not just eyeballing)

- **Shot Chart court coloring** (`CourtDiagram.jsx`): Restricted Area (73.2% FG) and Paint Non-RA (51.3% FG) render nearly identical colors; so do Mid-Range (42.5%) and Above the Break 3 (38.6%). Looked like a bug at a glance. Hand-computed the documented sigmoid formula against the actual API response (`leagueAvgPct` per zone) and confirmed both pairs are almost exactly the same number of points *above their own zone's league average* (~9pp and ~4.5pp respectively) — the color scheme is deliberately zone-relative, not raw-FG%, exactly as its header comment describes. Working as designed.
- **Adj. Shooting's `r3PAr` column** showing small values (0-48) next to `rTS%`/`reFG%`/`rFTr` clustering near 100-175: also verified by back-computing the implied league-average 3PAr from each season's raw values (~0.32-0.36 throughout) — internally consistent, just a much wider relative range because a low-volume 3-point shooter's attempt-rate varies more relative to league average than her shooting efficiency does. Not a bug.
- **Apparent page-wide horizontal scroll** on the Advanced tab: an artifact of the browser-automation tool's scroll gesture triggering a page zoom, not a real site bug — confirmed via `document.body.scrollWidth` (1646) < `window.innerWidth` (1661), and the wide stats table correctly scrolling within its own `.bref-wrap` container (`overflow-x: auto`) with no leakage to the page body.

### Checked and found genuinely fine

Advanced/Per 36/Per 100 Poss/Adj. Shooting/Clutch/Scoring Dist./Usage/Defense/Play-by-Play/Shot Chart tabs (percentile heat-toggle, "Study this table"/"Export CSV" wiring, season-progress loading indicator on Play-by-Play's "Loading rest of career... (n/9 seasons)"); a Team's History/Roster/Schedule tabs (schedule auto-scrolls to a highlighted "NEXT UP" divider on load, a nice touch); a completed Game Box Score's Box Score and Play-by-Play tabs; the Login page (functional, deliberately spare).

### Noted, not changed: Home page is very thin for a stats site's front door

`HomePage.jsx` renders exactly three things: recent study decks (empty for a fresh session), a League Snapshot (top-4-per-conference standings teaser), and a "Browse all teams" button — no scores, no leaders, no today's-games, nothing time-sensitive. That's not a bug (it's exactly what the component is coded to do), but it's a real "does this feel right for a stats site's landing page" gap worth the user's attention — deliberately not treated as a drive-by fix here since adding a scores/leaders widget is a scope decision, not a consistency correction.

**Verification:** `npm run lint` / `npm run build` clean for both real changes (the +/- rounding fix and the Study date-format fix), committed separately (`1d92fcd`, `d118c4b`) on `refactor-pass-3`. Both verified live in-browser, not just from a green build.

---

## Pass 3 Addendum 5 — same day, "the nav looks weird" + homepage work

User's follow-up asked for two specific things: fix the nav, work on the homepage. Both real, both fixed/built and verified live.

### Real bug found and fixed: nav dropdown triggers rendering at the wrong font weight/size

Zoomed into the top nav bar and Teams/Players/Leaders/Scores visibly read thinner and greyer than Home/Standings/Injury Report, which looked bold-white by comparison -- the opposite of what "these are peer nav items" should look like, and enough to misread the plain links as somehow more important. Root cause: `.nav-dropdown-trigger`'s `font: inherit` shorthand resets every font sub-property (not just family) to what the button's DOM PARENT has, not what the `.site-nav-link` class *also on the same element* declares -- buttons don't inherit font from ancestors by default, so this silently fell back to the browser's default button metrics (400/16px) instead of `.site-nav-link`'s 700/13px. Confirmed via `getComputedStyle` before touching anything. Fixed by narrowing the reset to `font-family: inherit` only, letting `.site-nav-link`'s own size/weight cascade through. Verified: `getComputedStyle` on the Teams trigger now matches Home's NavLink exactly (700/13.12px), dropdown open/close and its own item highlighting unaffected.

### Real gap found and fixed: dropdown triggers had no active-section indicator

Home/Standings/Injury Report show the current page (orange + underline via `NavLink`'s own `isActive`). Teams/Players/Leaders/Scores had no equivalent -- the trigger's `.active` class only ever reflected whether the panel was currently *open*, never whether the current route was actually inside that group. Confirmed live: navigating to `/league-leaders` left every nav item unhighlighted, including "Leaders." Fixed by adding an `isActive` prop to `NavDropdown`, computed in `App.jsx` per group from the same `items[].to` list already used to render (and highlight) the panel's own links, checked against `location.pathname` (exact match or sub-route). Verified live on `/league-leaders` (Leaders highlights), `/team/las-vegas-aces/roster` (Teams highlights on a sub-route, not just the exact team page), `/players` (Players highlights).

### Homepage: added Scores strip and League Leaders teaser

User picked all three options offered (scores strip, leaders teaser, general cleanup) when asked what the thin homepage (flagged in Addendum 4) needed. Built two new components, both reusing existing API endpoints (no new server routes):
- `HomeScoresStrip.jsx` — last 4 final games + next 3 upcoming, from `/api/league/schedule` (no postseason filter, so a Finals game still shows). Found and fixed a real data-quality trap while building this: a 2026-07-17 NY@DAL game sits at `final:false` with a 0-0 score (postponed/uncorrected upstream) despite every August game around it being properly final -- naively sorting "not final" games by date would have surfaced this two-months-stale game as the featured "next game." Fixed by also requiring `date > now` for the upcoming bucket.
- `HomeLeadersTeaser.jsx` — #1 leader in PTS/REB/AST from `/api/league/leaders`, not the full top-10 the League Leaders page itself shows.
- Both follow `LeagueSnapshot`'s own established convention of silently omitting themselves on error/loading rather than showing an error on the site's front door.
- New CSS (`layout.css`) matches the existing card/section-header language (`.recent-card`, `.league-snapshot-header`, `.section-title`) rather than inventing a new visual style.

**Verification:** `npm run lint` / `npm run build` clean for all three changes, committed separately (`027434d`, `adef39a`, `87b9e0c`) on `refactor-pass-3`. Nav fixes verified via `getComputedStyle` and live route navigation. Homepage widgets verified live with real data (score card → box score navigation, leader card → player page navigation) and at mobile width (390px, injected iframe) -- scores strip scrolls horizontally, leaders grid stacks to one column, no layout breakage.
