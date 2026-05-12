import { useState, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import RosterTable from '../components/RosterTable';

export default function TeamRosterPage() {
  const { team, onSaveDeck, season, isCurrentSeason } = useOutletContext() ?? {};
  const navigate = useNavigate();

  const isDefunct = !!team?.defunct;
  const shouldFetch = isCurrentSeason || isDefunct;

  const [roster, setRoster] = useState([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterError, setRosterError] = useState(false);

  useEffect(() => {
    if (!shouldFetch) return;

    const controller = new AbortController();
    setRoster([]);
    setRosterError(false);
    setRosterLoading(true);
    fetch(`/api/teams/${team.id}/roster?season=${season}`, { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => { setRoster(data.players ?? []); setRosterLoading(false); })
      .catch(err => {
        if (err.name !== 'AbortError') {
          setRosterError(true);
          setRosterLoading(false);
        }
      });
    return () => controller.abort();
  }, [team?.id, season, shouldFetch]);

  if (!isCurrentSeason && !isDefunct) {
    return (
      <div className="team-spoke-content">
        <p className="status-msg">Historical rosters not available for the {season} season.</p>
        <p className="status-msg muted">ESPN only exposes current rosters. Browse Schedule or Stats to see historical data for this season.</p>
      </div>
    );
  }

  if (rosterLoading) return <div className="team-spoke-content"><p className="status-msg">Loading roster...</p></div>;
  if (rosterError) return <div className="team-spoke-content"><p className="status-msg error">Could not load roster — try again.</p></div>;
  if (roster.length === 0) return <div className="team-spoke-content"><p className="status-msg">No roster data available.</p></div>;

  return (
    <div className="team-spoke-content">
      <RosterTable
        players={roster}
        teamName={team.name}
        onSaveDeck={onSaveDeck}
        onPlayerClick={(id) => navigate(`/player/${id}`)}
      />
    </div>
  );
}
