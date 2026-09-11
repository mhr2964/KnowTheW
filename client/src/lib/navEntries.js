// Single source of truth for site-nav content, consumed by both the desktop dropdown bar
// (NavDropdown-based, .site-nav) and the mobile accordion menu (MobileNav, below the 1020px
// breakpoint) -- built once so the two nav renderings can't silently drift apart as pages are
// added, the way a hand-duplicated list in two JSX blocks eventually would.
//
// `teamsItems` is the one dynamic piece (built from the async /api/teams fetch), passed in rather
// than hardcoded here.
export function buildNavEntries(teamsItems) {
  return [
    { type: 'link', to: '/', label: 'Home', end: true },
    // `to` on a group is its own "main page" -- clicking the label text itself navigates there,
    // same as any plain top-level link; the separate caret button is the only thing that opens the
    // dropdown panel of every item in the section. Picked as whichever item is the section's own
    // index/hub page, not just "first item in the list" (Players' own first item is Search, which
    // isn't a landing page).
    { type: 'group', label: 'Teams', to: '/teams', items: teamsItems },
    {
      type: 'group',
      label: 'Players',
      to: '/players',
      items: [
        { to: '/search', label: 'Search' },
        { to: '/players', label: 'Player Directory' },
      ],
    },
    { type: 'link', to: '/standings', label: 'Standings' },
    {
      type: 'group',
      label: 'Leaders',
      to: '/league-leaders',
      items: [
        { to: '/league-leaders', label: 'League Leaders' },
        { to: '/season-stats', label: 'Season Stats' },
        { to: '/leaders', label: 'Shot Zone Leaders' },
        { to: '/all-time-leaders', label: 'All-Time Leaders' },
        { to: '/awards', label: 'Awards History' },
      ],
    },
    {
      type: 'group',
      label: 'Scores',
      to: '/schedule',
      align: 'right',
      items: [
        { to: '/schedule', label: 'Schedule & Scores' },
        { to: '/playoffs', label: 'Playoffs' },
        { to: '/notable-games', label: 'Notable Games' },
        { to: '/odds', label: 'Odds' },
      ],
    },
    { type: 'link', to: '/injuries', label: 'Injury Report' },
  ];
}

export function buildTeamsNavItems(teams) {
  return [
    { to: '/teams', label: 'All Teams', strong: true },
    ...teams.filter(t => !t.defunct).map(t => ({ to: `/team/${t.slug}`, label: t.name })),
  ];
}
