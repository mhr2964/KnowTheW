// Team/jersey + Change link only — the photo moved to PlayerAvatar (beside the name in the fight
// row) and the name/archetype badge were dropped entirely from this placement: the name already
// renders next to the photo, and the archetype badge was redundant clutter flanking the overall
// grade rather than useful context there.
export default function PlayerMeta({ player, loading, error, onChangeSide, finalTeamName }) {
  if (loading) return <div className="compare-hero-meta-skeleton" aria-hidden="true" />;
  if (error) return (
    <button type="button" className="compare-change-link" onClick={onChangeSide}>Change</button>
  );
  if (!player) return null;

  const p = player.player ?? player;
  const isRetired = p.retired === true;
  const displayTeam = p.teamName ?? (isRetired ? finalTeamName : null);

  return (
    <div className="compare-hero-info">
      <div className="compare-hero-meta">
        {p.jersey && <span className="player-hero-jersey">#{p.jersey}</span>}
        {displayTeam && (
          <span className="player-hero-team">
            {displayTeam}{isRetired && !p.teamName && <em className="compare-hero-former"> (former)</em>}
          </span>
        )}
      </div>
      <button type="button" className="compare-change-link" onClick={onChangeSide}>Change</button>
    </div>
  );
}
