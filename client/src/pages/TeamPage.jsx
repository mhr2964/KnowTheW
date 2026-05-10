import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import RosterTable from '../components/RosterTable';

export default function TeamPage({ teams, teamsLoading, onSaveDeck }) {
  const { slug } = useParams();
  const navigate = useNavigate();

  const team = teams.find(t => t.slug === slug) ?? null;

  const [roster, setRoster] = useState([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterError, setRosterError] = useState(false);

  const teamId = team?.id ?? null;

  useEffect(() => {
    if (!teamId) return;
    const controller = new AbortController();
    setRoster([]);
    setRosterError(false);
    setRosterLoading(true);
    fetch(`/api/teams/${teamId}/roster`, { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => { setRoster(data.players); setRosterLoading(false); })
      .catch(err => {
        if (err.name !== 'AbortError') {
          setRosterError(true);
          setRosterLoading(false);
        }
      });
    return () => controller.abort();
  }, [teamId]);

  if (teamsLoading) return <p className="status-msg">Loading teams...</p>;
  if (!team) return <p className="status-msg">Team not found.</p>;

  const seedAndConf = [team.seedLabel && `${team.seedLabel} in`, team.conference]
    .filter(Boolean).join(' ');
  const segs = [team.record, seedAndConf, team.location].filter(Boolean);

  return (
    <>
      <button type="button" className="back-btn" onClick={() => navigate('/')}>← All Teams</button>
      <div className="team-header" style={{ '--team-color': `#${team.color}` }}>
        {team.logo && (
          <img src={team.logo} alt={team.name} className="team-header-logo" />
        )}
        <div className="team-header-text">
          <h2 className="team-header-name">{team.name}</h2>
          {segs.length > 0 && <p className="team-header-meta">{segs.join(' · ')}</p>}
        </div>
      </div>
      {rosterLoading && <p className="status-msg">Loading roster...</p>}
      {!rosterLoading && rosterError && (
        <p className="status-msg error">Could not load roster — try again.</p>
      )}
      {!rosterLoading && !rosterError && roster.length > 0 && (
        <RosterTable
          players={roster}
          teamName={team.name}
          onSaveDeck={onSaveDeck}
          onPlayerClick={(id) => navigate(`/player/${id}`)}
        />
      )}
      {!rosterLoading && !rosterError && roster.length === 0 && (
        <p className="status-msg">No roster data available.</p>
      )}
    </>
  );
}
