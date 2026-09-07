import { useEffect, useState } from 'react';

function badgeLabel({ label, years }) {
  return years.length > 1 ? `${years.length}x ${label}` : `${years[0]} ${label}`;
}

// Career awards trophy case for the player hero -- a gap the Basketball-Reference comparison
// surfaced: /api/league/awards already had this exact data (MVP/Finals MVP/DPOY/ROY/Sixth Player/
// All-WNBA First Team), just never joined onto the player it belongs to. Renders nothing for a
// player with no awards (the common case), same graceful-empty posture as InjuryBadge.
export default function PlayerAwardsBadges({ playerId }) {
  const [awards, setAwards] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    setAwards(null);
    fetch(`/api/players/${playerId}/awards`, { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => setAwards(data.awards))
      .catch(err => { if (err.name !== 'AbortError') setAwards([]); });
    return () => controller.abort();
  }, [playerId]);

  if (!awards || awards.length === 0) return null;

  return (
    <div className="player-awards-case">
      {awards.map(a => (
        <span key={a.key} className="player-award-badge" title={a.years.join(', ')}>
          {badgeLabel(a)}
        </span>
      ))}
    </div>
  );
}
