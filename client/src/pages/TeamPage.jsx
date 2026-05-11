import { useEffect } from 'react';
import { useParams, useNavigate, useLocation, NavLink, Outlet, useSearchParams } from 'react-router-dom';
import { getCurrentSeason } from '../lib/currentSeason';
import { WNBA_FOUNDED_CLIENT } from '../constants/wnbaFoundedClient';
import SeasonPicker from '../components/SeasonPicker';

export default function TeamPage({ teams, teamsLoading, teamsError, onSaveDeck }) {
  const { slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const team = teams.find(t => t.slug === slug) ?? null;

  useEffect(() => {
    if (team) document.title = `${team.name} — KnowTheW`;
    return () => { document.title = 'KnowTheW'; };
  }, [team]);

  if (teamsLoading) return <p className="status-msg">Loading teams...</p>;
  if (teamsError) return <p className="status-msg error">{teamsError}</p>;
  if (!team) return <p className="status-msg">Team not found.</p>;

  const currentSeason = getCurrentSeason();
  const foundedYear = WNBA_FOUNDED_CLIENT[team.id] ?? 1997;
  const rawSeasonStr = searchParams.get('season');
  const isWellFormed = rawSeasonStr !== null && /^\d{4}$/.test(rawSeasonStr);
  const rawSeason = isWellFormed ? parseInt(rawSeasonStr, 10) : NaN;
  const isValidSeason = Number.isFinite(rawSeason) && rawSeason >= foundedYear && rawSeason <= currentSeason;
  const selectedSeason = isValidSeason ? rawSeason : currentSeason;
  const isCurrentSeason = selectedSeason === currentSeason;

  const onPickerChange = (year) => {
    if (year === currentSeason) {
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        next.delete('season');
        return next;
      });
    } else {
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        next.set('season', String(year));
        return next;
      });
    }
  };

  const isHistoryTab = location.pathname.endsWith('/history');
  const searchSuffix = searchParams.toString() ? `?${searchParams.toString()}` : '';

  const seedAndConf = [team.seedLabel && `${team.seedLabel} in`, team.conference]
    .filter(Boolean).join(' ');
  const segs = [team.record, seedAndConf, team.location].filter(Boolean);

  // Sub-pages go back one level to the team Dashboard; the Dashboard itself goes back to All Teams.
  const onDashboard = location.pathname === `/team/${slug}` || location.pathname === `/team/${slug}/`;
  const backLabel = onDashboard ? '← All Teams' : `← ${team.name}`;
  const backTarget = onDashboard ? '/' : `/team/${slug}`;

  return (
    <>
      <button type="button" className="back-btn" onClick={() => navigate(backTarget)}>{backLabel}</button>
      <div className="team-header" style={{ '--team-color': `#${team.color}` }}>
        {team.logo && (
          <img src={team.logo} alt={team.name} className="team-header-logo" />
        )}
        <div className="team-header-text">
          <h2 className="team-header-name">{team.name}</h2>
          {segs.length > 0 && <p className="team-header-meta">{segs.join(' · ')}</p>}
        </div>
        <SeasonPicker
          value={isHistoryTab ? currentSeason : selectedSeason}
          onChange={onPickerChange}
          foundedYear={foundedYear}
          disabled={isHistoryTab}
        />
      </div>
      <nav className="team-spoke-nav">
        <NavLink to={`/team/${slug}${searchSuffix}`} end className={({ isActive }) => isActive ? 'team-spoke-tab active' : 'team-spoke-tab'}>Dashboard</NavLink>
        <NavLink to={`/team/${slug}/roster${searchSuffix}`} className={({ isActive }) => isActive ? 'team-spoke-tab active' : 'team-spoke-tab'}>Roster</NavLink>
        <NavLink to={`/team/${slug}/stats${searchSuffix}`} className={({ isActive }) => isActive ? 'team-spoke-tab active' : 'team-spoke-tab'}>Stats</NavLink>
        <NavLink to={`/team/${slug}/history${searchSuffix}`} className={({ isActive }) => isActive ? 'team-spoke-tab active' : 'team-spoke-tab'}>History</NavLink>
        <NavLink to={`/team/${slug}/schedule${searchSuffix}`} className={({ isActive }) => isActive ? 'team-spoke-tab active' : 'team-spoke-tab'}>Schedule</NavLink>
      </nav>
      <Outlet context={{ team, onSaveDeck, season: selectedSeason, isCurrentSeason }} />
    </>
  );
}
