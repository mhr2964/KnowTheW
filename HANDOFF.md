# HANDOFF — KnowTheW

Forward-looking handoff for the active work-stream. **Overwrite** each session; history lives in git. Durable architecture/design rules live in `docs/design/` (see `docs/design/design.md`), not here — this file is transient work-stream state only.

```yaml
last-model: claude-sonnet-5
last-session: 2026-08-21 — Pass 4 of the mobile player-page polish effort shipped (v250, commits 9269c2f + 897e63f): playoffs toggle added to Splits/Shot Chart/Play-by-Play (Game Log already had it), generic pagination moved into BrefTable, and a sticky-nav "(Season)"/"(Playoffs)" indicator that appears once the in-page season toggle scrolls out of view. Passes 1-3 (mobile hamburger nav, courtside quick-glance redesign, corner/crowding/hero polish) shipped earlier the same day as v246/v247/v248-retry(v249).
state: green. Player-page mobile UI is consistent across all 10 stat-type tabs, with playoffs support now on every tab that has one. No open blockers.
```

## Next action

**Nothing queued.** This is an open-ended polish effort per the user — treat a future feedback round as "Pass 5," not a new work-stream. If one comes in, start by reading this file's `state` line and the last 2 commits (`git log -3 --oneline`) rather than re-deriving context.

## Traps

- **BDL id-resolution failures silently drop PBP/Advanced data** for that player's BDL-era seasons — no ESPN fallback, unlike other methods. See `docs/design/provider-architecture.md` and commit `7224c98`.
- **`writeCache()`'s 400MB storage guard is load-bearing for every cache collection app-wide** (`9b4efa4`) — a real incident (Mongo free-tier quota filled mid-backfill) drove this. Do not remove or raise casually.
- **Percentile coverage is perGame/totals/per36/adjShooting only** (`percentileClient.js`'s `PERCENTILE_STATS`) — Per 100 Poss has no league-wide team-pace fetch yet, so its toggle stays intentionally hidden rather than shown-and-broken.
- **`docs/design/provider-architecture.md` is stale** — it still says `STATS_PROVIDER` defaults to `'espn'` and BDL is "not yet flipped on," but dev has defaulted to `balldontlie` since `3328b26` and BDL has been the live production source for months. Don't trust that file's rollout-status claims without checking current code; worth a cleanup pass whenever someone's next in that file.

## Do not touch

- `server/routes/api.js` (God-Module, already refactored as of 2026-08-04; do not add new routes directly to it).
- The `users.teamRepId` index — critical for poll performance.
- The `notifications` TTL index on `expiresAt` — without it, notifications linger indefinitely.
- `writeCache()`'s storage guard (see Traps) — real-incident-driven, do not remove to "simplify."

## Recent context

- Full pass-by-pass history (mobile nav, courtside redesign, corner/hero polish, playoffs+pagination+sticky-indicator) lives in git log, not here — see commits `cd7ece0` (v246) through `897e63f` (v250, current).
- Prior ESPN→BallDontLie migration history, the Mongo quota incident, and the PBP/Advanced reliability rebuild are all in git log `687a18c..728cff0` (25 commits) — see individual commit EXPECTED/VERIFIED-BY blocks for detail, not reproduced here.
- See `docs/design/feature-backlog.md` for unscheduled ideas (injury report, odds/spread on schedule).

## Known cosmetic follow-ups (non-blocking, not re-verified recently)

1. Notification dropdown has no side margin on ≤360px viewports — renders as a flush "bar" rather than a floating card.
2. If ESPN returns an unexpectedly shaped `opponent` field, the dropdown silently renders a bare "?" with no console warning.
