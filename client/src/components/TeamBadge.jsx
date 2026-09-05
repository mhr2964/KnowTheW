// Team abbreviation + logo, for a <td className="standings-col-team"> cell -- that class already
// gives the flex/left-align/gap layout StandingsPage.jsx established for exactly this pairing, so
// every table on the site that shows "which team" reads the same way. `abbr` alone (no logo found)
// still renders, just without an image -- same graceful-degradation posture as StandingsPage's
// own `row.logo &&` guard. `nameByAbbr` is optional: when passed, shows the full team name (e.g.
// "Las Vegas Aces") instead of the bare abbreviation on wide viewports -- StandingsPage's own team
// column already shows the full name, so pages with room for it (a single team per row) match
// that. Below 480px it collapses back to the abbreviation via .th-full/.th-short (the same
// full-text/abbreviated-text swap ScheduleTable.jsx's date column already uses) -- a full name
// was the thing forcing several of these tables into horizontal scroll on a phone that didn't
// need it before. Pages tighter on space (two teams in one cell, or a Notes column eating the
// rest of the row) skip nameByAbbr entirely and keep the compact abbreviation at every width.
export default function TeamBadge({ abbr, logoByAbbr, nameByAbbr }) {
  if (!abbr) return <span>—</span>;
  const logo = logoByAbbr?.get(abbr.toUpperCase());
  const fullName = nameByAbbr?.get(abbr.toUpperCase());
  return (
    <>
      {logo && <img src={logo} alt="" className="standings-team-logo" />}
      {fullName ? (
        <>
          <span className="th-full">{fullName}</span>
          <span className="th-short">{abbr}</span>
        </>
      ) : (
        <span>{abbr}</span>
      )}
    </>
  );
}
