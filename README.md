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

Client runs on `http://localhost:5173`, server on `http://localhost:5000`.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Express server with nodemon |
| `npm run client` | Start Vite dev server |
| `npm run build` | Build client for production |
| `npm run lint` | Lint server and client |
| `npm test` | Run linter (CI) |

## Notes

- `.env` is gitignored — copy the structure from `.env` and fill in values locally
- Production build is served statically from `client/build` by the Express server
