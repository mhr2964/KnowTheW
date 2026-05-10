import { useEffect } from 'react';
import { useParams, useNavigate, NavLink, Outlet } from 'react-router-dom';

export default function TeamPage({ teams, teamsLoading, teamsError, onSaveDeck }) {
  const { slug } = useParams();
  const navigate = useNavigate();

  const team = teams.find(t => t.slug === slug) ?? null;

  useEffect(() => {
    if (team) document.title = `${team.name} — KnowTheW`;
    return () => { document.title = 'KnowTheW'; };
  }, [team]);

  if (teamsLoading) return <p className="status-msg">Loading teams...</p>;
  if (teamsError) return <p className="status-msg error">{teamsError}</p>;
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
      <nav className="team-spoke-nav">
        <NavLink to={`/team/${slug}`} end className={({ isActive }) => isActive ? 'team-spoke-tab active' : 'team-spoke-tab'}>Dashboard</NavLink>
        <NavLink to={`/team/${slug}/roster`} className={({ isActive }) => isActive ? 'team-spoke-tab active' : 'team-spoke-tab'}>Roster</NavLink>
        <NavLink to={`/team/${slug}/stats`} className={({ isActive }) => isActive ? 'team-spoke-tab active' : 'team-spoke-tab'}>Stats</NavLink>
        <NavLink to={`/team/${slug}/history`} className={({ isActive }) => isActive ? 'team-spoke-tab active' : 'team-spoke-tab'}>History</NavLink>
      </nav>
      <Outlet context={{ team, onSaveDeck }} />
    </>
  );
}
