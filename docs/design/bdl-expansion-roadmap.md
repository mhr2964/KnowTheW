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

## Open items surfaced during the run (not resolved by it)

- **Feature 6's Defensive-Win-Shares discrepancy**: BDL's `def_ws` and this site's homegrown `DWS`
  formula diverge materially on the same player-season (BDL 6.01 vs. homegrown 1.71, A'ja Wilson
  2025). Both are shown side-by-side, unreconciled (Defense tab's "BDL Def WS" vs. Advanced tab's
  "DWS") — needs a user decision on which is authoritative, not something to guess at.
- **Heroku Scheduler add-on is not installed on this app at all** (confirmed live, Feature 11 —
  `heroku addons` returns none). Both the pre-game notifications job (pre-existing) and the
  injury-status-change job (Feature 11) are built, tested, and internally routed
  (`/internal/jobs/notifications/poll`, `/internal/jobs/notifications/injuries/poll`), but neither
  has ever actually run in production. Needs a one-time dashboard step (add the Scheduler add-on +
  two scheduled jobs pointing at those routes) whenever the user wants either one live.
