import { useState, useEffect } from 'react';
import { useOutletContext, Link } from 'react-router-dom';

export default function TeamDashboard() {
  const { team } = useOutletContext() ?? {};

  const [rosterPreview, setRosterPreview] = useState([]);
  const [rosterCount, setRosterCount] = useState(null);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterError, setRosterError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setRosterLoading(true);
    setRosterError(false);
    fetch(`/api/teams/${team.id}/roster`, { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => {
        const players = data.players ?? [];
        setRosterCount(players.length);
        setRosterPreview(players.slice(0, 3));
        setRosterLoading(false);
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          setRosterError(true);
          setRosterLoading(false);
        }
      });
    return () => controller.abort();
  }, [team.id]);

  return (
    <div className="team-dashboard-grid">
      <div className="team-dashboard-card">
        <div className="team-dashboard-card-headline">
          Roster
          {!rosterLoading && rosterCount !== null && (
            <span className="team-dashboard-badge">{rosterCount} active</span>
          )}
        </div>
        <div className="team-dashboard-card-body">
          {rosterLoading && <p className="team-dashboard-placeholder">Loading...</p>}
          {!rosterLoading && rosterError && (
            <p className="team-dashboard-placeholder">Couldn&apos;t load roster preview.</p>
          )}
          {!rosterLoading && !rosterError && rosterPreview.length === 0 && (
            <p className="team-dashboard-placeholder">No roster data.</p>
          )}
          {!rosterLoading && !rosterError && rosterPreview.map(player => (
            <div key={player.id} className="team-dashboard-player-row">
              {player.headshot
                ? <img src={player.headshot} alt={player.name} className="team-dashboard-headshot" />
                : <div className="team-dashboard-headshot team-dashboard-headshot-placeholder">{player.name?.[0] ?? '?'}</div>
              }
              <span className="team-dashboard-player-name">{player.name}</span>
              <span className="team-dashboard-player-pos">{player.position}</span>
            </div>
          ))}
        </div>
        <Link to={`/team/${team.slug}/roster`} className="team-dashboard-card-link">View Roster →</Link>
      </div>

      <div className="team-dashboard-card">
        <div className="team-dashboard-card-headline">Team Stats</div>
        <div className="team-dashboard-card-body">
          <p className="team-dashboard-coming-soon">Stats available soon</p>
          <p className="team-dashboard-coming-text">Points per game, opponent points, three-point pace and more — coming soon.</p>
        </div>
        <Link to={`/team/${team.slug}/stats`} className="team-dashboard-card-link">View Stats →</Link>
      </div>

      <div className="team-dashboard-card">
        <div className="team-dashboard-card-headline">Franchise History</div>
        <div className="team-dashboard-card-body">
          <p className="team-dashboard-coming-soon">History available soon</p>
          <p className="team-dashboard-coming-text">Championships, playoff results, and season-by-season records — coming soon.</p>
        </div>
        <Link to={`/team/${team.slug}/history`} className="team-dashboard-card-link">View History →</Link>
      </div>
    </div>
  );
}
