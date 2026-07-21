# Provider architecture

## The contract

All external stats access goes through one `SportsDataProvider` contract (`server/providers/`), documented in `server/providers/types.js`. `providers/espn/` is the only implementation today; a Sportradar (or similar) implementation could be dropped in without touching consumers, provided it implements every method in `CONTRACT_METHODS` (`test/providers.test.js` fails the build if a method is missing — this is the enforcement mechanism, not a convention someone has to remember).

**Consumers resolve the provider per-call, inside handlers/functions — never at module load.** A module-level `const provider = getProvider()` would freeze whichever provider was active at process start; per-call resolution is what makes swapping providers (or mocking them in tests) actually work.

## Why ESPN, and the real risk

All live stats come from ESPN's *undocumented* JSON endpoints (`server/providers/espn/`) — no API key, no ToS acceptance flow. Facts aren't copyrightable (*Feist v. Rural Telephone*) and commercial use of real player names/stats is protected (*C.B.C. Distribution v. MLB Advanced Media*, the fantasy-sports precedent) — but hitting ESPN's private endpoint specifically is a ToS/ban risk, not a copyright one. Current stance: stay on ESPN (budget constraint), mitigate with attribution + honest framing on `/data-sources`, revisit BallDontLie's paid ALL-STAR tier ($9.99/mo, WNBA coverage, previously integrated in this codebase once) once there's revenue.

## `getSeasonPBPSummary` boundary

`getSeasonPBPSummary(playerId, season, seasontype)` (defined in the provider contract, implemented in `providers/espn/index.js`) is the **only** place raw per-game play-by-play data should be looped and summed to reconstruct team on-court stats / Win Shares team-averages — this is ESPN's specific workaround for having no season-level on-court endpoint. If a future Win-Shares or on-court-stat tweak needs raw per-game data again, it belongs inside the provider implementation, not back in `advancedStats.js` (the data-neutral analysis layer) — that boundary was deliberately drawn to keep provider-specific reconstruction logic out of code that's supposed to work with any provider.

## Caching discipline

Every ESPN-backed read should be cached — either `withCache` (permanent, past-season data) or `withTtlCache` (a bounded TTL, current-season data that can still change) from `server/providers/espn/client.js`. `getPlayerSeasonStats`, `getPlayerGameLog`, and `getGameLogEvents` all follow this pattern; if you add a new ESPN-backed read, give it the same treatment rather than fetching fresh on every request — this codebase has hit real production incidents (a Mongo free-tier quota outage, see `pbp-cache-refactor.md`) from uncached/over-cached reads.

**Tests must never hit ESPN or Atlas.** `NODE_ENV=test` gates the espnClient prefetch and the Mongo connection in every test file — don't remove that gate to "just try something quickly."

## Two calendar/season helpers that look interchangeable but aren't

`seasonWindow.js` exports two different functions for two different jobs — using one where the other belongs is an easy, wrong-looking-right mistake:
- `isPastSeason(season, now)` — a plain calendar-year check, answers "is it safe to cache this in Mongo forever."
- `latestCompletedSeason()` — a conservative Nov-1-cutoff jitter-safety cap, answers "should this season count toward a percentile distribution / fingerprint yet."

## Minor known-harmless quirks

- `advancedStats.js` iterates `PBP_OC_KEYS` to aggregate `totOC`, which picks up `pts`/`oPts` too — never read, harmless.
- ESPN doesn't always set `scoreValue` on free-throw plays. The PBP accumulator uses `isFT ? 1 : sv`, not plain `sv` — don't revert that.
