# HANDOFF — KnowTheW (data-source swappability refactor)

Forward-looking handoff for the active work-stream. **Overwrite** each session; history lives in git.

```yaml
last-model: claude-opus-4.7
last-session: 2026-05-26
state: green
```

Full plan: `C:/Users/Owner/.claude/plans/groovy-meandering-parasol.md` (refactor M0–M9 + 3 selected features). **The refactor work-stream is COMPLETE (M0–M9).** Next up is the features.

**Refactor DONE: the data source is swappable, proven leak-free (M0–M6 + M8), validated at the boundary (M7), and structurally cleaned up (M9).**

## Next action

**The 3 features** (build against `getProvider()`, never raw ESPN). Dependency order: build the shared `server/lib/analysis/playerFingerprint.js` backbone FIRST, then it powers both Archetype Badges and Cross-Era Similarity; On/Off-Court Impact is independent and uses `getGamePbpStats`.

- **Player Archetype Badges** is the user's headline ask. Critical design constraints (from the user's critique of the Reddit roles paper): readable archetype names, no blanket weaknesses a player doesn't actually have, no forcing dissimilar players into one bucket. Method = continuous 13-axis fingerprint + prototype-anchored assignment + trait modifiers + "versatile/all-around" fallback + sample gating; hover card shows the player's OWN fingerprint so the label is visibly justified. Accuracy gate: a known-player truth set (incl. hard cases like Alyssa Thomas) must pass before ship. See the plan file Part 2 Feature A for the full spec.
- **Cross-Era Similarity** ("players like X") reuses the fingerprint, era-normalized; pure distance math.
- **On/Off-Court Impact** = team net rating on vs off; PBP data already in `getGamePbpStats`.

Run `>>think` before building the fingerprint module (new module, multi-file blast radius, backs two features).

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
