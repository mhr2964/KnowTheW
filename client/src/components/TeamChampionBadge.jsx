import { useEffect, useState } from 'react';

// "WNBA Champions" banner for a team-season that won the title -- bbref shows this prominently next
// to the team name/logo on a title-winning season's page; this site already had the same
// championships data (team dashboard's History card), just never surfaced as a banner at the top.
// A standalone fetch (not threaded through TeamPage.jsx's own state) so this stays a pure addition
// with no risk to that page's existing season-resolution logic.
export default function TeamChampionBadge({ teamId, season, isDefunct }) {
  const [championships, setChampionships] = useState(null);

  useEffect(() => {
    // /teams/:id/history doesn't cover synthetic defunct-team ids -- same guard the team
    // dashboard's own History card already applies before calling this endpoint.
    if (!teamId || isDefunct) return;
    const controller = new AbortController();
    setChampionships(null);
    fetch(`/api/teams/${teamId}/history`, { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => setChampionships(data?.championships ?? []))
      .catch(err => { if (err.name !== 'AbortError') setChampionships([]); });
    return () => controller.abort();
  }, [teamId, isDefunct]);

  if (!championships?.includes(season)) return null;
  return <span className="team-champion-badge">WNBA Champions</span>;
}
