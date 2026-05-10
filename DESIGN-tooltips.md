# DESIGN: Header Tooltips for Advanced Stats

## Problem

New WNBA fans bounce off the Advanced view because abbreviations like TS%, eFG%, USG%, PER, OWS, and WS/48 are opaque — there's no on-page hint of what they measure. The KnowTheW table renders headers as bare `<th>{label}</th>` with no affordance for definitions, so a curious user has nowhere to ask "what is this?" The fix is a one-sentence plain-English definition surfaced from the column header itself, on hover and on tap, without breaking the table's minimalist look.

## Options

### Option A — Native `title` attribute on `<th>`

Pass the definition string as `title="..."` on each header cell. The browser shows a system tooltip on hover; screen readers read it as the accessible name.

- **Pros:** zero dependencies, zero new components, one line of JSX change in `BrefTable`. Already in use in this codebase: `<td title={ordinal(perc) + ' percentile'}>` in `DetailedStats.jsx` line 64. Accessible by default. Cannot break sort or click behavior because there is none on headers today.
- **Cons:** appearance is OS-controlled — light yellow on Windows, doesn't match dark/orange theme. No tap support on iOS/Android browsers (mobile users get nothing). Long delay before reveal (~700ms on most platforms). Cannot style font, max-width, or wrapping.
- **Cost:** ~30 minutes. Only wins half the problem (desktop only, ugly).

### Option B — Custom CSS-only hover popover with a "?" affordance

Add a `<Tooltip>` wrapper component that renders the visible header label plus a small superscript "?" indicator. Hover (or focus, or tap on touch) reveals a styled `<span>` positioned absolutely above/below using pure CSS + a tiny `useState` for tap toggle on touch devices. No JS positioning library, no portals — the parent `<th>` becomes the positioning context.

- **Pros:** matches dark theme (uses `--surface-2`, `--border`, `--accent` from existing palette). Visible "?" tells users definitions exist — solves discoverability. Works on mobile via tap-to-toggle. Keyboard-accessible via `:focus-within`. No dependencies. Roughly the size of `StudyFlow.jsx`'s lighter pieces.
- **Cons:** more code than Option A — one new component, ~30 lines of CSS, and a tap-outside-to-close listener for mobile. Edge cases at the right edge of the table where the popover can clip. Adds visual weight (the "?" symbols) to a clean header row.
- **Cost:** ~2–3 hours including mobile/edge polish. Highest payoff per dollar.

### Option C — Collapsible "What do these mean?" panel above each table

A `<details>` element above the Advanced table containing a glossary of all the stats in that view. No per-header tooltips; the user reads the legend once.

- **Pros:** no positioning logic, no mobile vs desktop divergence, native HTML element. Easiest to ship.
- **Cons:** breaks the link between the column and its definition — the user has to scan a list, find the row, then look back at the table. Doesn't scale to Game Log or per-game views. Adds vertical space the table doesn't have on mobile. Doesn't actually answer "what is the stat my eye is on right now."
- **Cost:** ~1 hour. Cheapest but weakest UX — still leaves the new fan hunting.

## Recommendation

**Option B**, with one explicit fallback: stats that don't need a definition (PTS, REB, AST, etc.) get nothing — no "?", no wrapper, plain `<th>` as today. Keeps the visual noise proportional to the actual problem.

Why B over A: native `title` is invisible on touch and silently fails for the exact users this feature targets — phone-first new fans browsing in bed. The "?" indicator solves the discoverability gap that Option A leaves wide open ("hover what?"). Custom styling lets the popover match the dark/orange aesthetic so it feels native to KnowTheW rather than an OS escape hatch.

Why B over C: a glossary box requires the reader to context-switch and scan; tooltips put the answer where the question is. C also doesn't translate to the per-game/totals/per-36 views, where a few abbreviations (FG%, 3P%, MP) might still trip the rawest beginners later.

## Stat coverage and definition strings

Coverage rule: define a stat if it's an acronym, a percentage rate computed from multiple inputs, or a derived index. Don't define raw counting stats whose meaning is in the name (PTS, REB, AST, STL, BLK, TOV, PF, GP, GS, MP, FG, FGA, 3P, 3PA, FT, FTA, ORB, DRB, TRB).

The list below mirrors `ADV_HEADERS_SRV` in `server/lib/advancedStats.js` plus the four shooting percentages that appear across all views. Definitions written for an adult who watches games but doesn't read Basketball-Reference; ground each in the formula but never expose the formula.

| Key | Header | One-sentence definition |
| --- | --- | --- |
| `FG_PCT` | FG% | Share of all field-goal attempts that went in. |
| `FG3_PCT` | 3P% | Share of three-point attempts that went in. |
| `FT_PCT` | FT% | Share of free throws made. |
| `TS_PCT` | TS% | Overall shooting efficiency that gives extra credit for threes and free throws — a single number for "how many points per shot, really." |
| `EFG_PCT` | eFG% | Field-goal percentage adjusted to count a made three as 1.5 makes, since it's worth 50% more. |
| `TPAr` | 3PAr | Share of her field-goal attempts that came from beyond the arc. |
| `FTr` | FTr | How often she gets to the line, measured as free-throw attempts per field-goal attempt. |
| `TOV_PCT` | TOV% | Estimated share of her offensive possessions that ended in a turnover. |
| `USG_PCT` | USG% | Estimated share of her team's possessions she used while on the floor — a proxy for offensive workload. |
| `AST_PCT` | AST% | Estimated share of her teammates' made baskets she assisted while on the floor. |
| `ORB_PCT` | ORB% | Estimated share of available offensive rebounds she grabbed while on the floor. |
| `DRB_PCT` | DRB% | Estimated share of available defensive rebounds she grabbed while on the floor. |
| `TRB_PCT` | TRB% | Estimated share of all available rebounds she grabbed while on the floor. |
| `STL_PCT` | STL% | Estimated share of opponent possessions she ended with a steal while on the floor. |
| `BLK_PCT` | BLK% | Estimated share of opponent two-point attempts she blocked while on the floor. |
| `PER` | PER | Per-minute rating that rolls scoring, rebounding, assists, steals, blocks, fouls, and turnovers into one number; league average is 15. |
| `OWS` | OWS | Offensive Win Shares — estimated team wins her offense produced this season. |
| `DWS` | DWS | Defensive Win Shares — estimated team wins her defense produced this season. |
| `WS` | WS | Total Win Shares — OWS plus DWS, an estimate of wins she contributed all-around. |
| `WS_PER48` | WS/48 | Win Shares scaled to a full 48 minutes — lets you compare starters and rotation players on the same footing; league average is .100. |

Shape of the data file (`client/src/lib/statDefinitions.js`):

- A single named export `STAT_DEFINITIONS` — a plain object mapping the column key (the same keys used in `LABELS`) to a string. No nested objects, no severity tiers, no formula links. Anything not in the map gets no tooltip — that's the coverage signal.

## Implementation outline

1. **`client/src/lib/statDefinitions.js`** (new file). Export `STAT_DEFINITIONS`, the keys-to-sentences map above. Keys must match the column keys already used in `LABELS` (`FG_PCT`, `TS_PCT`, etc.), so the lookup in step 3 is `STAT_DEFINITIONS[c.key]`.

2. **`client/src/components/HeaderTooltip.jsx`** (new file). A small wrapper that takes `label` and `definition` props. If `definition` is falsy it renders `{label}` and nothing else. Otherwise it renders the label, a small "?" indicator (a `<span class="stat-help-mark">`), and a hidden `<span class="stat-help-pop">{definition}</span>`. Internal `useState` toggles a `is-open` class for tap-to-show on touch; hover/focus is pure CSS. A `useEffect` listens for `pointerdown` outside the element to close when tapping elsewhere. ARIA: the popover gets `role="tooltip"` and an `id`; the `<th>` content uses `aria-describedby` pointing at it when open.

3. **`client/src/components/DetailedStats.jsx`** (edit). In `BrefTable`, change `<th key={c.key}>{c.label}</th>` (line 49) to render `<HeaderTooltip label={c.label} definition={STAT_DEFINITIONS[c.key]} />`. Same change applies in `GameLogTable` for the stat header cells (line 124), keying off the `GAMELOG_LABELS` source name — but most game-log columns map to common stats, so the only definitions that fire are FG%, 3P%, FT%. Date/Opp/Result get plain `<th>`.

4. **`client/src/App.css`** (edit). Add a `.stat-help` block: relative-positioned `<th>` content wrapper, the `?` mark as a small superscript in `--text-muted` switching to `--accent` on hover/focus, and the popover as an absolutely-positioned `<span>` with `background: var(--surface-2)`, `border: 1px solid var(--border)`, `color: var(--text)`, max-width ~220px, padding 0.5rem 0.7rem, border-radius matching the table, font-size ~0.78rem, normal (non-uppercase) text-transform, normal weight, line-height 1.35, `white-space: normal`, default `opacity: 0` + `pointer-events: none`, becoming visible under `:hover`, `:focus-within`, and `.is-open`. Position above the header by default; for the rightmost two columns add a modifier class `.stat-help-pop--right` to anchor the popover's right edge to the `?` instead of left edge so it doesn't clip past the table. Indicator size and tooltip shadow should be subtle — this is a stat header, not a CTA.

5. **Visual indicator decision.** Use a small "(?)"-style mark, not an underline and not a different header color. Underlining all defined headers reads as link styling and would confuse users about what's clickable; recoloring the header text fights the existing uppercase-muted aesthetic. The "?" is a universally-understood "more info" affordance and only appears on the ~16 headers that need it, so undefined headers like PTS still look exactly as they do today.

6. **Mobile behavior.** Headers currently have no click handler (`<th>{c.label}</th>` — confirmed in `DetailedStats.jsx` lines 49, 124). Tap-to-toggle on the `?` is therefore safe; nothing else competes. The "Study this table" button and season tabs are below the table header, not inside it, so the popover overlay won't block them. Tapping the same `?` again, or tapping anywhere outside, closes the popover.

7. **Accessibility check.** The `?` mark is a focusable `<button type="button">` (not a `<span>`) with `aria-label="What is {label}?"` and `aria-expanded` reflecting open state. Keyboard users tab into it; Enter or Space toggles. Screen-reader users hear "What is TS%, button collapsed" then on activation hear the definition string. This also satisfies the existing solo-edit code-quality checklist about explicit `type="button"` for buttons inside forms or any context.

## Anti-features (explicitly out of scope)

- **No glossary modal or full "Stats 101" page.** One sentence per header is the entire content surface.
- **No per-row, per-cell tooltips.** Cells already use `title` for percentile rank — that's separate and stays as-is.
- **No value-based explanations** ("This is good because…", "League average is X for guards"). Definitions describe what the stat measures, not how to interpret a specific number. League-average context is included only where it's part of the definition itself (PER 15, WS/48 .100) because those numbers are inseparable from understanding the stat.
- **No external-link footnotes** to Basketball-Reference or similar. Definitions stand alone.
- **No formulas, ever**, in any definition string. The user is here because they don't read formulas.
- **No tooltips on raw counting stats** (PTS, REB, AST, MP, GP, etc.). Adding `?` marks to every column would clutter the very tables we're trying to make approachable.
- **No tooltip library** (Floating UI, Radix, Tippy, react-tooltip). Pure CSS positioning is sufficient given the fixed table-header context; a dependency would violate the project's minimalism stance.
- **No animation beyond a 100ms opacity fade.** The table is information-dense — flashy reveals would compete with the data.

## Risks and mitigations

- **Right-edge clipping.** The popover can extend past the viewport on the rightmost columns (WS/48, PF). Mitigate with the `.stat-help-pop--right` modifier class applied either by CSS `:nth-last-child` or by a `rightAlign` prop passed when the column is in the last two positions. Test at 360px width.
- **Mobile tap-outside-to-close races with table scroll.** A `pointerdown` listener on `document` is enough; capture phase isn't needed because the `?` button stops propagation on its own click.
- **GameLog header keys aren't aligned with the `LABELS` map.** `GameLogTable` uses ESPN-shaped keys (`fieldGoalPct`, `threePointPct`, `freeThrowPct`). Either (a) add aliases in `STAT_DEFINITIONS` for those exact keys, or (b) translate inside the table — preferred is (a) so the data file owns the full vocabulary.
- **PER and WS/48 league-average numbers (15, .100) drift over time.** They're stable enough across years to be safe in a one-sentence definition; revisit only if the WNBA reference framework changes.
- **Definition wording bias.** Several stats are estimates (`USG%`, `AST%`, `ORB%`, `DRB%`, `TRB%`, `STL%`, `BLK%`, `OWS`, `DWS`). Definitions above use the word "estimated" for those to stay honest — don't drop it during copy review.

=== HANDOFF ===
did: designed header-tooltip system for KnowTheW advanced stats (Option B: custom CSS popover + "?" indicator + static definitions registry)
found: headers currently render as plain `<th>{label}</th>` in BrefTable (DetailedStats.jsx:49) and GameLogTable (DetailedStats.jsx:124) with no click behavior — tap-to-toggle is safe; cells already use native `title` for percentile rank so prior art exists; coverage is ~20 stats from ADV_HEADERS_SRV plus the four shooting percentages; raw counting stats stay bare; no new dependencies needed
files-touched: C:\Users\Owner\Desktop\AI\Projects\knowthew\DESIGN-tooltips.md
next-suggested-agent: builder (frontend) — add `client/src/lib/statDefinitions.js`, `client/src/components/HeaderTooltip.jsx`, edit `client/src/components/DetailedStats.jsx` (two `<th>` sites), append CSS block in `client/src/App.css`
blockers: none
=== END HANDOFF ===
