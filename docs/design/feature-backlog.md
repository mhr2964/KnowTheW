# Feature backlog — unscheduled ideas

Durable holding area for ideas that have been discussed but not designed or scheduled. Unlike the rest of `docs/design/`, entries here are pre-design — move an entry to its own doc (and add it to `design.md`'s index) once it's actually being built, and delete it from this file at that point.

## From the 2026-08-17 BallDontLie GOAT-tier brainstorm

The user has a paid BallDontLie GOAT tier ($39.99/mo, 600 req/min, WNBA coverage at `wnba.balldontlie.io`). It unlocks data ESPN's undocumented endpoints don't give cleanly: play-by-play, standings, injuries, official advanced stats, shot locations, betting odds, and player props. Player props was explicitly deferred by the user ("skip the props for now") — not listed below.

- **Injury report.** BDL's `Player Injuries` endpoint (ALL-STAR tier and up) isn't something this codebase currently pulls from any source. Natural fit as a team/player-page widget, and ties into the existing pre-game notification bell (`server/lib/notificationsJob.js`) — e.g. "your repped player is now questionable" alongside the pre-game alert.

- **Odds/spread on schedule pages.** Lighter-weight than a full props tracker: surface the betting line next to each upcoming game on `TeamSchedulePage`. Needs `Betting Odds` (GOAT tier).
