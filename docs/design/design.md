# Design notes — KnowTheW

Durable design/architecture docs for this project, committed to the repo so they travel with the code (distinct from `HANDOFF.md`, which is transient work-stream state, and from this assistant's own `Brain/Note Pad/knowthew/`, which is workspace-level AI memory that isn't part of this repo).

| File | Covers | Status |
| --- | --- | --- |
| [provider-architecture.md](./provider-architecture.md) | `SportsDataProvider` contract, per-call resolution, caching discipline, test isolation | Current |
| [archetype-fingerprinting.md](./archetype-fingerprinting.md) | Archetype badge fingerprint math, position-pooling, recency decay, versioning | Current |
| [deployment-ops.md](./deployment-ops.md) | Heroku auto-deploy mechanism, env-var bake-in gotcha, domain/DNS setup | Current |
| [team-layer.md](./team-layer.md) | Team hub/roster/stats/history pages, first LLM integration in the codebase | Shipped 2026-05-10 |
| [routing.md](./routing.md) | Client-side routing (bookmarkable team/player/tab URLs) | Shipped 2026-05-09 |
| [tooltips.md](./tooltips.md) | Hover/tap stat-abbreviation definitions on table headers | Shipped 2026-05-09 |
| [team-context.md](./team-context.md) | Team-header record/conference-rank context line | Shipped 2026-05-09 |
| [team-season-dropdown.md](./team-season-dropdown.md) | Per-team historical season picker (Option A) | Shipped 2026-05-11 |
| [team-season-option-b.md](./team-season-option-b.md) | Season-aware header, franchise-lineage names, past-season caching (Option B) | Shipped 2026-05-11 |
| [compare-refinement.md](./compare-refinement.md) | Compare v1.5 — merged year-aligned stat table | Superseded by compare-v2.md |
| [compare-v2.md](./compare-v2.md) | Compare v2 — AI-graded player reports (the architecture the current Compare page is still built on) | Shipped 2026-05-11, actively evolving — see `HANDOFF.md` for the current round of UI feedback |
| [pbp-cache-refactor.md](./pbp-cache-refactor.md) | Play-by-play cache redesign after a Mongo free-tier quota outage | Shipped 2026-05-11 |
| [mobile-refresh.md](./mobile-refresh.md) | Mobile UI refresh breakpoint convention, do-not-touch zones, round sequencing | In progress 2026-07-21 |

Shipped docs are kept as historical design record — they explain *why* a shipped feature is shaped the way it is, which git log alone doesn't answer well. Update a doc in place if its subject's architecture changes again; don't append a new dated entry to the same file (that's what git history is for).
