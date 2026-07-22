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

This refresh ran as a sequence of small, independently-verified rounds (mirroring how the Compare page's own mobile work shipped — 18 rounds, not one rewrite), rather than a single pass. Full sweep closed 2026-07-22:

- **Player page** (the named weak spot) — sticky-column desync, control-row overflow, sub-44px touch targets, archetype-card clipping, wide-table column-hiding (Per Game/Totals). Shipped.
- **Global header/footer** — CSS-only fix (tap targets, wrapping); no hamburger/drawer — the header has no nav links to hide (just logo + search) and the footer is 4 legal links, not enough surface to justify new drawer machinery. Shipped.
- **Team Roster** — the archetype-card clipping risk was already resolved by the Player-page portal fix (it's a shared component); the one real bug was the 4-column table overflowing ~8px past a 320px viewport from full-size cell padding on narrow Jersey/Pos columns. Row/touch-target sizing turned out already fine on measurement (every row is ~59-60px regardless of content). Shipped.
- **Team Stats** — verified already fine, `auto-fill` grid reflows cleanly at every width checked. No change needed.
- **Similar Players** — the row's stat/confidence-tag block (all `white-space:nowrap`) was squeezing player names down to unreadable 6-7 character fragments at ≤480px; fixed by wrapping the stat onto its own line. Shipped.
- **Compare page** — conditional round, skipped: a full viewport sweep (320/480/600/820/1280px) after every other round found no regression. The two do-not-touch zones' truncation behavior is unchanged (pre-existing, intentional).
- **Home/Search/legal/Team Dashboard/History/Schedule** — spot-check sweep at 320px, all clean (no horizontal overflow, no layout breakage). No change needed.

Update this doc in place as any area's mobile treatment changes again — don't append a dated log here; git history is the log.
