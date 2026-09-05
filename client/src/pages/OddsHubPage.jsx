import { useEffect, useMemo } from 'react';
import useLazyFetch from '../hooks/useLazyFetch';
import { setPageMeta, resetPageMeta } from '../lib/pageMeta';
import { buildTeamLogoMap } from '../lib/teamLookup';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDate(iso) {
  const d = new Date(iso);
  return `${DAY_NAMES[d.getDay()]} ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
}

function formatTime(iso) {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
}

// Home team's own spread value, signed (matches sports convention -- a line is quoted from the
// home team's side). Not oriented per-team like gameOdds.js's orientOddsForTeam -- this hub shows
// both sides of the same matchup in one row, so raw {home,away} is the right shape as-is.
function formatSpread(spread) {
  if (spread?.home == null) return '—';
  return Number(spread.home) > 0 ? `+${spread.home}` : String(spread.home);
}

export default function OddsHubPage({ teams }) {
  useEffect(() => {
    setPageMeta('Odds — KnowTheW', 'Upcoming WNBA game lines: spread and over/under, one representative sportsbook per game.');
    return resetPageMeta;
  }, []);

  const { data, loading, error, refetch } = useLazyFetch('/api/league/odds', true);
  const logoByAbbr = useMemo(() => buildTeamLogoMap(teams), [teams]);

  return (
    <>
      <h1>Odds</h1>
      <p className="status-msg">Upcoming games in the next 7 days, with the line from one representative sportsbook.</p>

      {loading && <p className="status-msg">Loading odds...</p>}
      {error && (
        <p className="status-msg error" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          Could not load odds.
          <button type="button" className="btn-ghost compare-verdict-retry" onClick={refetch}>Try again</button>
        </p>
      )}
      {!loading && !error && data?.length === 0 && (
        <p className="status-msg">No upcoming games in the next week.</p>
      )}
      {!loading && !error && data?.length > 0 && (
        <div className="standings-table-wrap">
          <table className="standings-table">
            <thead>
              <tr>
                <th>Date</th>
                <th className="standings-col-team">Matchup</th>
                <th>Line (Home)</th>
                <th>O/U</th>
              </tr>
            </thead>
            <tbody>
              {data.map(game => (
                <tr key={game.gameId}>
                  <td>{formatDate(game.date)} {formatTime(game.date)}</td>
                  <td className="standings-col-team odds-matchup">
                    {logoByAbbr.get(game.away.abbreviation) && <img src={logoByAbbr.get(game.away.abbreviation)} alt="" className="standings-team-logo" />}
                    <span>{game.away.abbreviation}</span>
                    <span className="odds-matchup-at">@</span>
                    {logoByAbbr.get(game.home.abbreviation) && <img src={logoByAbbr.get(game.home.abbreviation)} alt="" className="standings-team-logo" />}
                    <span>{game.home.abbreviation}</span>
                  </td>
                  <td title={game.odds ? `Odds via ${game.odds.vendor}` : undefined}>
                    {game.odds ? formatSpread(game.odds.spread) : '—'}
                  </td>
                  <td title={game.odds ? `Odds via ${game.odds.vendor}` : undefined}>
                    {game.odds?.total?.value != null ? game.odds.total.value : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
