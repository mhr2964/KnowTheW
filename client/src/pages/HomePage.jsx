import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import RecentDecks from '../components/RecentDecks';
import { setPageMeta, resetPageMeta } from '../lib/pageMeta';

function LogoPlaceholder({ abbreviation }) {
  return (
    <svg
      className="team-logo team-logo-placeholder"
      viewBox="0 0 56 56"
      aria-hidden="true"
    >
      <circle cx="28" cy="28" r="27" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <text
        x="28"
        y="33"
        textAnchor="middle"
        fontSize="14"
        fontWeight="700"
        fill="currentColor"
        fontFamily="inherit"
      >
        {abbreviation ?? '?'}
      </text>
    </svg>
  );
}

function TeamCard({ team }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      className={`team-card${team.defunct ? ' team-card--defunct' : ''}`}
      style={{ '--team-color': `#${team.color}` }}
      onClick={() => navigate(`/team/${team.slug}`)}
    >
      {team.logo
        ? <img src={team.logo} alt={team.name} className="team-logo" />
        : <LogoPlaceholder abbreviation={team.abbreviation} />
      }
      <span className={`team-name${team.defunct ? ' team-name--defunct' : ''}`}>{team.name}</span>
      <span className="team-abbr">{team.abbreviation}</span>
      {team.defunct && (
        <span className="team-defunct-badge">{team.activeYears[0]}–{team.activeYears[1]}</span>
      )}
    </button>
  );
}

export default function HomePage({ teams, decks, onRestudy, loading, error }) {
  useEffect(() => {
    setPageMeta('KnowTheW — WNBA Stats & Analytics', 'Browse every WNBA team, roster, and player stat line — current and historical, back to the league’s 1997 founding.');
    return resetPageMeta;
  }, []);

  if (loading) return <p className="status-msg">Loading teams...</p>;
  if (error) return <p className="status-msg error">{error}</p>;

  const active = teams.filter(t => !t.defunct);
  const defunct = teams.filter(t => t.defunct);

  return (
    <>
      <RecentDecks decks={decks} onRestudy={onRestudy} />
      <h2 className="section-title">All Teams</h2>
      <div className="team-grid">
        {active.map(team => (
          <TeamCard key={team.id} team={team} />
        ))}
      </div>
      {defunct.length > 0 && (
        <>
          <h2 className="section-title">Historical Franchises</h2>
          <div className="team-grid team-grid--defunct">
            {defunct.map(team => (
              <TeamCard key={team.id} team={team} />
            ))}
          </div>
        </>
      )}
    </>
  );
}
