# HANDOFF — KnowTheW

Forward-looking handoff for the active work-stream. **Overwrite** each session; history lives in git.

```yaml
last-model: claude-sonnet-4-6
last-session: 2026-07-17
state: green
```

**Branch: `feature/archetype-accuracy`** (off `master` at `60a028d`), not pushed. `master` itself is 9 commits ahead of `origin/master` and also not pushed.

## What shipped this session

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

- **Decide what to do with `feature/archetype-accuracy`** — merge to `master`, or keep accumulating archetype fixes on it. Nothing blocks a merge; all three commits are green and the eval note's open items are closed.
- **Win Shares** should move from `advancedStats.js` (analysis layer) into the ESPN provider, per the same nullable-contract principle used for On/Off — noted as "Task 2" in 05-28's session, still not done.
- **STAT_COLUMNS** for detailed-stats — gamelog has a server-emitted columns shape; detailed-stats still sends raw headers.
- **`latestCompletedSeason` schedule-detection heuristic** — currently date-based, should eventually be schedule-based (D1 in the eval note).
- **Commit the known-player truth set** as an offline test once it can run without live ESPN (eval note, D1/closing line).

## Traps

- **Provider must be resolved per-call, not at module load.** Consumers use `getProvider()` inside handlers/functions.
- **Tests must not hit ESPN/Atlas.** `NODE_ENV=test` gates the espnClient prefetch and Mongo connect in every test file.
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
