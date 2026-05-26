# HANDOFF — KnowTheW (data-source swappability refactor)

Forward-looking handoff for the active work-stream. **Overwrite** each session; history lives in git.

```yaml
last-model: claude-opus-4.7
last-session: 2026-05-26
state: green
```

Full plan: `C:/Users/Owner/.claude/plans/groovy-meandering-parasol.md` (refactor M0–M9 + 3 selected features). This work-stream is the refactor; features come after.

**Refactor core is DONE: the data source is swappable and proven leak-free** (M0–M6 + M8). Remaining is optional hardening + cleanup, then the features.

## Next action

**M7 — Zod boundary validation** (additive insurance; user approved JSDoc+Zod). `npm install zod`; define schemas mirroring the `types.js` typedefs (Team, RosterPlayer, TeamStats, ScheduleEvent, GameLogResponse, the league shapes); wrap each ESPN provider method's RETURN value in `Schema.safeParse` — on failure log a structured `[provider:espn] shape drift in <method>` warning and pass the value through in prod / throw in dev. Validate the normalized object the provider built, not raw ESPN JSON. This is the silent-drift alarm for an undocumented source.

Then **M9 cleanup** (optional polish): `espnClient.js` is NOT empty — it's the ESPN provider's low-level HTTP/fetch layer that `providers/espn/*` delegates to. Consider relocating it under `providers/espn/` (e.g. `client.js`/`http.js`) for a clean final structure, and giving `formatSeedLabel` (pure ordinal util still imported by `seasonInfo.js`) a home outside it. `pbpExtractor.js` already deleted. Grep importers before moving.

Then the **3 features** (build against `getProvider()`, never raw ESPN): `playerFingerprint` backbone → Archetype Badges + Cross-Era Similarity (share it); On/Off-Court Impact (uses `getGamePbpStats`).

## Traps

- **Provider must be resolved per-call, not at module load.** Consumers use `getProvider()` inside handlers/functions (or via the thin local wrappers). Capturing the provider at module-load time would defeat `STATS_PROVIDER` and the test override (`_setProviderForTest`).
- **Tests must not hit ESPN/Atlas.** `NODE_ENV=test` is set at the top of each test file *before* requiring the app; it gates the espnClient startup prefetch (`server/lib/espnClient.js`) and the Mongo connect (`server/db.js`). Keep that pattern in new test files, and listen on port `0`.
- **`teamSeasonStatsCache` is a live mutable object.** `getProvider().getTeamSeasonStatsCache()` returns the same reference espnClient mutates; stat builders read it after `fetchTeamStats` populates it. Don't copy it.
- **Season-stats payloads are still ESPN-raw** (`getPlayerSeasonStats` returns `{regData, postData}` raw JSON) because `statsParser.parseESPNSeasonData` consumes that shape. Normalizing it (so no raw JSON crosses the boundary) is a later tightening, not M4.
- **Active players** are exposed source-neutrally as `getActivePlayers()` / `findActivePlayer(id)` (no cache objects cross the contract anymore). Advanced-stats callers build a plain `{teamId-year: stats}` map from `getTeamStats()` and pass it to `buildAdvancedSplit` — don't reintroduce a shared mutable cache across the boundary.
- Branch is **`master`**, not `main`. Commits are **not pushed** (per user). Identity-tag + EXPECTED/VERIFIED-BY per `System/CLAUDE/multi-model.md`.

## Do not touch

- Nothing is mid-edit. `espnClient.js` / `pbpExtractor.js` get emptied + deleted only at M9 — leave them until then (other code, e.g. `percentileClient.js`/`historyAggregator.js`, still imports from `espnClient` and gets migrated at M5/M6).

## Recent context

- Refactor goal: route all external-source access through one `SportsDataProvider` contract so swapping ESPN → Sportradar is a `STATS_PROVIDER` env change, not an app rewrite. Driven by Prof Meneely's 2026-05-18 scaling feedback.
- **Done (M0–M6 + M8, ~12 commits `a6b3652`→`1473617`):** `node:test` harness + `lint`/`test`/`check` gate; full `server/providers/` tree (contract base class, `types.js` typedefs + `PBP_OC_KEYS`, ESPN impl split into `playerStats`/`gamelog`/`gameSummary`/`leagueStats`, sportradar stub, `getProvider()` factory with `_setProviderForTest`). Migrated every consumer: `/teams`, clean consumers, player metadata/stats, gamelog (client `GameLogTab` renders from server `columns`), PBP/boxscore (`pbpExtractor.js` deleted; raw summary stays in provider), percentile byathlete indices (`leagueStats.js`), and `historyAggregator` standings/playoff fetches. Replaced the leaky cache accessors with source-neutral `getActivePlayers`/`findActivePlayer` + plain stats maps. **M8 leak test proves it:** ESPN overrides every contract method; the sportradar stub throws on every one; `STATS_PROVIDER=sportradar` boots + fails loudly on first data call.
- **Characterization tests** lock the numerically-sensitive transforms: `gamelog-normalize` (M4), `pbp-extract` (M5), `leaguestats-map` (M6 — every byathlete index across PerGame/Totals/Per36).
- **Only `espnClient` (ESPN's HTTP layer, used by `providers/espn/*`) + `seasonInfo`'s pure `formatSeedLabel` import remain on the old module** — no data-fetch leaks left.
- **Remaining:** M7 Zod (next), M9 optional cleanup, then the 3 features. Decisions locked: JSDoc + Zod; client gets server-emitted `columns` (gamelog done; detailed-stats `STAT_COLUMNS` still to do).
- Each milestone ends with `npm run check` green; add characterization tests (captured-fixture snapshots) at M4/M5/M6 — that's the safety net for silent numeric regressions.
