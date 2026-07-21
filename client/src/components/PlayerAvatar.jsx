import { useState } from 'react';
import { initialsOf } from '../lib/initials';

// ESPN canonical headshot URL — used as fallback when the roster feed omits a headshot.
function espnHeadshotUrl(id) {
  return `https://a.espncdn.com/i/headshots/wnba/players/full/${id}.png`;
}

// Just the photo — split out from the old combined PlayerHero so it can sit next to the player's
// name in the fight-score row instead of dragging team/jersey/archetype along with it. Renders
// nothing on error/missing player rather than a placeholder box, since it sits inline next to text
// that already identifies the player.
export default function PlayerAvatar({ player, loading, error }) {
  const [imgError, setImgError] = useState(false);

  if (loading) return <div className="compare-hero-avatar placeholder compare-hero-avatar--skeleton" aria-hidden="true" />;
  if (error || !player) return null;

  const p = player.player ?? player;
  const imgSrc = p.headshot ?? espnHeadshotUrl(p.id);

  return !imgError
    ? <img
        src={imgSrc}
        alt={p.name}
        className="compare-hero-avatar"
        onError={() => setImgError(true)}
      />
    : <div className="compare-hero-avatar placeholder">{initialsOf(p.name)}</div>;
}
