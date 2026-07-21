# HANDOFF — KnowTheW

Forward-looking handoff for the active work-stream. **Overwrite** each session; history lives in git. Durable architecture/design rules live in `docs/design/` (see `docs/design/design.md`), not here — this file is transient work-stream state only.

```yaml
last-model: claude-sonnet-5
last-session: 2026-07-21 (mobile refresh, rounds 0-5)
state: yellow — 6 commits local-only, not yet pushed; pausing for user review before continuing
```

## Next action

**Waiting on user review**, then either continue to Round 6 or push what's done. Mobile UI refresh (see `docs/design/mobile-refresh.md`) is mid-sequence, paused by explicit user choice ("Player page first, then pause") after closing out every Player-page item:
- Round 0 foundation, Round 1 header/footer, Round 2 sticky-column desync, Round 3 control-row wrap + touch targets, Round 4 archetype-card portal fix, Round 5 hero-name clamp + column-hiding — all committed on `master`, **none pushed to `origin/master` yet** (a push there is a Heroku production deploy — see `docs/design/deployment-ops.md` — so it waited for explicit go-ahead rather than happening automatically).
- Deferred, not started: Round 6 (Team Roster/Stats/Similar Players), Round 7 (Compare page, conditional), Round 8 (Home/Search/legal sweep) — see `docs/design/mobile-refresh.md` for scope.

## Traps

- The Compare-page breakpoints at `compare.css:567-574`/`585-596` are still the do-not-touch zone (commits `fd68637`/`5d7cb68`) — the mobile refresh's Round 7 is conditional specifically because of this.
- `.bref-col-low-priority` (GS/ORB/DRB/PF hidden at ≤480px) is currently scoped to Per Game/Totals only via `BrefTable.jsx`'s `viewMode` gate — don't assume it also applies to Advanced/Game Log/Splits/PBP without checking that gate first.
- AdSense application submitted 2026-07-20, still awaiting Google review.

## Do not touch

- Nothing mid-edit as of this handoff.

## Recent context

- Live at `https://knowthew.net`; local `master` is 6 commits ahead of `origin/master` (all this session's mobile-refresh rounds) pending user review + push decision.
- `docs/design/mobile-refresh.md` has the full breakpoint convention, do-not-touch zones, and round sequencing for this effort.
- Compare-page round 18 (chunked sections, grade-notch bars, bigger photos) shipped and is live as of the prior session — no open thread there right now.
