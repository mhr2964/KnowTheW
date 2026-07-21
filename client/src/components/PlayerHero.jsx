import { useState } from 'react';
import ArchetypeBadge from './ArchetypeBadge';
import { initialsOf } from '../lib/initials';

// ESPN canonical headshot URL — used as fallback when the roster feed omits a headshot.
function espnHeadshotUrl(id) {
  return `https://a.espncdn.com/i/headshots/wnba/players/full/${id}.png`;
}

// Extracted from ComparePage so it can also render inside CompareVerdict's AT A GLANCE card,
// flanking the overall grade — avoids duplicating the image-fallback/retired-team-name/archetype
// logic in two places. Always renders as a centered column (photo, then name/team/archetype/Change
// stacked below); side identity is carried by whichever wrapper positions it, not by this component.
export default function PlayerHero({ player, loading, error, onChangeSide, finalTeamName }) {
  const [imgError, setImgError] = useState(false);

  if (loading) {
    return (
      <div className="compare-hero-player compare-hero-skeleton">
        <div className="compare-hero-img placeholder" />
        <div className="compare-hero-info">
          <div className="compare-hero-skeleton-name" />
        </div>
      </div>
    );
  }
  if (error) return (
    <div className="compare-hero-player compare-hero-error">
      <p className="status-msg error">Could not load player.</p>
      <button type="button" className="compare-change-link" onClick={onChangeSide}>Change</button>
    </div>
  );
  if (!player) return null;

  const p = player.player ?? player;
  const isRetired = p.retired === true;
  const displayTeam = p.teamName ?? (isRetired ? finalTeamName : null);
  const imgSrc = p.headshot ?? espnHeadshotUrl(p.id);

  return (
    <div className="compare-hero-player">
      {!imgError
        ? <img
            src={imgSrc}
            alt={p.name}
            className="compare-hero-img"
            onError={() => setImgError(true)}
          />
        : <div className="compare-hero-img placeholder">{initialsOf(p.name)}</div>
      }
      <div className="compare-hero-info">
        <div className="compare-hero-meta">
          {p.jersey && <span className="player-hero-jersey">#{p.jersey}</span>}
          {displayTeam && (
            <span className="player-hero-team">
              {displayTeam}{isRetired && !p.teamName && <em className="compare-hero-former"> (former)</em>}
            </span>
          )}
        </div>
        <h2 className="compare-hero-name">{p.name}</h2>
        <ArchetypeBadge playerId={p.id} />
        <button type="button" className="compare-change-link" onClick={onChangeSide}>Change</button>
      </div>
    </div>
  );
}
