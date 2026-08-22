# HANDOFF — KnowTheW

Forward-looking handoff for the active work-stream. **Overwrite** each session; history lives in git. Durable architecture/design rules live in `docs/design/` (see `docs/design/design.md`), not here — this file is transient work-stream state only.

```yaml
last-model: claude-sonnet-5
last-session: 2026-08-22 — BDL expansion roadmap (docs/design/bdl-expansion-roadmap.md), executing autonomously feature-by-feature with a >>ping compact between each. Feature 1 (site nav rework, Teams/Standings pages) shipped as 7a13739, deploy verified live. Feature 2 (Off/Def/Net Rating + PIE on Advanced tab) shipped as 0d247e1. Feature 3 (Clutch splits, new tab) shipped as 655b17f -- also fixed a real client-side routing bug (PlayerRoutePage.jsx's VALID_TABS allowlist didn't know about the new tab, so it redirected right back to the bare URL) -- see roadmap doc's "## 3." section for the full story. Feature 4 (Scoring Distribution tab) shipped as aba847b -- applied the Feature 3 lesson (all three tab-wiring points updated together), and found that measure_type=scoring shares the 2022 tracking-data floor with Off/Def/Net Rating, not the wider 2008 BDL floor Clutch uses -- see roadmap doc's "## 4." section. Feature 5 (Usage Share tab) shipped as 7b91627 -- measure_type=usage shares that same 2022 floor (checked live before coding, per Feature 4's own lesson); new TM_-prefixed columns to avoid colliding with the Advanced tab's existing (differently-computed) AST_PCT/REB_PCT/USG_PCT -- see roadmap doc's "## 5." section. Feature 6 (Defense tab) shipped as 4e95747 -- cross-checked BDL's def_ws against the homegrown DWS (computeWinShares) per this feature's own flagged caution: Defensive Rating matches almost exactly (98.8 both) but Defensive Win Shares diverge materially (BDL 6.01 vs homegrown 1.71, A'ja Wilson 2025 season total) -- shipped BDL's as a distinctly-named BDL_DEF_WS column rather than silently replacing anything; **which DWS number is more correct for this league is an open product question for the user**, not resolved by this run -- see roadmap doc's "## 6." section. Feature 7 (Team Four Factors) shipped as 8d4e297 -- two new sections on TeamStatsPage.jsx (team's own eFG%/TOV%/OREB%/FT Rate, and the same for opponents), fetched independently via a new /teams/:id/four-factors route so a pre-2022 season just omits the sections rather than erroring -- see roadmap doc's "## 7." section. Feature 8 (Team shot chart) shipped as 521de41 -- built BOTH framings the roadmap flagged as an open question (team's own shot zones AND opponent zone FG% while facing this team, the more novel defensive-tendency angle), toggled client-side off one fetch; extracted the player Shot Chart's SVG court into CourtDiagram.jsx so both levels share the same rendering -- see roadmap doc's "## 8." section. Feature 9 (League shot-zone leaderboards) shipped as 0339d5e -- new /leaders page, reused leagueShotZones.js's existing bulk per-player pull instead of a new fetch path; found and fixed a real identity gap (the bulk endpoint has no ESPN id, only a BDL id + plain name) by adding a reverse name-based resolver to idMap.js -- see roadmap doc's "## 9." section.
state: green. Actively building through the BDL expansion roadmap -- see that doc's own Status table for exactly which feature is in progress. One open non-blocking flag: Feature 6's Defensive-Win-Shares discrepancy (BDL vs homegrown formula) needs a user decision on which number to treat as authoritative -- both are currently shown, unreconciled, on their own tabs (Defense tab's "BDL Def WS" vs Advanced tab's "DWS").
```

## Next action

**Check `docs/design/bdl-expansion-roadmap.md`'s Status table first** — that doc, not this file, is the live source of truth for which of its 12 features is done/in-progress/next during this autonomous run. If every row says shipped, there's nothing queued and a future ask is a new work-stream, not a continuation.

## Traps

- **BDL id-resolution failures silently drop PBP/Advanced data** for that player's BDL-era seasons — no ESPN fallback, unlike other methods. See `docs/design/provider-architecture.md` and commit `7224c98`.
- **`writeCache()`'s 400MB storage guard is load-bearing for every cache collection app-wide** (`9b4efa4`) — a real incident (Mongo free-tier quota filled mid-backfill) drove this. Do not remove or raise casually.
- **Percentile coverage is perGame/totals/per36/adjShooting only** (`percentileClient.js`'s `PERCENTILE_STATS`) — Per 100 Poss has no league-wide team-pace fetch yet, so its toggle stays intentionally hidden rather than shown-and-broken.
- **`advancedStats.js`'s season-level row shape is cached in TWO independent places** -- the whole-
  career `advancedStats` Mongo collection (version-gated by its own `v` field) AND
  `computeSeasonPBP`'s per-season `playerSeasonPbp` collection (no version field, invalidated by
  bumping the cache KEY itself instead). Changing the row shape again needs both bumped, or a stale
  per-season row silently survives an outer cache-version bump (confirmed live, 2026-08-21, commit
  `0d247e1`).
- **Adding a new player stat-type tab touches THREE places, not two**: `DetailedStats.jsx`'s
  `ALL_TABLE_TYPES`/`SOURCE_ACTIVE`/render branch (obvious), AND `PlayerRoutePage.jsx`'s own
  `VALID_TABS` allowlist for URL-tab sync (easy to miss -- it's a separate file, no shared
  constant). Missing the third makes the tab clickable but self-reverting: the route-sync guard
  redirects back to the bare player URL the instant the tab's URL param lands (confirmed live,
  2026-08-22, commit `655b17f` -- the Clutch tab).
- **`docs/design/provider-architecture.md` is stale** — it still says `STATS_PROVIDER` defaults to `'espn'` and BDL is "not yet flipped on," but dev has defaulted to `balldontlie` since `3328b26` and BDL has been the live production source for months. Don't trust that file's rollout-status claims without checking current code; worth a cleanup pass whenever someone's next in that file.

## Do not touch

- `server/routes/api.js` (God-Module, already refactored as of 2026-08-04; do not add new routes directly to it).
- The `users.teamRepId` index — critical for poll performance.
- The `notifications` TTL index on `expiresAt` — without it, notifications linger indefinitely.
- `writeCache()`'s storage guard (see Traps) — real-incident-driven, do not remove to "simplify."

## Recent context

- Full pass-by-pass history (mobile nav, courtside redesign, corner/hero polish, playoffs+pagination+sticky-indicator) lives in git log, not here — see commits `cd7ece0` (v246) through `897e63f` (v250).
- Prior ESPN→BallDontLie migration history, the Mongo quota incident, and the PBP/Advanced reliability rebuild are all in git log `687a18c..728cff0` (25 commits) — see individual commit EXPECTED/VERIFIED-BY blocks for detail, not reproduced here.
- BDL expansion roadmap (current work-stream): `docs/design/bdl-expansion-roadmap.md`. Started from a full audit of BDL's WNBA OpenAPI spec (mirrored at `docs/design/bdl-openapi-wnba.yml`) — see `Brain/Memory/reference_knowthew_bdl_openapi.md` if working from a different session. `feature-backlog.md`'s injury-report/odds ideas moved into this roadmap once scheduled.

## Known cosmetic follow-ups (non-blocking, not re-verified recently)

1. Notification dropdown has no side margin on ≤360px viewports — renders as a flush "bar" rather than a floating card.
2. If ESPN returns an unexpectedly shaped `opponent` field, the dropdown silently renders a bare "?" with no console warning.
