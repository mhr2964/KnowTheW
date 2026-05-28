# HANDOFF — KnowTheW

Forward-looking handoff for the active work-stream. **Overwrite** each session; history lives in git.

```yaml
last-model: claude-sonnet-4-6
last-session: 2026-05-28
state: green
```

**All 3 planned features are DONE.** The refactor (M0–M9) + Archetype Badges + Cross-Era Similarity + On/Off-Court Impact are all shipped.

## What shipped this session

**On/Off-Court Impact (`2bb2187`)** — "On/Off" tab on every ESPN player page.

- `computeOnCourtStats` in `server/providers/espn/gameSummary.js` now tracks `pts` / `oPts` (team + opponent points while player is on court). FT points use `isFT ? 1 : sv` so they're correct even when ESPN omits `scoreValue`.
- `extractBoxscoreTeamStats` now returns `opp` (opponent boxscore stats) alongside `tm`, so opponent possessions are computed accurately for the off-court split.
- `PBP_OC_KEYS` in `server/providers/types.js` extended with `pts`/`oPts`.
- `server/lib/analysis/onOff.js` — pure module. `computeOnOff(pbpResults)` → `{on,off,delta,games}` where each split carries `{ortg,drtg,net}`. Gate: `MIN_ON_GAMES=5`.
- `server/lib/onOffClient.js` — fetch + Mongo cache wrapper. Cache collection: `playerSeasonOnOff`. Same complete-gate pattern as `advancedStats.js` (partial ESPN fetches never cached).
- `GET /api/players/:id/onoff?season=YYYY` — new route.
- `OnOffTab.jsx` + `player.css` On/Off section — season picker, 2-panel On/Off display (net rating large, ORTG/DRTG below), delta line.
- `DetailedStats.jsx` — "On/Off" tab registered in `ALL_TABLE_TYPES`; added to the `espn` source set only.
- `test/onoff.test.js` — 8 tests, all pass. `test/pbp-extract.test.js` snapshots updated for `pts`/`oPts`/`opp`.

## Next action

No more planned features from the original 3. Options going forward:
- **On/Off refinements**: career on/off view; playoffs split; per-lineup on/off (needs lineup tracking, currently not in PBP accumulator).
- **STAT_COLUMNS** for detailed-stats (currently a server-emitted columns shape for gamelog; detailed-stats still sends raw headers — a "nice-to-have" from the original M9 notes).
- **Known open items**: see `Brain/Note Pad/knowthew-archetype-eval.md` (Chelsea Gray edge cases, `latestCompletedSeason` schedule-detection heuristic, committed offline truth set).
- **Prof Meneely meeting**: previously delivered a Prof update doc + Discord post post-similarity (see `Brain/General Session Notes/2026-05-27`).

## Traps

- **Provider must be resolved per-call, not at module load.** Consumers use `getProvider()` inside handlers/functions. Capturing the provider at module-load time defeats `STATS_PROVIDER` and test overrides.
- **Tests must not hit ESPN/Atlas.** `NODE_ENV=test` at the top of each test file gates the espnClient startup prefetch and Mongo connect. Keep that pattern; listen on port `0`.
- **`pts`/`oPts` in `PBP_OC_KEYS`** — `advancedStats.js` iterates `PBP_OC_KEYS` to aggregate `totOC`; it now picks up `pts`/`oPts` too but never reads them. Harmless; the keys are in the set for the on/off client to use.
- **FT `scoreValue`** — ESPN doesn't always set `scoreValue` on FT plays. The accumulator uses `isFT ? 1 : sv` to guard this; do not revert to plain `sv`.
- **`extractBoxscoreTeamStats` now returns `opp`** — existing callers (`advancedStats.js`) only read `r.boxscore.tm`, so this is backward-compatible.
- **Season-stats payloads are still ESPN-raw** (`getPlayerSeasonStats` returns `{regData, postData}` raw JSON). Normalizing is a later tightening.
- Branch is **`master`**, not `main`. Commits are **not pushed** (per user). Identity-tag + EXPECTED/VERIFIED-BY per `System/CLAUDE/multi-model.md`.

## Do not touch

- Nothing mid-edit. All features shipped; next session starts fresh.

## Recent context

- Refactor goal: route all external-source access through one `SportsDataProvider` contract (M0–M9 complete).
- Three features complete: Archetype Badges (5-iteration eval loop), Cross-Era Similarity (4-iteration eval loop), On/Off-Court Impact (this session).
- Untracked leftover: `scripts/_eval-similar.js` — safe to delete or stage.
