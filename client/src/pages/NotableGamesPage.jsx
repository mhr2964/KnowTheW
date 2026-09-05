import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import useLazyFetch from '../hooks/useLazyFetch';
import { setPageMeta, resetPageMeta } from '../lib/pageMeta';
import { getCurrentSeason } from '../lib/currentSeason';
import { buildTeamLogoMap } from '../lib/teamLookup';
import TeamBadge from '../components/TeamBadge';

// Notable Games is BDL-only (see server/providers/balldontlie/notableGames.js -- ESPN's
// percentile-system fetch has no per-game rows to scan pre-2008).
const NOTABLE_GAMES_MIN_SEASON = 2008;

function buildSeasonOptions() {
  const top = getCurrentSeason();
  const years = [];
  for (let y = top; y >= NOTABLE_GAMES_MIN_SEASON; y--) years.push(y);
  return years;
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function NotableGamesPage({ teams }) {
  const navigate = useNavigate();
  const [season, setSeason] = useState(getCurrentSeason());
  const [categoryKey, setCategoryKey] = useState('pts');
  const logoByAbbr = useMemo(() => buildTeamLogoMap(teams), [teams]);

  useEffect(() => {
    setPageMeta('Notable Games — KnowTheW', 'The best single-game performances of the season in points, rebounds, assists, steals, and blocks.');
    return resetPageMeta;
  }, []);

  const url = `/api/league/notable-games?season=${season}`;
  const { data, loading, error, refetch } = useLazyFetch(url, true);

  const category = data?.categories?.find(c => c.key === categoryKey);

  return (
    <>
      <h1>Notable Games</h1>
      <p className="status-msg">The top 10 single-game performances of the season. Click a row for that game&apos;s box score.</p>

      <div className="stat-season-bar" style={{ marginBottom: '0.75rem' }}>
        <select className="gl-select" value={season} onChange={e => setSeason(parseInt(e.target.value, 10))}>
          {buildSeasonOptions().map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {data?.categories && (
        <div className="stat-season-bar" style={{ marginBottom: '1rem', flexWrap: 'wrap' }}>
          {data.categories.map(c => (
            <button
              key={c.key}
              type="button"
              className={`stat-season-tab${categoryKey === c.key ? ' active' : ''}`}
              onClick={() => setCategoryKey(c.key)}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      {loading && <p className="status-msg">Loading notable games...</p>}
      {error && (
        <p className="status-msg error" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          Could not load notable games.
          <button type="button" className="btn-ghost compare-verdict-retry" onClick={refetch}>Try again</button>
        </p>
      )}
      {!loading && !error && data && category?.games.length === 0 && (
        <p className="status-msg">No qualifying games for {category.label} in {season}.</p>
      )}
      {!loading && !error && category?.games.length > 0 && (
        <div className="standings-table-wrap">
          <table className="standings-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Player</th>
                <th className="standings-col-team">Team</th>
                <th>{category.label}</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {category.games.map((row, i) => (
                <tr
                  key={`${row.playerId ?? row.name}-${row.gameId}`}
                  className="standings-row"
                  onClick={() => navigate(`/game/${row.gameId}`)}
                >
                  <td>{i + 1}</td>
                  <td>{row.name}</td>
                  <td className="standings-col-team"><TeamBadge abbr={row.teamAbbr} logoByAbbr={logoByAbbr} /></td>
                  <td>{row.value}</td>
                  <td>{formatDate(row.date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
