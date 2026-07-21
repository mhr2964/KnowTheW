# DESIGN — Compare v2 (AI-Graded Player Reports)

Status: design, pending dispatch
Author: architect agent, 2026-05-11
Replaces: compare v1.5 (year-aligned merged stat table)

---

## 1. Problem restatement

The current Player Comparison page is a dense merged stat table with no AI judgment and no clear "who is better" signal — we are pivoting to an AI-graded, side-by-side report scoped by mode (Peak / Full Career / Playoffs) with a glanceable verdict that explicitly accounts for volume and games played.

---

## 2. Decision rationale per question

### 2.1 Per-player report vs per-pair report — choose **per-player (Option A)**

Each player gets a graded report cached forever per `(playerId, mode, sourceHash, PROMPT_VERSION)`. The compare page fetches two independent reports and the page composes the verdict client-side.

Why:

- **Cost scales linearly with players, not pairs.** ~450 players × 3 modes = ~1350 reports lifetime cap. Per-pair would explode to ~300k pair-mode cells, mostly never queried but each first view paying Claude.
- **Reusable surface.** A graded report is a coherent artifact on its own — a future "AI report card" widget on `PlayerPage` can render the same payload. Per-pair reports cannot be reused outside the compare context.
- **Determinism for verdict.** The "who wins at a glance" line is a deterministic function of two grade payloads + GP — no second Claude call, no temperature variance between renders.
- **Stable cache key shape.** Per-player keys mirror the existing `teamNarratives` pattern (one `_id` per entity). Per-pair would need a canonicalized `min(idA,idB)-max(idA,idB)` key and double the surface area for cache invalidation.

Tradeoff accepted: comparison prose is not custom-fit ("Stewart vs Lexie"). We replace bespoke prose with a deterministic verdict header + per-category grade context strings. Acceptable because the user's stated pain is volume/GP clarity and grade legibility, not narrative quality.

### 2.2 Grading schema — six contextual categories + overall

Categories, ordered as they render top-to-bottom:

| Category | Inputs the AI sees | Notes |
| --- | --- | --- |
| **Scoring** | PPG, FG%, 3P%, FT%, TS%, FGA volume | TS% is the truth-teller; PPG without efficiency gets capped |
| **Playmaking** | APG, AST%, TOV/g, AST/TO ratio | Heavy weight on AST% over raw APG |
| **Rebounding** | TRB/g, ORB%, DRB%, height/position context if available | Position-aware grading expected |
| **Defense** | STL/g, BLK/g, STL%, BLK%, DRtg if computed | Acknowledged thin — surface uncertainty in the context string |
| **Efficiency / Impact** | PER, WS, WS/48, BPM if available | The "advanced composite" — what BBRef wonks weight most |
| **Longevity / Durability** | GP totals, seasons played, peak-window length, missed-season count if inferable | The volume column — also feeds the at-a-glance verdict |

Plus **Overall** — a synthesizing letter grade with a 1–2 sentence summary. Overall is not the arithmetic mean of categories; the prompt instructs the AI to weight Efficiency / Impact and Longevity heavily for Career mode, and to weight Scoring + Efficiency for Peak mode.

**Contextual to WNBA history, not absolute.** The prompt explicitly anchors grades to "where this player ranks against the population of WNBA players who have played meaningful minutes." Without this anchor every non-Stewart player drifts to C and the feature has no signal. With it, a solid 5-year role player can earn a B in their specialty category while still landing a C overall.

**Letter scale.** A+ / A / A- / B+ / B / B- / C+ / C / C- / D+ / D / D- / F. Thirteen steps. The prompt explicitly biases against grade inflation (see prompt skeleton, section 5).

### 2.3 Mode toggle — Peak / Full Career / Playoffs (v1)

Ship these three. Defer Recent-3 and Rookie windows to v2.

- **Peak** — AI receives all regular-season rows and picks the best 3–5 consecutive prime seasons. Returns `peakSeasons: [years]` alongside grades for that window. The chosen window is rendered to the user under the mode toggle ("Showing 2018–2020 for Stewart, 2023–2025 for Lexie") so they can audit the AI's pick.
- **Full Career** — all regular-season rows + career row. Career row is the source of truth for cumulative totals; per-season rows give shape (peak-vs-decline) for the context strings.
- **Playoffs** — all playoff season rows + playoff career row. If a player has zero playoff GP, render an empty-state card ("No playoff data for this player") instead of fetching a report.

Default mode on first load: **Full Career**.

### 2.4 Volume weighting and the at-a-glance verdict

Computed client-side from the two report payloads. Layout:

- **Categories won** — `Stewart wins 4 / Lexie wins 1 / Tie 1`. Tie when grades are equal.
- **Overall winner + margin** — letter grades shown side-by-side with the higher one bolded.
- **Volume signal** — emitted only when one player's GP for the mode is ≥1.5× the other's, or when one has ≤30 GP and the other has ≥100. Example: `Stewart's grades reflect 350 GP across 10 seasons; Lexie's reflect 95 GP across 3 seasons.`
- **Per-card GP/seasons footnote** — every category card also shows `(N GP, M seasons)` so the volume context is visible per grade, not only in the header.

Grade-to-points map for "categories won": exact letter equality is a tie; otherwise A+ > A > A- > B+ > … > F. No partial credit for adjacent grades.

### 2.5 Page layout

Desktop:

```
┌────────────────────────────────────────────────────────────────────┐
│ ← Back                                                             │
├────────────────────────────────────────────────────────────────────┤
│  [photo]  Breanna Stewart        VS        Lexie Hull  [photo]     │
│           Seattle Storm                    Indiana Fever            │
│           Change                                       Change       │
├────────────────────────────────────────────────────────────────────┤
│  Mode:  [ Peak ]  [ Full Career ]  [ Playoffs ]                    │
│  Peak window: Stewart 2018–2020  ·  Hull 2023–2025                  │
├────────────────────────────────────────────────────────────────────┤
│  AT A GLANCE                                                       │
│  Stewart wins 5 / 1 / Tie 0                                        │
│  Overall:  A   ◀   B-                                              │
│  Volume:   Stewart 102 GP, 3 seasons  ·  Hull 87 GP, 3 seasons     │
├────────────────────────────────────────────────────────────────────┤
│  SCORING                                                           │
│  ┌──────────────────────────┬──────────────────────────┐           │
│  │ Stewart           A+     │ Hull              B-     │           │
│  │ 26.3 PPG · .478 FG%      │ 12.1 PPG · .442 FG%      │           │
│  │ .390 3P% · .780 FT%      │ .378 3P% · .810 FT%      │           │
│  │ (102 GP, 3 seasons)      │ (87 GP, 3 seasons)       │           │
│  └──────────────────────────┴──────────────────────────┘           │
│  AI context: Stewart was league MVP-caliber across this stretch,   │
│  combining 26+ PPG with elite efficiency. Hull is a high-quality   │
│  complementary scorer whose grade reflects role, not ceiling.      │
│                                                                    │
│  PLAYMAKING                                                        │
│  …                                                                 │
│                                                                    │
│  (repeats for Rebounding, Defense, Efficiency, Longevity)          │
├────────────────────────────────────────────────────────────────────┤
│  Disclaimer: Grades are AI-generated from WNBA box-score data and  │
│  league context. They are interpretive, not authoritative.         │
└────────────────────────────────────────────────────────────────────┘
```

Mobile (≤640px):

- Hero collapses to two stacked rows; "VS" pill sits between them.
- Mode toggle stays full-width.
- At-a-glance card stacks: row 1 = categories won; row 2 = overall; row 3 = volume.
- Each category card renders as two stacked sub-cards (Player A above Player B), then the AI context paragraph below. Grade pill is right-aligned on each sub-card so the letter is the loudest element when scrolling.

### 2.6 Source data for grading

For each `(playerId, mode)` cache miss the route assembles:

1. Player profile basics — name, position, height if known (helps position-aware rebounding/defense grading).
2. Per-season rows from `/api/players/:id/detailed-stats` filtered by mode:
   - Peak → all regular season rows (AI picks the window)
   - Career → all regular season rows + `regularCareer` aggregate row
   - Playoffs → all playoff season rows + `playoffCareer` aggregate row
3. Advanced split rows (PER, WS, WS/48, BPM where computed) from `/api/players/:id/advanced-pbp-all`, filtered the same way.
4. League averages for each season touched (sliced from `WNBA_LG` in `server/constants/leagueAverages.js`). For Career mode, pass the per-season averages for every year the player played; AI uses them to calibrate (a 22 PPG season in 2002 is different from 22 PPG in 2024).

No new data sources. No All-Star / All-WNBA / championship inputs — we don't have them, and asking the AI to remember them invites hallucination. Prompt explicitly forbids referencing accolades it isn't given.

### 2.7 Endpoint design

**New route:** `GET /api/players/:id/graded-report?mode=peak|career|playoffs`

Validation: `:id` must match `^\d+$`; `mode` must be one of the three literals (default `career` if absent).

Response shape:

```
{
  "playerId":   "2998928",
  "playerName": "Breanna Stewart",
  "mode":       "peak",
  "peakSeasons": [2018, 2019, 2020],   // present only when mode === 'peak'
  "categories": {
    "Scoring":    { "grade": "A+", "stats": "26.3 PPG, .478 FG%, .390 3P%, .780 FT%, .615 TS%", "context": "…" },
    "Playmaking": { "grade": "A-", "stats": "5.5 APG, 2.5 TO/g, 2.2 AST/TO",                    "context": "…" },
    "Rebounding": { "grade": "A+", "stats": "9.1 TRB/g, 6.3 OREB%, 22.1 DREB%",                 "context": "…" },
    "Defense":    { "grade": "A",  "stats": "1.4 STL, 1.5 BLK, 100.4 DRtg",                     "context": "…" },
    "Efficiency": { "grade": "A+", "stats": "27.4 PER, 9.8 WS, .222 WS/48",                     "context": "…" },
    "Longevity":  { "grade": "A-", "stats": "3 peak seasons, 102 GP",                            "context": "…" }
  },
  "overall":    { "grade": "A+", "summary": "Peak Stewart was a top-tier MVP candidate combining volume scoring with elite efficiency." },
  "volume":     { "gp": 102, "seasons": 3, "minutes": 3268 },
  "generatedAt": "2026-05-11T19:42:00.000Z",
  "sourceHash":  "<sha1 head>"
}
```

503 when `gradedReportClient.enabled === false` (no `ANTHROPIC_API_KEY`).
502 on Claude error or shape-validation failure.
404 when player id resolves to nothing.
200 with `{ empty: true }` when mode is `playoffs` and the player has zero playoff GP — page renders the empty-state card.

### 2.8 Cost model — accept

Claude Haiku 4.5 (same model as narratives): ~$0.005 per fresh report. 100 cached players × 3 modes = ~$1.50 total burn upper bound. Cache hits are free. PROMPT_VERSION bumps invalidate everything — budget for one regen pass (~$7 worst case if all 1350 slots ever filled) when iterating on the prompt.

---

## 3. AI prompt skeleton

Mirror `narrativeClient.js`: defensive init, ephemeral-cached system prompt, tool-forced JSON output, validate shape before returning.

### 3.1 Tool spec (`graded_player_report`)

```
{
  name: 'graded_player_report',
  description: 'Output a structured graded report for a WNBA player.',
  input_schema: {
    type: 'object',
    properties: {
      peakSeasons: { type: 'array', items: { type: 'integer' } },   // optional; only filled when mode is 'peak'
      categories: {
        type: 'object',
        properties: {
          Scoring:    { $ref: '#/$defs/gradeCard' },
          Playmaking: { $ref: '#/$defs/gradeCard' },
          Rebounding: { $ref: '#/$defs/gradeCard' },
          Defense:    { $ref: '#/$defs/gradeCard' },
          Efficiency: { $ref: '#/$defs/gradeCard' },
          Longevity:  { $ref: '#/$defs/gradeCard' }
        },
        required: ['Scoring','Playmaking','Rebounding','Defense','Efficiency','Longevity']
      },
      overall: {
        type: 'object',
        properties: {
          grade:   { type: 'string', enum: ['A+','A','A-','B+','B','B-','C+','C','C-','D+','D','D-','F'] },
          summary: { type: 'string' }
        },
        required: ['grade','summary']
      }
    },
    required: ['categories','overall'],
    $defs: {
      gradeCard: {
        type: 'object',
        properties: {
          grade:   { type: 'string', enum: ['A+','A','A-','B+','B','B-','C+','C','C-','D+','D','D-','F'] },
          stats:   { type: 'string', description: 'Short comma-separated supporting numbers — no commentary.' },
          context: { type: 'string', description: '1-2 sentences explaining the grade in WNBA-historical context.' }
        },
        required: ['grade','stats','context']
      }
    }
  }
}
```

Builder note: JSON Schema `$defs` may or may not work cleanly with Anthropic's tool schema validator — if it does not, inline the `gradeCard` object six times. Functional shape is what matters.

### 3.2 System prompt (text, cached ephemerally)

The prompt must establish, in order:

- Role — "You are a WNBA stat analyst who assigns letter grades to player performance based on box-score data and league context."
- Grade scale and anchor — "Letters are A+ down to F. Grade contextually against the population of WNBA players who have played at least 200 career games. Reserve A+ for top-5-all-time territory in that category. Most starting players should land in the B- to A- range. Most reserve players should land C+ to B. Do not inflate."
- Volume rule — "Per-game stats earned over a small sample (under 50 GP for Peak / Playoffs, under 100 GP for Career) cap at B+ regardless of rate. Note the sample-size caveat in the context string."
- Position awareness — "A guard with 6 RPG is exceptional; a center with 6 RPG is below average. Grade rebounding and defense with positional context when position is provided."
- Mode-specific weighting for Overall — "For Career mode, weight Efficiency/Impact and Longevity most heavily in Overall. For Peak mode, weight Scoring and Efficiency. For Playoffs mode, weight Efficiency and the sample of high-leverage games played."
- Hallucination guard — "Use only the numbers and league averages provided. Do not reference championships, All-Star selections, awards, or coaching unless these are present in the input. Do not invent statistics. If a stat is missing, omit it from the `stats` string."
- Peak picker — "When the user message specifies mode=peak, choose 3 to 5 consecutive seasons that maximise combined scoring volume and efficiency; return them in `peakSeasons` ascending."
- Output discipline — "Output structured JSON via the `graded_player_report` tool only. Keep `context` strings under 220 characters each. Keep `summary` under 280 characters."

### 3.3 User message shape

```
Player: Breanna Stewart
Position: F
Mode: peak
Per-season rows (regular):
  2016: 73 GP, 18.3 PPG, 8.5 RPG, ...
  2017: 32 GP, 19.4 PPG, 8.7 RPG, ...
  2018: 34 GP, 21.8 PPG, 8.4 RPG, ...
  ...
Advanced rows:
  2018: 23.4 PER, 7.8 WS, .175 WS/48
  ...
League averages (per team per game) for relevant seasons:
  2018: 82.8 PPG, 68.8 FGA, .445 FG%, ...
  2019: 78.7 PPG, ...
  ...
Career totals (regular): 240 GP, ...
```

PROMPT_VERSION starts at 1. Bump whenever the system prompt text, tool schema, or model identifier changes.

### 3.4 Shape validation

`validateReportShape(input)` — same defensive style as `validateNarrativeShape`:

- `categories` is an object with all six keys.
- Each card's `grade` is in the allowed enum.
- Each card's `stats` and `context` are non-empty strings.
- `overall.grade` is in the allowed enum; `overall.summary` is non-empty.
- When the mode is `peak`, `peakSeasons` is a non-empty array of integers ≥1997.

Throw a descriptive error on violation so the route returns 502 rather than caching malformed data.

---

## 4. Cache design

Mirror `teamNarratives` exactly.

- **Collection:** `playerGradedReports`
- **Document `_id`:** `"<playerId>-<mode>-<sourceHashHead8>"` — embedding the hash head in the key means a stat correction or prompt-version bump writes a new doc rather than overwriting; the old one stays available for forensic comparison until you prune. (The team narrative collection overwrites; for players we want the audit trail because grades are subjective.)
- **Document body:** `{ _id, playerId, mode, data, sourceHash, generatedAt, promptVersion }`
- **Source hash inputs (JSON-stringified, then SHA-1):**
  - `promptVersion` from `gradedReportClient.PROMPT_VERSION`
  - `playerId`, `playerName`, `position`
  - `mode`
  - Per-season rows (regular or playoff per mode), sorted by year ascending — only stat-bearing fields, no team-abbreviation noise
  - Advanced rows for the same seasons
  - League averages for each touched year, sorted by year
- **Lookup:** find by exact `_id` only. On miss, regenerate.
- **Manual refresh:** admin-token-gated `?refresh=1` same as narrative route — timing-safe compare.
- **Graceful degradation:** if `getDb()` returns null, log a warning and call Claude directly, same as narrative route. No cache, no crash.
- **Write gate:** fire-and-forget `replaceOne` with `upsert:true`. Write failures are logged and swallowed — the response still goes back to the client.

Why the hash in the key, not in a sibling field: it lets a single Mongo query (`findOne({ _id: composedKey })`) decide cache hit without a second `sourceHash === computed` comparison. It also makes pruning by mode trivial (`{ _id: { $regex: '^<id>-peak-' } }`).

---

## 5. Implementation outline

### Backend (one builder dispatch)

1. **`server/lib/gradedReportClient.js` — new file.** Pattern-match `narrativeClient.js` line-for-line. Exports `getGradedReport({ player, seasonRows, advancedRows, leagueAverages, mode })`, `PROMPT_VERSION`, and an `enabled` getter. Includes tool definition, system prompt constant, `validateReportShape`, and the Anthropic call with `tool_choice: { type:'tool', name:'graded_player_report' }`.
2. **`server/lib/gradedReportInputs.js` — new helper.** Given a `playerId` and `mode`, fetch detailed-stats + advanced-pbp-all (reusing the existing helpers `fetchPlayerSeasonData` / `buildDetailedStats` and the advanced builder), then assemble the input bundle: filter rows by mode, slice `WNBA_LG` for the touched years, return `{ player, seasonRows, advancedRows, leagueAverages, careerRow }`. Returns `{ empty: true }` when mode is `playoffs` and there are no playoff rows.
3. **`server/routes/api.js` — add `GET /players/:id/graded-report`.** Validation, 503 guard on `gradedReportClient.enabled`, build the input bundle, compute `sourceHash` (JSON-stringify the canonical input set, SHA-1), compose `_id`, Mongo lookup, call Claude on miss, persist, return. Empty-state short-circuit when input bundle reports `empty: true`. Honor `?refresh=1` + admin-token same as narrative route.
4. **Tests** — `server/__tests__/gradedReport.test.js` (or equivalent location based on existing test conventions): cover shape validation rejects malformed responses, mode filtering, empty-playoffs short-circuit, hash determinism.

### Frontend (one builder dispatch)

5. **`client/src/lib/compareVerdict.js` — new pure module.** `computeVerdict(reportA, reportB)` → `{ wonByA, wonByB, tied, overallWinner, overallMargin, volumeSignal }`. Includes the grade-to-points map (A+=12 … F=0) for category counting and the volume-signal threshold (1.5× or ≤30 vs ≥100 GP rule).
6. **`client/src/components/GradeCard.jsx` — new.** Renders one category for both players: two stat boxes side-by-side with grade pills, then the AI context paragraph below. Mobile-stack variant.
7. **`client/src/components/CompareHero.jsx` — extracted from current ComparePage.** Keep the existing dual-headshot hero; trim to two columns + "VS" pill + Change buttons. Drop the old skeleton-table dependency.
8. **`client/src/components/CompareModeToggle.jsx` — new.** Three-button toggle; under it, when mode is `peak`, shows the auto-picked peak windows for each player.
9. **`client/src/components/CompareGlance.jsx` — new.** The "at a glance" header card: categories won, overall winner with margin, volume signal.
10. **`client/src/pages/ComparePage.jsx` — substantial rewrite.** Replace all `CompareTable` / `buildMergedRows` / `extractAdvanced` / `extractDetailed` logic. New flow: fetch player profiles, fetch graded reports for both players via `useLazyFetch('/api/players/:id/graded-report?mode=...')`, compose verdict, render Hero → ModeToggle → Glance → six GradeCards → Disclaimer. URL `/compare/:idA/:idB` unchanged; picker modal unchanged; back-button behavior unchanged.
11. **CSS — `client/src/index.css` or the compare-scoped sheet.** Grade-pill colors (A-tier green, B-tier blue, C-tier neutral, D/F-tier muted red); grade-card layout; at-a-glance card; mobile-stack rules. Reuse existing hero / picker styles.
12. **Archive the v1 internals.** Move `client/src/components/CompareTable.jsx` and `client/src/lib/compareTableRows.js` to `Archive/knowthew-compare-v1/`. Workspace memory says archive, not delete. Strip imports from any remaining live files (only `ComparePage.jsx` imports them today).

### Out of scope (deferred)

- Recent-3 and Rookie-3 modes.
- Surfacing the per-player report on `PlayerPage` directly.
- A "share verdict" link.
- Background pre-warming of the cache for the most-viewed players.

---

## 6. Files

**New:**

- `server/lib/gradedReportClient.js`
- `server/lib/gradedReportInputs.js`
- `client/src/lib/compareVerdict.js`
- `client/src/components/GradeCard.jsx`
- `client/src/components/CompareHero.jsx`
- `client/src/components/CompareModeToggle.jsx`
- `client/src/components/CompareGlance.jsx`
- (test file under existing server test convention)

**Modified:**

- `server/routes/api.js` — add `/players/:id/graded-report` route below the existing player routes.
- `client/src/pages/ComparePage.jsx` — substantial rewrite (URL contract preserved).
- `client/src/index.css` (or the compare CSS partial) — new grade-pill / card / glance styles.

**Archived (move, do not delete):**

- `client/src/components/CompareTable.jsx` → `Archive/knowthew-compare-v1/CompareTable.jsx`
- `client/src/lib/compareTableRows.js` → `Archive/knowthew-compare-v1/compareTableRows.js`

`client/src/components/ComparePickerModal.jsx` stays — picker UX is unchanged.

---

## 7. Backwards compatibility

- URL `/compare/:idA/:idB` continues to route to the rewritten `ComparePage`.
- Entry points (PlayerPage's "Compare" button, anywhere else that links to compare) remain valid — they hit the same URL.
- Picker modal unchanged; "Change" buttons in the new hero open it the same way.
- Old merged-table internals are archived; nothing else in the app imports them (confirmed by reading `ComparePage.jsx` — it is the sole consumer of `CompareTable` and `compareTableRows`).

---

## 8. Risks and mitigations

- **Grade inflation.** AI tends toward "everyone is great." Mitigated by (a) explicit anchoring language in the system prompt ("reserve A+ for top-5 all-time; most players should fall C+ to A-"); (b) per-category volume caps for small samples; (c) we eyeball the first ~10 reports during rollout and tune PROMPT_VERSION accordingly. Long-tail mitigation: add a manual override table later that lets us pin specific player-mode grades if community feedback demands it.
- **Grade subjectivity.** Letter grades are not falsifiable. Mitigated by the disclaimer at the bottom of the page and by surfacing the `stats` string under each grade — readers can audit the numbers even if they reject the letter. Auditable peak-window picker (we display the chosen years) lets readers second-guess that step specifically.
- **Hallucination in context strings.** AI might reference championships, awards, or specific games it wasn't given. Mitigated by prompt language ("use only data provided; do not reference accolades or championships unless present in the input") and by the `stats` field being a structured echo of provided numbers, so any invented stat is caught visually next to the AI prose.
- **Sparse-data players** (rookies, players with <30 GP). Grades will be unreliable. Mitigated by the small-sample cap in the prompt (caps at B+) and by Longevity grade reflecting the gap. Future v2: show a "Limited sample — interpret carefully" banner when mode-GP falls under a threshold.
- **Missing playoff data.** Some players have never played a playoff game. Handled by the route returning `{ empty: true }` and the page rendering an empty-state card for that side instead of trying to compose a verdict. When BOTH players have no playoff data, the Playoffs mode tab is disabled.
- **Claude API outage.** Defensive init + 503 from the route. Page renders an error state inviting the user to retry or switch modes. Cached reports continue to render fine.
- **MongoDB unavailable.** Same graceful path as `teamNarratives` — log warning, call Claude directly, return ungrated. In dev with no Mongo this is fine; in prod we treat repeated unbilled-but-paid hits as a monitoring signal.
- **Prompt iteration cost.** Bumping `PROMPT_VERSION` invalidates everything. Upper bound is ~$7 to refill all 1350 slots; in practice we only regen the slots that are actually viewed, so a prompt bump pays incrementally. Acceptable.

---

=== HANDOFF ===
did: designed Compare v2 — AI-graded per-player reports with mode toggle (Peak / Career / Playoffs), client-side verdict, BBRef-style consolidated layout
found: per-player report (not per-pair) is the right unit; mirrors narrativeClient.js cache pattern exactly; 6 grade categories + overall; volume/GP surfaced in both header and per-card footnotes; URL contract preserved
files-touched: C:\Users\Owner\Desktop\AI\Projects\knowthew\DESIGN-compare-v2.md
next-suggested-agent: builder (one backend dispatch for the route + client + inputs helper; one frontend dispatch for the page rewrite + new components + verdict module + archival of v1 components)
blockers: none
=== END HANDOFF ===
