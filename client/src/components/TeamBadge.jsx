// Team abbreviation + logo, for a <td className="standings-col-team"> cell -- that class already
// gives the flex/left-align/gap layout StandingsPage.jsx established for exactly this pairing, so
// every table on the site that shows "which team" reads the same way. `abbr` alone (no logo found)
// still renders, just without an image -- same graceful-degradation posture as StandingsPage's
// own `row.logo &&` guard.
export default function TeamBadge({ abbr, logoByAbbr }) {
  if (!abbr) return <span>—</span>;
  const logo = logoByAbbr?.get(abbr.toUpperCase());
  return (
    <>
      {logo && <img src={logo} alt="" className="standings-team-logo" />}
      <span>{abbr}</span>
    </>
  );
}
