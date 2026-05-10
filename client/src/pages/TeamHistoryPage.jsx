import { useOutletContext } from 'react-router-dom';

export default function TeamHistoryPage() {
  const { team } = useOutletContext() ?? {};

  return (
    <div className="team-coming-soon">
      <h3 className="team-coming-soon-heading">Team History</h3>
      <p className="team-coming-soon-label">Coming Soon</p>
      <p className="team-coming-soon-desc">{team.name} franchise history — season-by-season records, championships, and AI franchise narrative.</p>
    </div>
  );
}
