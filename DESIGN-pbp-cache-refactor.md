# DESIGN — PBP cache refactor (production deploy outage)

## Problem (one sentence)
The `gameSummaries` Mongo collection (~370 KB/doc × 1394 docs = 515 MB) has saturated the 512 MB free-tier quota; every release fails because the `release:` phase tries to `bulkWrite` into a full database. We need to cache computed per-season advanced stats instead of raw ESPN summaries, and stop letting cache warming take the deploy down with it.

---

## Recommendations per question

### Q1 — Cache shape for computed results
- **Collection name:** `playerSeasonPbp`. Matches the `teamSeasonStats` / `teamSeasonInfo` family naming (`<noun><Season><Subject>`). Plural per the established convention.
- **Key:** string `_id` of the form `"${playerId}-${season}-${seasontype}"`. Mirrors `teamSeasonCache.js` line 55 ("include seasontype in the key … to prevent collision between regular and playoff"). All three parts are stringified.
- **Payload:** exactly `{ row, pbpGames }` — the same envelope `computeSeasonPBP` already returns. Do **not** persist `ADV_HEADERS_SRV`; it is a module-level constant in `advancedStats.js` and would just bloat documents and create a versioning problem if the header list ever changes.
- **TTL:** none for past seasons (they are immutable, same posture as `teamSeasonStats`). For the current season, **bypass the Mongo cache entirely** — same split `espnClient.js` already makes between in-process current-season caches and the Mongo past-season caches (see comment block at the top of `teamSeasonCache.js`). The check is "is `season` strictly less than the current calendar year?" computed once at the call site in `advancedStats.js` before consulting the cache. No TTL means no invalidation logic, which is the whole point of the existing pattern.

### Q2 — What happens to `gameSummaries`
**Option (a) — delete entirely.** Recommended.

Rationale:
- With `playerSeasonPbp` keyed on `(playerId, season, seasontype)`, the cross-player sharing argument only matters on the *first* compute for each (player, season). After the computed-result cache fills, no one re-fetches anything; cache-hit cost is one `findOne`.
- Option (b) capped collection: still uses 50–100 MB of quota for a value (cross-player game sharing) that is dominated by the new computed cache. Doesn't shrink the smaller (computed) cache, just delays hitting the same wall later.
- Option (c) strip-and-keep: real engineering work to identify which fields `computeOnCourtStats` + `extractBoxscoreTeamStats` actually read; risk of breaking PBP extraction silently if ESPN payload shape shifts; still spends quota on transient first-compute data.
- The user explicitly said "execute autonomously, minimize interruptions, prefer action over planning." Option (a) is the smallest change that unblocks the deploy. Cost of a one-time per-(player,season) cold ESPN burst is acceptable — these are ad-hoc user navigations, not batch jobs, and `Promise.all(eventIds.map(fetchGameSummary))` already parallelizes the ~30 calls.

### Q3 — Seed-script tolerance
Two changes, both needed regardless of cache strategy:

1. **Keep seed in `release:`** but make `buildPlayerIndex()` a no-op-on-failure. Wrap the `bulkWrite` in `try/catch`, log a warning, return. This is the actual point of failure described in the brief. Same posture as the fire-and-forget writes in `teamSeasonCache.js`: cache warming is best-effort; deploys are critical-path.
2. **`warmDistributionCache()` already tolerates failure** (`.catch(() => null)` on line 447). Leave it.

Rejected alternatives:
- Removing from `release:` → first user request after a deploy pays full distribution-build cost (multi-minute, all seasons).
- Background-warm on app startup → dyno restarts on Heroku free tier are frequent; thrash is real; also doesn't help because the underlying problem is "Mongo writes fail when quota is full," which is true at startup too.

The hardening is the right shape: cache-warming code that **observes** Mongo write failure and gracefully continues, exactly like `teamSeasonCache.js` line 47 already does for everything else.

### Q4 — Migration / cleanup
**One-off committed script, run via `heroku run` after deploy.** Rationale:
- Manual `heroku run node -e` is fine for one host but the operation needs to be reproducible (multiple dynos, possible rollback-then-redo) and reviewable in git.
- Inline-in-startup is rejected for the reason in the brief — thrashes on every dyno restart and races multiple dynos.
- Script lives at `scripts/drop-legacy-game-summaries.js`. Idempotent: check if collection exists first via `db.listCollections({ name: 'gameSummaries' }).toArray()`, drop if present, log doc count freed.

Run order is in the migration sequence below.

### Q5 — `fetchGameSummary`
With Option (a) for Q2, **strip the cache layer entirely**. The function becomes a thin ESPN wrapper:
- Remove the `getDb()` read at the top.
- Remove the `replaceOne` write after a successful fetch.
- Keep the `try/catch → return null` posture.
- The caller (`advancedStats.js:191`) signature is unchanged.

The new `playerSeasonPbp` cache wraps `computeSeasonPBP`, which sits *above* `fetchGameSummary` in the call stack — so removing the lower cache is safe once the upper one exists.

---

## Cache-hit / cache-miss flow (new system)

**Path: `/api/players/:id/advanced-pbp-all`**

Existing outer cache (`advancedStats` collection, keyed on playerId+gp+version) is **unchanged**. New `playerSeasonPbp` cache sits one layer below, inside `computeSeasonPBP`.

Per (player, season, seasontype) within that route:

1. Determine `isPastSeason = Number(season) < currentYear` at the call site in `advancedStats.js`.
2. If past season: `readOrFetch('playerSeasonPbp', '${playerId}-${season}-${seasontype}', () => computeSeasonPBPInner(...))`.
3. If current season: call `computeSeasonPBPInner(...)` directly. No Mongo touch.

`computeSeasonPBPInner` is the existing body of `computeSeasonPBP` (the function is renamed/restructured — the outer `computeSeasonPBP` becomes a 5-line wrapper that handles the cache decision).

**Hit:** one `findOne` against `playerSeasonPbp`, returns `{ row, pbpGames }`. No ESPN traffic.

**Miss:** runs the existing implementation — gamelog fetch, ~30 `fetchGameSummary` calls (now pure ESPN, no cache), aggregation, team stats fetch, `advancedRow` + `computeWinShares`. Result is fire-and-forget written to Mongo on success.

**Write gate** (matching `teamSeasonCache.js:82`): only write if result is non-null. `computeSeasonPBP` already returns `null` on no-gamelog / no-PBP-games — those nulls must not be cached (they may be transient ESPN errors). This matches the existing convention; the new code uses `readOrFetch` so the gate is enforced for free, but the inner function must continue to return `null` for "cannot compute," not for "computed-empty."

---

## File changes

### New files
1. **`server/lib/playerSeasonPbpCache.js`** — thin module exporting `readOrFetchSeasonPbp(playerId, season, seasontype, fetchFn)`. Implementation: directly delegates to `readOrFetch` from `teamSeasonCache.js` with collection name `'playerSeasonPbp'` and the assembled string key. Existence rationale: keeps key-shape knowledge co-located with the caller domain and avoids `advancedStats.js` taking a dependency on a module named after team data. (If the author prefers no new file, calling `readOrFetch` from `teamSeasonCache.js` directly inside `advancedStats.js` is acceptable — purely organizational.)
2. **`scripts/drop-legacy-game-summaries.js`** — one-off cleanup script. Connects via `whenConnected`, checks for collection, drops, logs result, exits.

### Modified files
1. **`server/lib/advancedStats.js`**
   - Rename existing `computeSeasonPBP` body to `computeSeasonPBPUncached` (or move into an inner function defined inside the new exported `computeSeasonPBP`).
   - New exported `computeSeasonPBP(playerId, season, playerRow, I, teamId, totRow, seasontype)`:
     - Compute `isPastSeason`.
     - If past: `readOrFetch('playerSeasonPbp', '${playerId}-${season}-${seasontype}', () => computeSeasonPBPUncached(...))`.
     - Else: call `computeSeasonPBPUncached(...)` directly.
   - Add `require` for `readOrFetch` (or for the new helper).
2. **`server/lib/espnClient.js`**
   - `fetchGameSummary`: remove the `getDb()` block (read), remove the `replaceOne` (write). Function shrinks to ~6 lines: fetch, check `res.ok`, parse, return; on throw return `null`.
   - Remove the `const { getDb } = require('../db');` import if it is no longer used elsewhere in the file (it currently is not — verify).
3. **`server/lib/percentileClient.js`**
   - Wrap the body of `buildPlayerIndex` (lines 451–484) in `try/catch`. On catch: `console.warn('[seed] buildPlayerIndex failed:', err.message); return;`. The bulkWrite on line 483 is the failure point — wrap at least lines 459–483 so the upstream ESPN fetch failures and the Mongo write failure both fall into the same warn-and-continue path.
4. **`scripts/seed-distributions.js`**
   - Wrap each step (`warmDistributionCache`, `buildPlayerIndex`) in its own `try/catch` so one failure doesn't skip the next. Log and continue. `process.exit(0)` regardless. Even though step 3 above hardens `buildPlayerIndex` internally, this script is the release-pipeline contract — defense in depth here means a never-anticipated future addition to the script also won't break deploys.

### Deleted assets
- Collection `gameSummaries` in production Mongo. Dropped by the new script.
- No source files are deleted.

---

## Migration sequence

1. **Ship code changes** (the file modifications above) in a single commit. Push to Heroku.
   - On release, the seed runs. With the bulkWrite hardened, the seed completes (or warns) regardless of Mongo state. Release succeeds — production gets back to a current build immediately.
2. **Drop the legacy collection.** `heroku run node scripts/drop-legacy-game-summaries.js`. This frees ~500 MB and gives the new cache headroom to populate. Verify via `db.stats()` (or `heroku run node -e "..."`) that storage size has dropped below the quota ceiling.
3. **Verify a hot path.** Hit one player's advanced stats page. First request: cold compute, populates `playerSeasonPbp`. Second request (same player): served from `advancedStats` outer cache (unchanged behavior). Third: visit a different player from the same season — verify their `playerSeasonPbp` rows populate independently.
4. **Monitor `playerSeasonPbp` growth.** Each doc is ~200 bytes serialized (one row + a count). 200 active players × ~10 seasons × 2 seasontypes ≈ 4000 docs ≈ 800 KB. Two orders of magnitude under quota.

Rollback: if step 1 misbehaves, the cache-write side is fire-and-forget so reads always fall through to live computation. The `advancedStats` outer cache still works. To fully revert: revert the commit; deploy will still succeed because the `gameSummaries` collection was dropped in step 2 (no quota pressure even though the cache layer is back).

---

## Risks + mitigations

**R1 — Partial computation gets cached.**
`computeSeasonPBPUncached` returns `{ row, pbpGames }` whenever `pbpGames > 0`. If, say, 28 of 30 game summaries return null (ESPN flaking on two events), `pbpGames === 28` and the row is computed off incomplete data. That partial row is now cached forever.
- *Mitigation:* gate the cache write on `pbpGames === eventIds.length` (rename `eventIds` is unnecessary; just compare). Treat any short return as a transient failure — return the row to the caller for this request (preserves current behavior) but skip the cache write. Implementation: have `computeSeasonPBPUncached` return `{ row, pbpGames, complete: pbpGames === eventIds.length }`, and have the cache wrapper read the `complete` flag (use the `{ empty: true, confirmedEmpty: true }` envelope convention from `teamSeasonCache.js` if helpful, or just inline the check in the outer `computeSeasonPBP`).
- Lives in: `server/lib/advancedStats.js`, around the current `if (!pbpGames) return null;` line and the new cache wrapper.

**R2 — Mongo over-quota still blocks the seed even after dropping `gameSummaries`.**
If the drop hasn't happened yet (step 2 of migration), step 1's release still fails the bulkWrite — but now silently because step 3 hardens it. Seed exits clean, release succeeds, app boots. Cache writes for other features still fail at the storage level until step 2 runs. **This is acceptable for the gap window** — the existing fire-and-forget pattern across `teamSeasonCache.js`, `espnClient.js` already handles write failures gracefully, so the app is functional just non-caching.

**R3 — `playerSeasonPbp` collection doesn't exist yet on first write.**
Mongo creates collections lazily on first insert. No DDL needed. Confirmed by every other cache collection in the codebase being created the same way.

**R4 — `fetchGameSummary` callers other than `advancedStats.js`.**
- *Mitigation:* grep before shipping. Grep result earlier in this session showed only `advancedStats.js:191` and the module exports — no other consumers. Safe to strip caching.

**R5 — Stale cache after ESPN data correction.**
Same posture as every other immutable cache in this codebase: documented manual `deleteMany` invalidation. No code change.

**R6 — Migration script gets run twice / on wrong DB.**
- *Mitigation:* the script's `listCollections` check makes it idempotent. Second run finds nothing and exits clean. The script reads `MONGODB_URI` from env (same as `whenConnected`), so it targets whatever DB the dyno is configured for — `heroku run` picks up Heroku's config vars automatically.

---

## Handoff

=== HANDOFF ===
did: designed playerSeasonPbp cache replacing gameSummaries, plus seed/release hardening
found: gameSummaries at 515MB/512MB free tier blocks all Mongo writes including buildPlayerIndex bulkWrite in release phase; computeSeasonPBP returns ~200B {row, pbpGames} envelopes that are the right thing to cache; existing teamSeasonCache.js pattern is the template (string _id, fire-and-forget writes, getDb()-null bypass); advancedStats outer cache stays intact, new cache sits one layer below; fetchGameSummary has zero callers outside advancedStats.js so its cache layer can be removed cleanly
files-touched: C:\Users\Owner\Desktop\AI\Projects\knowthew\DESIGN-pbp-cache-refactor.md
next-suggested-agent: backend-dev (small focused refactor — 4 file mods + 2 new files + 1 production migration)
blockers: none — design is unambiguous; production migration step requires heroku run access (user has it)
=== END HANDOFF ===
