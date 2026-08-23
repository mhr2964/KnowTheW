# BDL expansion roadmap

**Shipped 2026-08-22 — all 12 features complete.** Built from a 2026-08-21 audit of BallDontLie's
full WNBA GOAT-tier API surface (`bdl-openapi-wnba.yml` in this same folder), which turned up data
the site pulled into existing endpoints but never surfaced, plus a few genuinely new capabilities
(standings, injuries, odds) that didn't exist on the site in any form. Executed one feature at a
time, each with its own commit + lint/build/test + live Playwright verification + push/deploy
cycle. Full per-feature build narrative lives in git log, not here — see each commit's own
EXPECTED/VERIFIED-BY body for detail.

Player props stayed explicitly deferred (user call, 2026-08-17 brainstorm) — never built.

## What shipped

1. **Site IA rework** (Teams/Standings pages, real homepage, nav) — `7a13739`
2. **Off/Def/Net Rating + PIE** on the existing Advanced tab — `0d247e1`
3. **Clutch splits** (new tab) — `655b17f`
4. **Scoring-distribution dashboard** — `aba847b`
5. **Usage dashboard** — `7b91627`
6. **Defense dashboard** (incl. Defensive Win Shares) — `4e95747`
7. **Team Four Factors** (Team Stats page) — `8d4e297`
8. **Team shot chart** — `521de41`
9. **League shot-zone leaderboards** — `0339d5e`
10. **Per-game advanced stats** (Game Log, expandable row) — `6fea134`
11. **Injury report** (player + roster widgets, notification-job hook) — `ceda90e`
12. **Odds/spread on schedule** — `a752025`

## Open items surfaced during the run

- ~~Feature 6's Defensive-Win-Shares discrepancy~~ — **resolved 2026-08-22**: user decided BDL's
  `def_ws` is authoritative. Also caught and fixed a real bug while wiring this in: the Defense
  tab's own BDL fetch used `per_mode='per_game'`, which silently returned def_ws divided by games
  played (0.15) instead of the season total (6.01) actually documented/compared — Win Shares is
  always a season total, never per-game. Fixed to `per_mode='totals'` (deriving the genuinely
  per-game fields — blk/stl/dreb/opp_pts_* — back down by dividing by gp, confirmed identical to
  what per_mode='per_game' itself returned for those). The Advanced tab's DWS/WS/WS_PER48 now
  source from this same BDL number when available (2022+, `overrideDwsWithBdl` in
  `advancedStats.js`), falling back to the homegrown formula for earlier seasons BDL doesn't
  cover. Defense tab's column label dropped "BDL" (now "Def WS", not a side-by-side alternative).
  See commit referenced in git log for this fix.
- ~~Heroku Scheduler add-on is not installed on this app~~ — **partially resolved 2026-08-22**: the
  add-on itself is now installed (`heroku addons:create scheduler:standard`) — confirmed via
  `heroku addons`, state `created`. Both the pre-game notifications job (pre-existing) and the
  injury-status-change job (Feature 11) remain built, tested, and internally routed
  (`/internal/jobs/notifications/poll`, `/internal/jobs/notifications/injuries/poll`), but adding
  the actual scheduled-job entries (command + interval) is dashboard-only — no CLI/API for it
  exists (confirmed: `heroku scheduler` isn't a command, no scheduler-specific plugin). Still needs
  a one-time manual step from the user: `heroku addons:open scheduler`, then add two jobs running
  `curl -s -X POST -H "x-scheduler-token: $SCHEDULER_TOKEN" https://knowthew.net/internal/jobs/notifications/poll`
  (every 10 minutes) and the same with `/injuries/poll` appended in place of `/poll` (hourly is
  plenty — injury status changes far less often than game kickoffs).
