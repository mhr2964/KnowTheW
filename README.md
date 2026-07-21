# KnowTheW

A WNBA stats and reference site for new fans — player and team lookups, AI-graded scouting reports, and head-to-head comparisons, without the overwhelming menus of a traditional box-score site.

**Live:** [knowthew.net](https://knowthew.net)

## Features

- **Player pages** — Per Game / Totals / Per 36 / Advanced / Play-by-Play / Splits / Game Log tabs, all sortable with CSV export
- **AI-graded scouting reports** — Claude-generated category grades (scoring, playmaking, defense, etc.) with supporting stats context
- **Compare tool** — side-by-side grading of any two players, with a playstyle radar overlay, accolade chips, and per-category margin bars; supports Peak/Career/Playoffs modes
- **Archetype badges** — role classification (e.g. "Interior Anchor," "Floor General") from a position-pooled statistical fingerprint, recency-weighted toward each player's current form
- **Cross-Era Similarity** — finds statistically similar players across seasons using the same fingerprint model
- **Team pages** — roster, schedule, season history, and team-level stats
- **Study Flow** — flashcard-style quiz mode for learning rosters/stats
- **Splits** — Home/Away, Monthly, and By-Opponent shooting/stat breakdowns

## Stack

- **Frontend:** React 18 + Vite
- **Backend:** Node.js + Express
- **Data:** ESPN's public stats endpoints, behind a swappable `SportsDataProvider` contract (see Notes)
- **AI grading:** Claude (Anthropic API)
- **Database:** MongoDB Atlas (response caching)
- **Analytics/Ads:** Google Analytics 4, Google AdSense
- **Hosting:** Heroku (auto-deploys from `origin/master`)

## Setup

```bash
npm run install-all
npm run dev
```

Client runs on `http://localhost:3051`, server on `http://localhost:5051`. (See `System/ports.md` for the workspace port registry.)

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Express server with nodemon |
| `npm run client` | Start Vite dev server |
| `npm run build` | Build client for production |
| `npm run lint` | Lint server and client |
| `npm test` | Run the `node:test` suite |
| `npm run check` | Lint + tests (the gate run before every commit) |

## Notes

- `.env` is gitignored — copy the structure from `.env` and fill in values locally. Required: `ANTHROPIC_API_KEY`, `MONGODB_URI`. Optional (production only): `VITE_GA_MEASUREMENT_ID`, `VITE_AD_SLOT_TOP` / `VITE_AD_SLOT_FOOTER` / `VITE_AD_SLOT_SIDEBAR`
- Production build is served statically from `client/build` by the Express server
- **Data source** is swappable behind `server/providers/` (a `SportsDataProvider` contract). `STATS_PROVIDER` selects the implementation (`espn`, default; `sportradar`, stubbed). All external-source access goes through `getProvider()` — see `server/providers/SportsDataProvider.js` for the contract. See `/data-sources` on the live site for the full attribution/legal notes.
