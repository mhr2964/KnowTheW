# Archetype fingerprinting

## Two pools, two different jobs

`getPlayerFingerprint(id, {pool})` supports two pools that must not be conflated:
- **`'position'`-pooled** — the only correct input for archetype **assignment** (which badge a player gets).
- **`'all'`-pooled** (league-wide) — cached in the `playerFingerprints` Mongo collection, used for **Cross-Era Similarity** only.

Reaching for the `'all'`-pool cache when assigning an archetype (or vice versa) produces silently-wrong badges — this was the trap that made a throwaway live-fingerprint sweep script necessary during tuning, rather than just reading the cache directly.

## Recency-weighted career vector

`aggregateFingerprint` (`playerFingerprint.js`) combines a player's seasons into one career vector via a minutes-weighted mean with exponential recency decay layered on top (`RECENCY_HALF_LIFE_YEARS = 6`) — without it, a player whose role genuinely shifted over their career (e.g. an early scoring forward who became an elite point-forward) reads as an averaged, diluted shape instead of their real current identity.

**The decay is anchored to each player's own last qualifying season — not `latestCompletedSeason()` or today's calendar date.** A retired player's badge stops drifting once they stop playing, which is the point. If a future need arises for "how recent relative to the calendar" (a genuinely different concept), don't repurpose this anchor for it.

The half-life (6 years) was tuned against a full ~459-player live sweep: 4 years flipped 42 archetype labels (mostly noise from over-discounting long, role-stable careers); 8 years only bought 2 fewer flips than 6. Six is the smallest change that still fixed the motivating case.

## Versioning

`AXES_VERSION` gates the axis-building formula. Bump it whenever that formula changes, and when you do:
1. Re-seed the `playerFingerprints` Mongo cache (`scripts/seed-fingerprints.js`).
2. Re-capture `test/archetype-truth-set.test.js`'s fixture live (`GET /players/:id/archetype` already returns ready-made `dimensions`, no need to re-derive from `advanced` stats).
3. Re-sweep the full player index for M3-style contradictions (a player's descriptor text disagreeing with their assigned archetype) and confirm the Role Player cliff still holds (max dimension score should stay below the ~64-65 threshold that would otherwise misclassify a role player as a specialist).

Currently `AXES_VERSION = 3`. The known-player truth set (`test/archetype-truth-set.test.js`) is 22 exact-match cases plus 2 negative regression guards, captured from real live data — it's the pre-ship gate for any archetype-formula change, and it self-skips with an explicit re-capture message if `AXES_VERSION` doesn't match what it was captured against, rather than silently validating stale expectations.
