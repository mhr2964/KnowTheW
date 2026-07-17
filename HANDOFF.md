# HANDOFF — KnowTheW

Forward-looking handoff for the active work-stream. **Overwrite** each session; history lives in git.

```yaml
last-model: claude-sonnet-4-6
last-session: 2026-07-17
state: green
```

**Branch: `master`.** `feature/archetype-accuracy` merged (fast-forward) and deleted this session. `master` is 14 commits ahead of `origin/master`, not pushed.

## What shipped this session

**STAT_COLUMNS for detailed-stats (closed).** `server/lib/statColumns.js` (new) mirrors the gamelog `columnFor` precedent but with a 3-way `kind` (`num`/`pct`/`pct100`, vs gamelog's 2-way) since detailed-stats has real fraction-vs-whole-percent columns gamelog doesn't. `statsParser.js`'s `buildDetailedStats()` and the `/detailed-stats` + `/advanced-pbp-all` routes now emit `{columns, rows}` instead of `{headers, rows}`; internal (non-HTTP) row-indexing in `advancedStats.js`/`gradedReportInputs.js` was decoupled to reference `ESPN_DETAILED_HEADERS` directly instead of reading `.headers` off a passed-in table, so it no longer cares which shape that table's own HTTP response uses. Scope grew beyond the original plan in two directions, both discovered by reading the actual call sites rather than assuming the plan was complete: (1) the bulk-legacy pre-2002 player path (`server/constants/legacyPlayerBulk.js`) uses the identical `ESPN_DETAILED_HEADERS` key set for its own `{headers, rows}` table and needed the same `toColumnTable` treatment or legacy players would've broken; (2) `AdvancedTab.jsx`/`/advanced-pbp-all` got migrated too (not just `/detailed-stats`), because the alternative — keeping the client's `LABELS`/`PCT_COLS`/`PCT100_COLS` maps around solely as a fallback for AdvancedTab — was exactly the "back-compat shim" this project avoids; migrating it let those maps be deleted... except they couldn't be, see next point. `client/src/lib/statsColumns.js` was investigated but left **completely untouched**: its `LABELS`/`PCT_COLS`/`deriveColumns()` are still load-bearing for `useRecentDecks.js`'s migration of pre-existing localStorage-persisted StudyFlow decks (independent of the server response shape entirely) — deleting them would have broken that. `BrefTable.jsx` now branches on `columns` (primary) vs a `headers` fallback (only remaining caller: `PlayByPlayTab.jsx`, a genuinely separate header set/route not in scope). Bumped the `/advanced-pbp-all` Mongo cache version 25→26 to invalidate old-shaped cached documents. Verified via `npm test` (138/138, 9 new), lint clean, live before/after diff (all row values byte-identical, zero `headers` fields remaining), and a full Playwright pass over Totals/Advanced/Study-flow/Compare/Play-by-Play — no console errors, all formatting (`.403` fraction-style, `21.6` whole-percent-style) unchanged.

**Win Shares provider extraction (Task 2 from 05-28, closed).** Re-audited the HANDOFF's old framing first — it was stale: the data-fetch routing it complained about (`getTeamStats`, `getTeamPointsAllowed`, `getGamePbpStats` through `getProvider()`) was already done on 05-26, before the 05-28 note was even written. The actual remaining leak was narrower: `computeSeasonPBPUncached` in `advancedStats.js` was looping raw per-game `getGamePbpStats()` results and manually summing them (`totOC`/`totTm`) to reconstruct team on-court stats and WS team-averages — ESPN's specific workaround for having no season-level on-court endpoint, sitting in what's supposed to be the data-neutral analysis layer. Extracted that reconstruction into a new provider contract method, `getSeasonPBPSummary(playerId, season, seasontype)` (`SportsDataProvider.js`, documented in `types.js` as `SeasonPBPSummary`), implemented in `providers/espn/index.js`; `advancedStats.js` now just calls it and gets back `{tmOC, tmForWS, pbpGames, complete}`. Sportradar's stub inherits the throwing default, so it's covered by the existing M8 leak test (added `getSeasonPBPSummary` to `CONTRACT_METHODS` in `test/providers.test.js`). `computeWinShares` itself (`statFormulas.js`) was already pure formula code — nothing to move there. Pure move, no logic changes: verified by diffing `/players/:id/advanced-pbp-all` output before/after for a historical player (Sue Bird, id 91) and a current-season player (Chelsea Gray, id 2529122) against the live dev server — byte-identical both times.

Three archetype-tuning fixes, each validated against all 345 real cached position-pooled fingerprints (throwaway eval script, not committed) before landing:

- **`1099ca4`** — Three-Level Scorer prototype now requires `threeVolume:H`, not just accuracy/finishing. Fixes the Chelsea Gray misclassification flagged in `Brain/Note Pad/knowthew-archetype-eval.md` (M2): a guard could match on finishing+accuracy+rimPressure alone without shooting 3s at any real volume.
- **`779949c`** — `DOMINANT_GAP` 15→12 in the Specialist-vs-Versatile fallback. Only 2 players flipped (Sue Bird → Playmaker, Alexis Hornbuckle → Rebounding Specialist), both correct calls, rest of the distribution unchanged.
- **`44cb40f`** — Combo Guard's consistency check broadened to credit {scoring, shooting} as primary (shooting is one of the prototype's own defining axes), but only bypasses the gap tolerance when the player's actual top dimension IS scoring/shooting; tightened gap to 15 (from the global 25) for this prototype specifically. Fixes the M2 "primary=scoring is shaky" finding: Rhyne Howard (defense-dominant, gap 20) now correctly falls out, Toliver/Latta (shooting-led) now correctly match. Caught and fixed a regression in an earlier draft that would've let Sue Bird (playmaking-dominant) slip back into Combo Guard.

Re-swept all 345 players (full historical index) at the end of the session — zero M3-style contradictions, Role Player (63) re-confirmed clean (nobody under-sold near the 65 cliff). Full writeup in `Brain/Note Pad/knowthew-archetype-eval.md` under "Iter 6". The eval note's three "still open" items from 05-27 are now all closed; remaining open items are D3 (career vs peak/recent weighting), the `latestCompletedSeason` date heuristic, and committing the known-player truth set as an offline test.

Also cleaned up two untracked stragglers that had been sitting in the repo root: `scripts/_eval-similar.js` (spent eval harness, findings already captured in the Note Pad) and a stray `UsersOwnerAppDataLocalTempgl.json` (a network-capture dump that landed in the repo root by accident).

## Note: this HANDOFF was stale coming into this session

The version this replaces (`683873d`, dated 2026-05-28) described On/Off-Court Impact shipping as a standalone tab — but *later commits that same day* (`3a9e31b` → `60a028d`) folded On/Off into a full BBRef-style Play-by-Play tab and retired the standalone tab. If you're looking for On/Off-Court Impact, it's a section inside the **Play-by-Play tab**, not its own tab. See `Brain/General Session Notes/2026-05-28 - KnowTheW PBP Tab Build + Provider Contract Architecture.md` for the real state of that work.

## Next action

No planned feature is in flight. Options, in rough priority order:

- **`latestCompletedSeason` schedule-detection heuristic** — currently date-based, should eventually be schedule-based (D1 in the eval note).
- **Commit the known-player truth set** as an offline test once it can run without live ESPN (eval note, D1/closing line).

## Traps

- **Provider must be resolved per-call, not at module load.** Consumers use `getProvider()` inside handlers/functions.
- **Tests must not hit ESPN/Atlas.** `NODE_ENV=test` gates the espnClient prefetch and Mongo connect in every test file.
- **`getSeasonPBPSummary` is the only place per-game PBP reconstruction should happen.** If a future WS/on-court-stat tweak needs raw per-game data again, it belongs inside the provider implementation, not back in `advancedStats.js` — that boundary was deliberately drawn this session.
- **Archetype fingerprints for assignment must be position-pooled** (`getPlayerFingerprint(id, {pool:'position'})`), NOT the league-wide `'all'`-pool fingerprint cached in `playerFingerprints` (that one's for Cross-Era Similarity, `AXES_VERSION` 2). Conflating the two pools was the trap that made `scripts/_eval-archetypes-tmp.js` necessary as a separate live-fingerprint sweep rather than reading the cache directly.
- **`pts`/`oPts` in `PBP_OC_KEYS`** — `advancedStats.js` iterates `PBP_OC_KEYS` to aggregate `totOC`; it now picks up `pts`/`oPts` too but never reads them. Harmless.
- **FT `scoreValue`** — ESPN doesn't always set `scoreValue` on FT plays. The PBP accumulator uses `isFT ? 1 : sv`; do not revert to plain `sv`.
- Identity-tag + EXPECTED/VERIFIED-BY per `System/CLAUDE/multi-model.md` on every commit.

## Do not touch

- Nothing mid-edit as of this handoff.

## Recent context

- Refactor goal (M0–M9, `refactor-pass` branch): route all external-source access through one `SportsDataProvider` contract — complete.
- Four features complete: Archetype Badges, Cross-Era Similarity, On/Off-Court Impact (now folded into Play-by-Play), and the BBRef-style Play-by-Play table itself.
- This session's two archetype fixes are the first archetype-model work since the 2026-05-27 eval pass; the "Still open" items in the Note Pad eval are the natural next targets if archetype work continues.
