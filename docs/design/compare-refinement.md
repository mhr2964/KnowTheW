# Compare Refinement — Design

## Problem
The shipped `/compare/:idA/:idB` view feels clunky and bloated, duplicates career averages in two places, presents two unaligned season tables, and is missing the Advanced tab. The Game Log tab will be dropped (per-game data has no head-to-head meaning here).

---

## SWEN — variability axes named up front
The compare view varies along four orthogonal axes. Naming them keeps the redesign honest about what changes versus what stays the same.

1. **Stat scale** — `perGame | totals | per36 | per100 | advanced` (existing tab strip; advanced uses a different endpoint and a different headers array, so it's a separate render branch rather than a fifth `safeType` of the same data shape).
2. **Season type** — `regular | playoffs` (toggle, gated on at least one player having playoff rows in the current stat scale).
3. **Career symmetry** — players may have disjoint or partially overlapping season sets, and within a season may have one or more team-rows (mid-season trades produce a row per team plus a `TOT` row).
4. **Data presence** — either player may be `empty` (no WNBA games yet), or the active stat scale may be unavailable for that player's data source (`SOURCE_ACTIVE` map in `DetailedStats.jsx`).

Patterns leaned on: **adapter** (one merged-row builder normalizes two `BrefTable` payloads into one row shape); **strategy** (a single `pickLeader` already in `compareStats.js`, extended to per-season rows, not just career); **null object** (missing-season cells render as a frozen em-dash row segment — no special-case branches in the render loop).

Anti-patterns to avoid: dual sources of truth for career averages; ad-hoc layout shifts at narrow widths (we already see this with the unaligned year columns).

---

## Options

### Option A — Refine in place
Keep two independent `BrefTable`s. Compact the hero. Keep one career-summary source. Add the playoff toggle and wire Advanced. Drop the Game Log tab entirely (remove from `COMPARE_TABS`, do not render disabled).

- **Pros:** Smallest blast radius — `ComparePage.jsx` and a CSS block. `BrefTable` untouched. Easy to revert. Ships in an afternoon.
- **Cons:** Year-misalignment problem survives. A 10-year vet next to a rookie still produces two tables of wildly different heights, and the user still has to eyeball-trace 2021 in one to 2021 in the other. The user's word "clunky" is partly about that visual mismatch — Option A doesn't fix it.
- **Cost:** ~3–4 hours. Risk: low.

### Option B — Year-aligned merged table (recommended)
All of Option A, plus replace the two side-by-side `BrefTable`s with **one merged year-aligned table**: rows keyed by `SEASON_ID`, each row showing both players' values cell-by-cell with per-stat leader highlight, asymmetric seasons render with em-dashed cells on the missing side, and a single career row at the bottom is the only place career averages live.

- **Pros:** Fixes the actual complaint — the compare actually *compares*, row-by-row. Eliminates the duplication (no `CompareSummary` needed; the career row is the source of truth). Resolves year-misalignment by construction. Reads top-to-bottom as a timeline.
- **Cons:** Bigger blast radius — introduces a new `CompareTable` component and a merging library (`compareTableRows.js`). Mid-season trade rows need a deliberate flattening rule. Many stat columns × 2 players is wide on mobile — needs careful column model.
- **Cost:** ~1 day. Risk: medium (mostly around mid-season trade flattening and column count on mobile).

---

## Recommendation — Option B
The user said "looks pretty clunky/bloated" and "make up your teams however you need." The clunkiness is mostly the visual mismatch between two tables that don't share an axis; refining in place leaves that intact. Option B is the move that turns this from "two player pages stuck side by side" into a head-to-head view. The added complexity is contained — one new component and one pure helper — and the existing `BrefTable` stays untouched for PlayerPage parity.

---

## Detailed design (Option B)

### 1. Hero layout — compact dual header
Collapse the current ~250px stacked-card hero into a single ~80px row. ASCII sketch (desktop):

```
┌──────────────────────────────────────────────────────────────────────────┐
│  [img]  Breanna Stewart  #30 · Liberty       VS       Lexie Hull  #10 · Sky  [img]  │
│         (change)                                                  (change)         │
└──────────────────────────────────────────────────────────────────────────┘
```

- One row, flexbox: `[avatar 40px][name+meta block, left-aligned][VS pill, fixed center][name+meta block, right-aligned][avatar 40px]`.
- Avatars shrink from 64px to 40px. Names drop from 1.1rem to 1rem and stay nowrap with ellipsis.
- **"Change" lives as a small text-link directly under each name** (≤0.7rem, muted color, hover → accent). Removes the standalone button row that's eating vertical space today.
- VS pill stays as the centered separator. Border/background on the whole row, not on each side (kills the two-card visual).
- The "Loading..." and error states stay per-side (each side renders its own status if its fetch is pending/failed). Layout doesn't shift when one side is still loading — reserve width with a skeleton block.

### 2. Career averages — single source of truth
**The career row inside the merged table survives. `CompareSummary` is deleted.**

Why this direction and not the other:
- The career row already lives at the bottom of the table (last row of `BrefTable` today), and in the merged design that row shows both players + leader-highlight on every stat (not just the 7 in `SUMMARY_STATS`). It's strictly more informative.
- The 7-stat summary grid was originally a "tl;dr at the top." In the merged table, the career row at the bottom is the same tl;dr but covers every stat in the current scale and stays in the same visual grammar as the per-season rows.
- Removing `CompareSummary` is also the single biggest "kill the bloat" win.

`client/src/lib/compareStats.js` keeps `pickLeader` and `LOWER_BETTER` (the merged-table builder uses them per row). `SUMMARY_STATS` and `SUMMARY_KEY_MAP` are deleted along with `CompareSummary.jsx`. `buildCareerMap` is no longer needed — the merged-table builder works directly off headers + rows.

### 3. Season toggle — Regular / Playoffs
- Render the toggle as a `.stat-season-bar` (reuse PlayerPage's existing style class) **directly above the merged table**, below the tab strip. Same component pattern as `DetailedStats.jsx` lines 372–389.
- Visibility rule: render the Playoffs button only when *either* player has playoff rows for the active stat scale (`statsA[activeTab].playoffs?.rows?.length || statsB[activeTab].playoffs?.rows?.length`). If only one has them, still show — the missing side's rows render as em-dashes (consistent with how asymmetric careers handle missing years).
- State lives on `ComparePage` as `activeSeason` (`'regular' | 'playoffs'`). Auto-snap to `'regular'` when switching to a tab where neither side has playoffs (mirror `curSeason` derivation in `DetailedStats.jsx` line 241).
- Toggle is **shared** across both players. Per-player toggles would re-introduce the divergence we just fixed.

### 4. Advanced tab wiring
- Remove `disabled: true` from the `advanced` entry in `COMPARE_TABS`.
- Endpoint: `/api/players/:id/advanced-pbp-all`. Response shape (from `DetailedStats.jsx:290-310`):
  ```
  { headers: [...], regular: { rows: [...], careerRow: [...] }, playoffs: { rows, careerRow } | null }
  ```
  Note this differs from `/api/players/:id/detailed-stats` (which nests under `perGame.regular.rows` etc.).
- Add two parallel `useLazyFetch` calls on `ComparePage`, gated on `activeTab === 'advanced'`:
  ```
  /api/players/${idA}/advanced-pbp-all   (enabled when activeTab === 'advanced')
  /api/players/${idB}/advanced-pbp-all   (same)
  ```
- The merged-table builder is told which shape it's working with via a small adapter step: normalize advanced data to `{ headers, rows, careerRow }` per (player, season-type) and feed it through the same merge logic as the detailed-stats branch. The render component itself doesn't branch on `isAdvanced` — it consumes a uniform `{ headers, mergedRows, mergedCareerRow }` prop.
- Advanced uses a different `headers` array (TS%, USG%, PER, WS, etc.) and `pickLeader` already handles arbitrary numeric stats — no per-stat allowlist needed. `LOWER_BETTER` already covers TOV; for Advanced, `TOV_PCT` is the only "lower is better" candidate and should be added to `LOWER_BETTER`.

### 5. Game Log tab — fully removed
Confirmed removal. Drop the `gamelog` entry from `COMPARE_TABS` entirely. Don't render disabled — disabled-but-visible tabs imply "coming soon," and the user has decided this tab will never come. Cleaner to not advertise it.

### 6. Merged-table data structure

**Input** — for the active stat scale and active season type, each player provides:
```
{ headers: string[], rows: any[][], careerRow: any[] | null }
```
where rows are season-rows and `row[0]` is `SEASON_ID`, `row[1]` is `TEAM_ABBREVIATION`.

**Builder** — new file `client/src/lib/compareTableRows.js` exports `buildMergedRows({ headersA, rowsA, headersB, rowsB })`. It must assume the two `headers` arrays are identical for a given stat scale (they are — both pulled from the same backend stat-source map). The builder enforces this with a dev-mode assert.

**Flattening trade rows** — for each player, before merging, collapse multi-row seasons (mid-season trades) to a single representative row per season:
- If the season has a `TOT` team-abbreviation row, use it (this is the convention `BrefTable` already shows in the wild — total-across-teams row).
- Otherwise (single team that year), use the only row.
- Rationale: in the head-to-head view, "what did each player do in 2023?" is one cell, not three. The per-team breakdown still lives on PlayerPage's `BrefTable` for users who want it.

**Output shape** — array of merged rows + a merged career row, both shaped:
```
{
  seasonId: '2023-24',
  a: { row: rawArray | null, present: boolean, team: 'NYL' | null },
  b: { row: rawArray | null, present: boolean, team: 'CHI' | null },
}
```

**Asymmetric seasons** — the union of seasons from both players, sorted descending by `SEASON_ID`. A player's `row` is `null` for seasons they didn't play; render as a row of em-dashes on that side. No leader highlight on rows where either side is null.

**Leader-highlight per row** — for each stat column on each merged row, run `pickLeader(rowAMap, rowBMap, columnKey)`. Returns `'a' | 'b' | null`. Render the winning value with `.compare-leader` class (already styled). The career row uses the same logic with the careerRow values.

### 7. Merged-table render component
New file `client/src/components/CompareTable.jsx`. Single column model — every column appears once with a header label, and each cell renders both players' values inline:

```
| Season  |  G   |  PTS  |  REB |  AST | FG%  | ... | Career row |
|---------|------|-------|------|------|------|-----|------------|
| 2024-25 |  38  | 21.4  |  8.4 |  4.0 | .478 | ... |    A : B   |
| 2024-25 |  ←   |  ←    |   ←  |  ←   |   ←  |  ←  |    cell    |
```

The cell layout per stat is **two stacked values with a thin divider**, A on top, B on bottom (each labeled with a tiny color-coded marker), with the leader colored accent. ASCII:

```
┌────────────┐
│  21.4 (A)  │  ← A leads, accent color
│  18.9 (B)  │
└────────────┘
```

This keeps row height predictable and works for the asymmetric case (one side shows `—`). The `Season` and `Team` columns get special handling: `Season` is a single value (the year). `Team` becomes two stacked team abbreviations (A team / B team), since players may be on different teams that year — still informative, not duplicated data.

Career row at bottom uses the same cell shape and a `.compare-career-row` modifier for the gold/border styling already on `.career-row`.

### 8. Mobile behavior at 360px
The current `@media (max-width: 600px)` block stacks the two tables vertically (`.compare-tables { flex-direction: column; }`). With Option B, there's only one table — that block becomes obsolete for the table itself but the hero still needs tuning.

At ≤600px:
- Hero collapses to **two rows**: row 1 = A's [avatar][name+meta][change], row 2 = B's mirror. VS pill becomes a thin horizontal divider between them, not a centered chip.
- Merged table: the cell-stacking model already works at narrow widths (each cell is two stacked numbers, not two side-by-side numbers). Font drops to 0.7rem (already in the existing media query). The whole table wrapper allows horizontal scroll via `.bref-wrap`'s existing overflow.
- At 360px specifically: with ~16 stat columns × 2-stacked values, the table will scroll horizontally. The first column (Season) should be position:sticky-left so the user always knows which year they're scrolling through. This is a small CSS addition, not a layout rethink.

Add an `@media (max-width: 480px)` rule that hides the Team column on the merged table (low-value at extreme widths). Season ID stays — it's the spine of the comparison.

### 9. Loading and error states
- Per-player fetch errors render on that side of the hero only (existing pattern).
- For the merged table itself: if both stats fetches are pending → single skeleton block. If one succeeds and one fails, render the merged table with the failed side em-dashed throughout plus an inline error banner above the table.
- If one player is `empty: true` (no WNBA games yet), the merged table uses only the other player's seasons and em-dashes the empty side, and the empty side's career row cells em-dash.

### 10. Implementation outline (builder steps)

**Phase 1 — strip and compact (low risk):**
1. `client/src/pages/ComparePage.jsx`: remove `gamelog` and `disabled: true` entries from `COMPARE_TABS`. Advanced stays in the array but no longer disabled (wiring follows in Phase 3).
2. `client/src/pages/ComparePage.jsx`: rewrite `PlayerHero` and the `.compare-hero-pair` JSX into the compact single-row layout. "Change" becomes a text-button under the name.
3. `client/src/App.css`: update lines 742–838 for new hero metrics (avatar 40px, single border, change link styling). Update the mobile block (1685–1689) for the stacked two-row hero at ≤600px.

**Phase 2 — merged table:**
4. New file `client/src/lib/compareTableRows.js` — `buildMergedRows({ headersA, rowsA, careerRowA, headersB, rowsB, careerRowB })`. Pure function. Handle the TOT flattening rule, the asymmetric-season union, and a helper `rowToMap(headers, row)` for `pickLeader`.
5. New file `client/src/components/CompareTable.jsx` — consumes `{ headers, mergedRows, mergedCareerRow }` and renders the single merged table with stacked A/B cells, sticky `Season` column on narrow widths, and the `.compare-leader` class for per-cell highlight.
6. `client/src/pages/ComparePage.jsx`: replace the `.compare-tables` div + both `<PlayerTable>` blocks with a single `<CompareTable>`. Pull `regular/playoffs` and `regularCareer/playoffCareer` from both `statsA[activeTab]` and `statsB[activeTab]`, run through `buildMergedRows`, hand to `CompareTable`.
7. Delete `client/src/components/CompareSummary.jsx`. Remove the `<CompareSummary>` block from `ComparePage.jsx`.
8. `client/src/lib/compareStats.js`: delete `SUMMARY_STATS`, `SUMMARY_KEY_MAP`, `buildCareerMap`. Keep `pickLeader` and `LOWER_BETTER`. Add `TOV_PCT` to `LOWER_BETTER`.

**Phase 3 — season toggle + advanced wiring:**
9. `client/src/pages/ComparePage.jsx`: add `activeSeason` state + `<div className="stat-season-bar">` above the merged table. Compute `hasPlayoffs = !!(statsA?.[activeTab]?.playoffs?.rows?.length || statsB?.[activeTab]?.playoffs?.rows?.length)`. Auto-snap `curSeason` to `'regular'` when no playoffs available.
10. `client/src/pages/ComparePage.jsx`: add two `useLazyFetch` calls for `/api/players/${idA|idB}/advanced-pbp-all`, enabled when `activeTab === 'advanced'`.
11. `client/src/pages/ComparePage.jsx`: branch the data fed to `buildMergedRows` on `activeTab === 'advanced'`: pull from the pbpAll responses (already shaped `{ headers, regular: {rows, careerRow}, playoffs? }`) instead of `statsA[activeTab]`. The merged-table component itself does not branch.

**Phase 4 — CSS polish:**
12. `client/src/App.css`: add `.compare-cell-stack` block (the stacked A/B value layout), `.compare-cell-divider`, `.compare-career-row` (gold accent). Reuse existing `.compare-leader`. Add `.compare-merged-table` sticky-first-column rule for narrow widths.
13. Update `@media (max-width: 600px)` and add `@media (max-width: 480px)` rules as described in section 8.

**Phase 5 — sanity pass:**
14. Verify `_TOT` row detection works for known mid-season trade cases (Stewart's 2023 if applicable; pick any player with multi-team seasons from the dataset).
15. Verify `activeTab === 'advanced'` doesn't crash when one player has no pbp data (rookies, older players).
16. Verify the same-player guard still works after the refactor.
17. Verify document title still updates on idA/idB change.

---

## Files that will change
- `client/src/pages/ComparePage.jsx` — substantial rewrite
- `client/src/components/CompareSummary.jsx` — deleted
- `client/src/components/CompareTable.jsx` — new
- `client/src/lib/compareStats.js` — trim down (keep only `pickLeader`, `LOWER_BETTER`; add `TOV_PCT`)
- `client/src/lib/compareTableRows.js` — new
- `client/src/App.css` — compare block (742–1009 region) heavily revised; mobile block (1685–1691) updated; new 480px rule added
- `client/src/components/BrefTable.jsx` — unchanged (PlayerPage still uses it as-is)
- `client/src/components/ComparePickerModal.jsx` — unchanged

---

## Risks + mitigations

- **Mid-season trade flattening:** the `TOT` row convention is assumed but unverified for every data source (`bdl | wnba | espn` per `SOURCE_ACTIVE`). Mitigation: in `buildMergedRows`, fall back to "first row matching the season" when no `TOT` row exists, and log a dev-mode warning so we notice if a source doesn't emit `TOT`.
- **Advanced data shape mismatch:** detailed-stats and advanced-pbp-all have different envelopes. Mitigation: an adapter step in `ComparePage` normalizes both into `{ headers, rows, careerRow }` per (player, season-type) before calling `buildMergedRows`. Render component sees one shape.
- **Wide tables at 360px:** ~16 stat columns × stacked values still requires horizontal scroll. Mitigation: sticky `Season` column, drop `Team` column at ≤480px, lean on existing `.bref-wrap` overflow.
- **Header drift between players:** if one source returns a slightly different headers array than the other (e.g., one has `GS`, the other doesn't), the assumption breaks. Mitigation: builder takes the intersection of headers as the displayed column set, em-dashes any column missing on one side. Dev-mode warning when headers diverge.
- **Loss of the 7-stat at-a-glance summary:** users who liked the compact `CompareSummary` row may miss the tl;dr framing. Mitigation: the career row at the bottom is the new tl;dr — it's strictly more data in the same visual grammar. If user feedback says "I want a top-of-page glance," the cheapest follow-up is a sticky-top duplicate of the career row, not bringing back `CompareSummary`.

=== HANDOFF ===
did: produced 2-option compare-refinement design and saved to DESIGN-compare-refinement.md; recommended Option B (year-aligned merged table) with full implementation outline
found: career-averages duplication resolved by deleting CompareSummary and making the merged table's career row the single source; advanced endpoint shape differs from detailed-stats and requires an adapter step in ComparePage before merge; TOT row is the assumed flattening rule for mid-season trades; mobile narrow-width strategy is sticky Season column + drop Team column at 480px, not a layout rethink
files-touched: C:\Users\Owner\Desktop\AI\Projects\knowthew\DESIGN-compare-refinement.md
next-suggested-agent: frontend-dev (builder) to execute Phases 1–5 in ComparePage.jsx, new CompareTable.jsx + compareTableRows.js, and App.css updates
blockers: none — verify TOT row presence early in Phase 5 sanity pass; confirm with user whether to keep Advanced gated behind data availability per player or render with one side em-dashed when one player lacks pbp data
=== END HANDOFF ===
