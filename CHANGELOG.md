# Changelog — KnowTheW

## 2026-05-10
- **Team pages now split into a dashboard with four navigation tabs (Dashboard, Roster, Stats, History)** — Users see a team overview with roster, stats, and franchise-history previews on the dashboard spoke, each with a link to view the full section. Phase 1 delivers the page structure and roster spoke; stats and history are coming-soon stubs.
  Files: client/src/App.jsx, client/src/pages/TeamPage.jsx, client/src/pages/TeamDashboard.jsx, client/src/pages/TeamRosterPage.jsx, client/src/pages/TeamStatsPage.jsx, client/src/pages/TeamHistoryPage.jsx, client/src/pages/PlayerRoutePage.jsx, client/src/App.css

## 2026-05-09
- **Add client-side routing with bookmarkable URLs for teams and players** — Users can now share and bookmark links to specific teams, players, and stat tabs. Browser Back/Forward work correctly, and all pages refresh without losing navigation context.
  Files: client/package.json, client/package-lock.json, client/src/main.jsx, client/src/App.jsx, client/src/components/PlayerPage.jsx, client/src/components/DetailedStats.jsx, client/src/hooks/useLazyFetch.js, client/src/pages/HomePage.jsx, client/src/pages/TeamPage.jsx, client/src/pages/PlayerRoutePage.jsx, client/src/pages/SearchPage.jsx, client/src/pages/NotFoundPage.jsx, DESIGN-routing.md
