# HANDOFF — KnowTheW

Forward-looking handoff for the active work-stream. **Overwrite** each session; history lives in git. Durable architecture/design rules live in `docs/design/` (see `docs/design/design.md`), not here — this file is transient work-stream state only.

```yaml
last-model: claude-sonnet-5
last-session: 2026-08-21 — mobile player-page polish (Passes 1-4, v246-v250) closed out stable; started a new work-stream same day, the BDL expansion roadmap (docs/design/bdl-expansion-roadmap.md), executing autonomously feature-by-feature with a >>ping compact between each. Feature 1 (site nav rework, Teams/Standings pages) shipped as 7a13739.
state: green. Actively building through the BDL expansion roadmap -- see that doc's own Status table for exactly which feature is in progress. No open blockers as of the last shipped feature.
```

## Next action

**Check `docs/design/bdl-expansion-roadmap.md`'s Status table first** — that doc, not this file, is the live source of truth for which of its 12 features is done/in-progress/next during this autonomous run. If every row says shipped, there's nothing queued and a future ask is a new work-stream, not a continuation.

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

- Full pass-by-pass history (mobile nav, courtside redesign, corner/hero polish, playoffs+pagination+sticky-indicator) lives in git log, not here — see commits `cd7ece0` (v246) through `897e63f` (v250).
- Prior ESPN→BallDontLie migration history, the Mongo quota incident, and the PBP/Advanced reliability rebuild are all in git log `687a18c..728cff0` (25 commits) — see individual commit EXPECTED/VERIFIED-BY blocks for detail, not reproduced here.
- BDL expansion roadmap (current work-stream): `docs/design/bdl-expansion-roadmap.md`. Started from a full audit of BDL's WNBA OpenAPI spec (mirrored at `docs/design/bdl-openapi-wnba.yml`) — see `Brain/Memory/reference_knowthew_bdl_openapi.md` if working from a different session. `feature-backlog.md`'s injury-report/odds ideas moved into this roadmap once scheduled.

## Known cosmetic follow-ups (non-blocking, not re-verified recently)

1. Notification dropdown has no side margin on ≤360px viewports — renders as a flush "bar" rather than a floating card.
2. If ESPN returns an unexpectedly shaped `opponent` field, the dropdown silently renders a bare "?" with no console warning.
