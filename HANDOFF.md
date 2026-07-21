# HANDOFF — KnowTheW

Forward-looking handoff for the active work-stream. **Overwrite** each session; history lives in git. Durable architecture/design rules live in `docs/design/` (see `docs/design/design.md`), not here — this file is transient work-stream state only.

```yaml
last-model: claude-sonnet-5
last-session: 2026-07-21 (round 18)
state: green
```

## Next action

**Nothing blocking.** Two open threads, neither urgent:

- **Compare-page UI is an open thread, not closed.** User has said repeatedly they're "not done tweaking" `CompareVerdict.jsx`/`compare.css` — 18 rounds of hands-on feedback so far, latest commit `5d7cb68`. Expect more rounds; don't treat the current state as final. See `docs/design/compare-v2.md` for the underlying architecture these rounds are all iterating on top of.
- **AdSense application submitted 2026-07-20, still awaiting Google review** (checked 2026-07-20 — still pending). Nothing to do until approved; then create three ad units in the dashboard, set `VITE_AD_SLOT_TOP`/`VITE_AD_SLOT_FOOTER`/`VITE_AD_SLOT_SIDEBAR` as Heroku config vars (must be set *before* a deploy — see `docs/design/deployment-ops.md`), and confirm Auto Ads stays off (already toggled off in-dashboard by the user).

## Traps

Current, work-stream-specific — not permanent rules (those are in `docs/design/`, especially `provider-architecture.md` and `archetype-fingerprinting.md`):

- **Two intentionally-tight Compare-page breakpoints, not regressions to casually revert:** mobile fight-row name truncation (`max-width: 2.2rem` at ≤480px, round 17, `fd68637`) and the 481–975px headline tier (5.25rem side columns / 76px avatar / no centering nudge / 3.3rem name clamp, round 18, `5d7cb68`) — both are deliberate fixes for real avatar/name overlap bugs found during viewport-sweep verification. Read the git commit body before touching either.
- Domain is `knowthew.net` (Heroku ACM + Cloudflare) — AdSense Site verification for this domain is the one still-unconfirmed step there.

## Do not touch

- Nothing mid-edit as of this handoff.

## Recent context

- Live at `https://knowthew.net`. Launch-roadmap Phases 0–3 (legal hardening, deploy, table/CSV/splits hardening) are closed; Phase 2 (GA4 + AdSense) is functionally closed pending Google's review.
- The Compare page's AI-graded-report architecture (`docs/design/compare-v2.md`) has had continuous UI-polish rounds since shipping — round 18 (`5d7cb68`) added chunked Playstyle/Accolades sections, grade-notch bars, and bigger photos; full round-by-round history is in git log and `Brain/General Session Notes/`, not repeated here.
- `docs/design/` was reorganized 2026-07-21 out of loose root-level `DESIGN-*.md` files plus new architecture writeups distilled out of this file's old (and since-pruned) Traps section — see `docs/design/design.md` for the index.
