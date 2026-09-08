import { useEffect, useState } from 'react';

function badgeLabel({ label, years }) {
  return years.length > 1 ? `${years.length}x ${label}` : `${years[0]} ${label}`;
}

// years.join was previously only reachable via a hover title -- invisible on a touch screen, which
// is most of this site's traffic. Shown inline instead so the actual years are always visible, not
// just for anyone with a mouse.
function badgeYears({ years }) {
  return years.length > 1 ? years.join(', ') : null;
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
        <span key={a.key} className="player-award-badge">
          {badgeLabel(a)}
          {badgeYears(a) && <span className="player-award-badge-years">{badgeYears(a)}</span>}
        </span>
      ))}
    </div>
  );
}
