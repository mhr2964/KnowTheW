// Leaderboard rank number -- a colored circle badge for the top 3 (standard leaderboard
// convention), a plain number otherwise. Shared by every page.jsx that renders a ranked top-N
// table (League Leaders, Notable Games, All-Time Leaders) so the treatment stays identical.
export default function RankBadge({ rank }) {
  if (rank > 3) return rank;
  return <span className={`leaderboard-rank leaderboard-rank--${rank}`}>{rank}</span>;
}
