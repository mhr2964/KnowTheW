# HANDOFF — KnowTheW (data-source swappability refactor)

Forward-looking handoff for the active work-stream. **Overwrite** each session; history lives in git.

```yaml
last-model: claude-opus-4.7
last-session: 2026-05-27
state: green
```

Full plan: `C:/Users/Owner/.claude/plans/groovy-meandering-parasol.md` (refactor M0–M9 + 3 selected features). **The refactor work-stream is COMPLETE (M0–M9).** Next up is the features.

**Refactor DONE: the data source is swappable, proven leak-free (M0–M6 + M8), validated at the boundary (M7), and structurally cleaned up (M9).**

## Next action

**Player Archetype Badges is DONE** — built + refined through a 5-iteration eval→fix loop (`1bb2e9e`→`4f8bf93`, not pushed). Remaining of the 3 features, in order:

- **Cross-Era Similarity** ("players like X") — NEXT. Reuses the now-built fingerprint: `fingerprintDistance(a, b)` from `server/lib/analysis/playerFingerprint.js` already gives the era-normalized RMS distance / `similarity` 0-100. Build = rank a candidate pool by distance to the target's career fingerprint (pure math; the hard part is choosing/iterating the candidate set, likely the player index). Era-normalization is already free (percentiles are vs-league).
- **On/Off-Court Impact** = team net rating on vs off; PBP data already in `getGamePbpStats`. Independent of the fingerprint.

### Player Archetype Badges — what shipped (post 5-iteration loop)
- `playerFingerprint.js` — 13 era-normalized percentile axes (from the existing percentile pipeline → era-normalization is free); minutes-weighted career aggregate; **excludes the in-progress season** (`seasonWindow.latestCompletedSeason`) so the fingerprint is **deterministic** (was jittering between restarts off live ESPN data); sample gate ≥500 career min; `fingerprintDistance` (RMS). `buildDimensions` collapses the 13 axes → **5 play dimensions** (Scoring/Shooting/Playmaking/Rebounding/Defense): Defense is position-aware+tempered (`0.65·dominant+0.35·other`, guards steals-led / bigs blocks-led), Playmaking blends assist volume + AST/TO. Pure core; async assembler is `getPlayerFingerprint`.
- `archetypes.js` — 12 position-gated prototypes; `ASSIGN_MAX_DISTANCE=20`. A match must (a) be within distance, (b) not be contradicted by the player's top dimension (`PRIMARY_GAP=25`), and (c) have its defining skill present (`PRIMARY_FLOOR=58`). Else a **dimension-driven fallback**: 2+ balanced strong dims → Versatile; a dominant strength (top−2nd ≥`DOMINANT_GAP=15`) or a single strong dim → **Specialist** (Defensive/Rebounding Specialist, Floor Spacer, Playmaker, Volume Scorer); none → Role Player. **The 5 dimensions are the single source of truth for both the fallback label and the descriptor**, so they can't contradict.
- `buildDescriptor` — templated (no-AI) one-liner from the dimensions; strengths-only + a genuine limitation **only when not position-expected** (bigs don't read "isn't a primary creator", guards don't read "doesn't crash the glass").
- `ArchetypeBadge.jsx` + `FingerprintRadar.jsx` — pill + hover card: descriptor → **5-spoke radar** (shape = playstyle) → "All 13 stats" toggle. Open model = `hovered` OR `pinned` (click pins); fixed the old click-closes-it bug.
- **Tuning knobs (all named in `archetypes.js`/`playerFingerprint.js`):** `ASSIGN_MAX_DISTANCE`, `PRIMARY_GAP`, `PRIMARY_FLOOR`, `DOMINANT_GAP`, `STRONG_DIM`, defense + playmaking blend weights.
- **Verified:** `npm run check` (70 tests) + lint green; 207-player sweep is deterministic with **zero label↔descriptor contradictions**; regression set holds (A'ja→Interior Anchor, Ionescu→Combo Guard, Plum→Three-Level Scorer, AT→Point Forward, Nneka/Stewart→Two-Way Forward, Vandersloot→Playmaker).
- **Full eval log + still-open refinements:** `Brain/Note Pad/knowthew-archetype-eval.md` (Chelsea Gray FG-vs-scorer, Combo Guard's "primary=scoring", Role-Player 65-cliff, career-vs-peak, `latestCompletedSeason` date heuristic → schedule detection, truth set → committed offline test).

### Done since last handoff (M7 + M9, pushed)
- **M7 (`9bcc966`)** — Zod boundary validation. `server/providers/schemas.js` (schemas mirroring types.js typedefs) + `server/providers/validation.js` (`withValidation` Decorator/Proxy over a provider). Wired in `providers/espn/index.js` (`module.exports = withValidation(new EspnProvider())`). Throws `ProviderShapeError` in dev/test, logs + passes through in prod. `test/validation.test.js` covers it. Only normalized returns are validated (the `*Raw` / season-stats / numeric league maps are intentionally unvalidated — add to `SCHEMA_BY_METHOD` when normalized).
- **M9 (`b4fa837`)** — relocated `server/lib/espnClient.js` → `server/providers/espn/client.js`; extracted pure `formatSeedLabel` → `server/lib/ordinal.js`; dropped the dead `formatSeedLabel` provider passthrough. No live code imports `espnClient` anymore.

## Traps

- **Provider must be resolved per-call, not at module load.** Consumers use `getProvider()` inside handlers/functions (or via the thin local wrappers). Capturing the provider at module-load time would defeat `STATS_PROVIDER` and the test override (`_setProviderForTest`).
- **Tests must not hit ESPN/Atlas.** `NODE_ENV=test` is set at the top of each test file *before* requiring the app; it gates the espnClient startup prefetch (`server/lib/espnClient.js`) and the Mongo connect (`server/db.js`). Keep that pattern in new test files, and listen on port `0`.
- **`teamSeasonStatsCache` is a live mutable object.** `getProvider().getTeamSeasonStatsCache()` returns the same reference espnClient mutates; stat builders read it after `fetchTeamStats` populates it. Don't copy it.
- **Season-stats payloads are still ESPN-raw** (`getPlayerSeasonStats` returns `{regData, postData}` raw JSON) because `statsParser.parseESPNSeasonData` consumes that shape. Normalizing it (so no raw JSON crosses the boundary) is a later tightening, not M4.
- **Active players** are exposed source-neutrally as `getActivePlayers()` / `findActivePlayer(id)` (no cache objects cross the contract anymore). Advanced-stats callers build a plain `{teamId-year: stats}` map from `getTeamStats()` and pass it to `buildAdvancedSplit` — don't reintroduce a shared mutable cache across the boundary.
- Branch is **`master`**, not `main`. Commits are **not pushed** (per user). Identity-tag + EXPECTED/VERIFIED-BY per `System/CLAUDE/multi-model.md`.

## Do not touch

- Nothing is mid-edit. The refactor is complete; start the features fresh.

## Recent context

- Refactor goal: route all external-source access through one `SportsDataProvider` contract so swapping ESPN → Sportradar is a `STATS_PROVIDER` env change, not an app rewrite. Driven by Prof Meneely's 2026-05-18 scaling feedback.
- **Done (M0–M6 + M8, ~12 commits `a6b3652`→`1473617`):** `node:test` harness + `lint`/`test`/`check` gate; full `server/providers/` tree (contract base class, `types.js` typedefs + `PBP_OC_KEYS`, ESPN impl split into `playerStats`/`gamelog`/`gameSummary`/`leagueStats`, sportradar stub, `getProvider()` factory with `_setProviderForTest`). Migrated every consumer: `/teams`, clean consumers, player metadata/stats, gamelog (client `GameLogTab` renders from server `columns`), PBP/boxscore (`pbpExtractor.js` deleted; raw summary stays in provider), percentile byathlete indices (`leagueStats.js`), and `historyAggregator` standings/playoff fetches. Replaced the leaky cache accessors with source-neutral `getActivePlayers`/`findActivePlayer` + plain stats maps. **M8 leak test proves it:** ESPN overrides every contract method; the sportradar stub throws on every one; `STATS_PROVIDER=sportradar` boots + fails loudly on first data call.
- **Characterization tests** lock the numerically-sensitive transforms: `gamelog-normalize` (M4), `pbp-extract` (M5), `leaguestats-map` (M6 — every byathlete index across PerGame/Totals/Per36).
- **M7 + M9 now done too** (`9bcc966`, `b4fa837`): Zod boundary validation + ESPN-client relocation under `providers/espn/client.js`. No code imports the old `espnClient` path anymore.
- **Remaining: the 3 features.** Decisions locked: JSDoc + Zod; client gets server-emitted `columns` (gamelog done; detailed-stats `STAT_COLUMNS` still to do, a nice-to-have, not blocking the features).
- Each milestone ends with `npm run check` green; characterization tests (captured-fixture snapshots) guard the numerically-sensitive transforms — add the same kind for the fingerprint/archetype/similarity math (a known-player truth set IS the archetype test).
