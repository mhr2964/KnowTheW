import { useNavigate } from 'react-router-dom';
import RecentDecks from '../components/RecentDecks';
import PremiumBanner from '../components/PremiumBanner';

function TeamCard({ team }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      className="team-card"
      style={{ '--team-color': `#${team.color}` }}
      onClick={() => navigate(`/team/${team.slug}`)}
    >
      {team.logo && <img src={team.logo} alt={team.name} className="team-logo" />}
      <span className="team-name">{team.name}</span>
      <span className="team-abbr">{team.abbreviation}</span>
    </button>
  );
}

export default function HomePage({ teams, decks, onRestudy, loading, error }) {
  if (loading) return <p className="status-msg">Loading teams...</p>;
  if (error) return <p className="status-msg error">{error}</p>;

  return (
    <>
      <RecentDecks decks={decks} onRestudy={onRestudy} />
      <h2 className="section-title">All Teams</h2>
      <div className="team-grid">
        {teams.map(team => (
          <TeamCard key={team.id} team={team} />
        ))}
      </div>
      <PremiumBanner />
    </>
  );
}
