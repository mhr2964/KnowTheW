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
