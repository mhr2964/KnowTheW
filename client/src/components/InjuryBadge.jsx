import useLazyFetch from '../hooks/useLazyFetch';
import InjuryPill from './InjuryPill';

// Player-hero wrapper around InjuryPill: fetches this one player's current status. Retired players
// never fetch (see PlayerPage.jsx -- retired is the vast majority of player-page views by count,
// and none of them can have a current BDL injury entry, so skipping the call there avoids a wasted
// request on most page loads, not just a wasted render).
export default function InjuryBadge({ playerId, retired }) {
  const { data } = useLazyFetch(`/api/players/${playerId}/injury`, !retired);
  return <InjuryPill injury={data?.injury} />;
}
