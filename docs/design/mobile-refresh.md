# Mobile UI refresh

## Breakpoint convention

Standardize on three tiers, all already precedented somewhere in the codebase before this doc existed — don't invent new numbers:

- **≤480px** — phones, the tightest tier. Established in `responsive.css`.
- **≤600px** — the primary "mobile" cutover, used across `responsive.css` and most of `player.css`.
- **≥820px** — the shared tablet tier, precedented by `compare.css:609` (profile-row stacking). Use this exact number rather than 768px so the app stays internally consistent.

`--touch-target-min: 44px` (`global.css`) is the shared minimum tap-target size (WCAG 2.5.5 / Apple HIG). `.team-spoke-tab` used this value as a literal before the token existed — new mobile work should reference the token instead of repeating the literal.

## Do-not-touch zone

`compare.css:567-574` and `compare.css:585-596` are two deliberate, fragile fixes (mobile fight-row name truncation and the 481-975px headline tier — see `HANDOFF.md` and commits `fd68637`/`5d7cb68`). Don't edit either without first reading those commits' bodies. A new rule elsewhere (e.g. a shared `min-width: 820px` tier) is safe to add as long as it doesn't target `.compare-*` classes inside that 481-975px range.

## Scope and sequencing

This refresh runs as a sequence of small, independently-verified rounds (mirroring how the Compare page's own mobile work shipped — 18 rounds, not one rewrite), rather than a single pass. Current state:

- Player page (flagged as the known weak spot) — sticky-column desync, control-row overflow, sub-44px touch targets, archetype-card clipping, wide-table column-hiding. In progress.
- Global header/footer — CSS-only fix (tap targets, wrapping); no hamburger/drawer — the header has no nav links to hide (just logo + search) and the footer is 4 legal links, not enough surface to justify new drawer machinery.
- Team Roster/Stats, Similar Players, Compare (conditional), Home/Search/legal — deferred, pending review of the Player-page + header/footer rounds first.

Update this doc in place as each area's mobile treatment lands or changes — don't append a dated log here; git history is the log.
