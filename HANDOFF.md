# HANDOFF — KnowTheW (data-source swappability refactor)

Forward-looking handoff for the active work-stream. **Overwrite** each session; history lives in git.

```yaml
last-model: claude-opus-4.7
last-session: 2026-05-26
state: green
```

Full plan: `C:/Users/Owner/.claude/plans/groovy-meandering-parasol.md` (refactor M0–M9 + 3 selected features). This work-stream is the refactor; features come after.

## Next action

Start **M4 — normalize the gamelog boundary** (HIGH RISK, touches the client): add `getPlayerGameLog(playerId, season)` to the ESPN provider that owns the decode currently split across `api.js` (the `/players/:id/gamelog` route, ~line 508, uses `ESPN_WEB`) and `client/src/components/GameLogTab.jsx` (which decodes raw `g.stats` arrays positionally against `log.names`). Return `{ columns:[{key,label,kind}], games:[{date,opponent,atVs,result,teamScore,oppScore,stats:{<key>:value}}] }`; update `GameLogTab.jsx` to render from `g.stats[col.key]`. **Before changing anything, capture a real ESPN gamelog JSON fixture and snapshot the current normalized output** so the new provider method can be asserted byte-for-byte equal (exact array order + the `/100` percent scaling are the trap).

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
- **Done this session (M0–M3, 4 commits `a6b3652`→`c43efc9`):** stood up a `node:test` harness + `lint`/`test`/`check` scripts (the gate); created `server/providers/` (contract base class, `types.js` JSDoc typedefs, ESPN impl wrapping `espnClient`, sportradar stub, `getProvider()` factory); migrated `/teams`, then all clean consumers (`api.js`, `advancedStats.js`, `gradedReportInputs.js`), then the simple player-metadata/stats rogue fetches into `server/providers/espn/playerStats.js`.
- **Remaining:** M4 gamelog (next), M5 PBP/`pbpExtractor.js` + `advancedStats.js` gamelog fetch, M6 `percentileClient.js` hardcoded byathlete indices (highest risk), M7 Zod boundary validation, M8 `STATS_PROVIDER=sportradar` leak-test + Sportradar stub wiring, M9 cleanup/delete. Decisions locked: JSDoc + Zod (M7); client gets server-emitted `columns` metadata (during M4 gamelog + the detailed-stats columns work).
- Each milestone ends with `npm run check` green; add characterization tests (captured-fixture snapshots) at M4/M5/M6 — that's the safety net for silent numeric regressions.
