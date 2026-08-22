// Pure display: renders nothing for a healthy player (injury: null), else a small status pill with
// the full comment as a tooltip. Shared by InjuryBadge (player hero, fetches its own data) and
// RosterTable (injury already attached server-side per roster row -- see routes/teams.js's
// /teams/:id/roster) so both surfaces render the identical pill from an {status, returnDate,
// comment} | null shape.
export default function InjuryPill({ injury }) {
  if (!injury) return null;

  const title = [injury.comment, injury.returnDate && `Est. return: ${injury.returnDate}`]
    .filter(Boolean).join(' ');

  return (
    <span className="injury-badge" title={title || undefined}>
      {injury.status}
    </span>
  );
}
