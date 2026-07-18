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
