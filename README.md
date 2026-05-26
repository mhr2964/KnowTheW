# KnowTheW

A WNBA sports database for new fans — quick lookups for players, teams, and stats without the overwhelming menus.

## Stack

- **Frontend:** React 18 + Vite
- **Backend:** Node.js + Express
- **Hosting:** Heroku

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

- `.env` is gitignored — copy the structure from `.env` and fill in values locally
- Production build is served statically from `client/build` by the Express server
- **Data source** is swappable behind `server/providers/` (a `SportsDataProvider` contract). `STATS_PROVIDER` selects the implementation (`espn`, default; `sportradar`, stubbed). All external-source access goes through `getProvider()` — see `server/providers/SportsDataProvider.js` for the contract.
