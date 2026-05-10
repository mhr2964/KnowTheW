import { useOutletContext } from 'react-router-dom';

export default function TeamStatsPage() {
  const { team } = useOutletContext() ?? {};

  return (
    <div className="team-coming-soon">
      <h3 className="team-coming-soon-heading">Team Stats</h3>
      <p className="team-coming-soon-label">Coming Soon</p>
      <p className="team-coming-soon-desc">{team.name} team stats — points per game, opponent points, three-point pace and more.</p>
    </div>
  );
}
