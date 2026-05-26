# HANDOFF — KnowTheW (data-source swappability refactor)

Forward-looking handoff for the active work-stream. **Overwrite** each session; history lives in git.

```yaml
last-model: claude-opus-4.7
last-session: 2026-05-26
state: green
```

Full plan: `C:/Users/Owner/.claude/plans/groovy-meandering-parasol.md` (refactor M0–M9 + 3 selected features). This work-stream is the refactor; features come after.

## Next action

Start **M6 — absorb the percentile league-stats fetch** (HIGHEST RISK): move `fetchEspnLeagueStats`, `espnByAthleteProvider` (the 20+ hardcoded `categories[].values[]` positional indices), `fetchEspnIndividualSeasonStats`, and `buildPlayerIndex`'s ESPN read out of `server/lib/percentileClient.js` into a new `server/providers/espn/leagueStats.js`, exposed as `getLeagueStatLines(season, mode)` (returns normalized `LeagueStatLine[]`) + a normalized player-season lookup for `getPlayerPercentiles`. `percentileClient.js` keeps ONLY the source-agnostic math (distribution building, `computePercentile`, the `distributionCache` Mongo I/O). The positional indices move verbatim into the ESPN module — they're the single most fragile, fully-undocumented coupling in the app. **Capture a `byathlete` page fixture and characterization-test the normalized `LeagueStatLine[]` before/after** so the index mapping can't drift silently. `percentileClient.js` still imports `ESPN_WEB`/`playerById` from espnClient (lines 1, 302, 412) — those move too.

Then M7 (Zod boundary validation), M8 (`STATS_PROVIDER=sportradar` leak-test + Sportradar wiring), M9 (delete now-thin `espnClient.js` — grep importers first; only `percentileClient`/`historyAggregator`/`seasonInfo`/`teamSeasonCache`/`statsParser` may still reference it).

## Traps

- **Provider must be resolved per-call, not at module load.** Consumers use `getProvider()` inside handlers/functions (or via the thin local wrappers). Capturing the provider at module-load time would defeat `STATS_PROVIDER` and the test override (`_setProviderForTest`).
- **Tests must not hit ESPN/Atlas.** `NODE_ENV=test` is set at the top of each test file *before* requiring the app; it gates the espnClient startup prefetch (`server/lib/espnClient.js`) and the Mongo connect (`server/db.js`). Keep that pattern in new test files, and listen on port `0`.
- **`teamSeasonStatsCache` is a live mutable object.** `getProvider().getTeamSeasonStatsCache()` returns the same reference espnClient mutates; stat builders read it after `fetchTeamStats` populates it. Don't copy it.
- **Season-stats payloads are still ESPN-raw** (`getPlayerSeasonStats` returns `{regData, postData}` raw JSON) because `statsParser.parseESPNSeasonData` consumes that shape. Normalizing it (so no raw JSON crosses the boundary) is a later tightening, not M4.
- **The in-memory cache accessors** (`getPlayerById/getRosterData/getPlayerIndex/getTeamSeasonStatsCache`) are an ESPN-specific migration seam, flagged in `SportsDataProvider.js` for replacement with source-neutral methods (e.g. `getActivePlayers()`). Don't bake more dependence on them.
- Branch is **`master`**, not `main`. Commits are **not pushed** (per user). Identity-tag + EXPECTED/VERIFIED-BY per `System/CLAUDE/multi-model.md`.

## Do not touch

- Nothing is mid-edit. `espnClient.js` / `pbpExtractor.js` get emptied + deleted only at M9 — leave them until then (other code, e.g. `percentileClient.js`/`historyAggregator.js`, still imports from `espnClient` and gets migrated at M5/M6).

## Recent context

- Refactor goal: route all external-source access through one `SportsDataProvider` contract so swapping ESPN → Sportradar is a `STATS_PROVIDER` env change, not an app rewrite. Driven by Prof Meneely's 2026-05-18 scaling feedback.
- **Done (M0–M5, 6 commits `a6b3652`→`ada1807`):** `node:test` harness + `lint`/`test`/`check` gate; `server/providers/` (contract base class, `types.js` typedefs + `PBP_OC_KEYS`, ESPN impl, sportradar stub, `getProvider()` factory with `_setProviderForTest`); migrated `/teams`, all clean consumers, the player metadata/stats fetches (`espn/playerStats.js`), the gamelog (M4 — `espn/gamelog.js`, client `GameLogTab.jsx` now renders from server `columns`), and the PBP/boxscore extraction (M5 — `espn/gameSummary.js`, `pbpExtractor.js` deleted, raw summary no longer crosses the boundary). `api.js` and `advancedStats.js` + `gradedReportInputs.js` no longer import `espnClient`.
- **Characterization tests in place:** `test/gamelog-normalize.test.js` (M4) and `test/pbp-extract.test.js` (M5) lock the numerically-sensitive transforms. M6 needs the same treatment.
- **Remaining:** M6 percentile byathlete indices (next, highest risk), M7 Zod, M8 sportradar leak-test, M9 cleanup. Decisions locked: JSDoc + Zod (M7); client gets server-emitted `columns` metadata (gamelog done; detailed-stats `STAT_COLUMNS` still to do).
- Each milestone ends with `npm run check` green; add characterization tests (captured-fixture snapshots) at M4/M5/M6 — that's the safety net for silent numeric regressions.
