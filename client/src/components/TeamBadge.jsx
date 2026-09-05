// Team abbreviation + logo, for a <td className="standings-col-team"> cell -- that class already
// gives the flex/left-align/gap layout StandingsPage.jsx established for exactly this pairing, so
// every table on the site that shows "which team" reads the same way. `abbr` alone (no logo found)
// still renders, just without an image -- same graceful-degradation posture as StandingsPage's
// own `row.logo &&` guard. `nameByAbbr` is optional: when passed, shows the full team name (e.g.
// "Las Vegas Aces") instead of the bare abbreviation -- StandingsPage's own team column already
// shows the full name, so pages with room for it (a single team per row) match that; pages tighter
// on space (two teams in one cell, or a Notes column eating the rest of the row) can skip it and
// keep the compact abbreviation.
export default function TeamBadge({ abbr, logoByAbbr, nameByAbbr }) {
  if (!abbr) return <span>—</span>;
  const logo = logoByAbbr?.get(abbr.toUpperCase());
  const label = nameByAbbr?.get(abbr.toUpperCase()) ?? abbr;
  return (
    <>
      {logo && <img src={logo} alt="" className="standings-team-logo" />}
      <span>{label}</span>
    </>
  );
}
