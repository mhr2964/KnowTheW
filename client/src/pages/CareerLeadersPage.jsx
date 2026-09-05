import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useLazyFetch from '../hooks/useLazyFetch';
import { setPageMeta, resetPageMeta } from '../lib/pageMeta';

export default function CareerLeadersPage() {
  const navigate = useNavigate();
  const [categoryKey, setCategoryKey] = useState('PTS');

  useEffect(() => {
    setPageMeta('All-Time Leaders — KnowTheW', 'Career leaders in points, rebounds, assists, steals, and blocks, 2002-present.');
    return resetPageMeta;
  }, []);

  const { data, loading, error, refetch } = useLazyFetch('/api/league/career-leaders', true);

  const category = data?.categories?.find(c => c.key === categoryKey);

  return (
    <>
      <h1>All-Time Leaders</h1>
      <p className="status-msg">Career totals, 2002–present (the earliest season with full league-wide stats).</p>

      {data?.categories && (
        <div className="stat-season-bar" style={{ margin: '1rem 0', flexWrap: 'wrap' }}>
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

      {loading && <p className="status-msg">Loading all-time leaders (this can take a while on a cold cache)...</p>}
      {error && (
        <p className="status-msg error" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          Could not load all-time leaders.
          <button type="button" className="btn-ghost compare-verdict-retry" onClick={refetch}>Try again</button>
        </p>
      )}
      {!loading && !error && category?.leaders.length > 0 && (
        <div className="standings-table-wrap">
          <table className="standings-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Player</th>
                <th>Team</th>
                <th>Seasons</th>
                <th>{category.label}</th>
              </tr>
            </thead>
            <tbody>
              {category.leaders.map((row, i) => (
                <tr
                  key={row.playerId ?? row.name}
                  className="standings-row"
                  onClick={() => row.playerId != null && navigate(`/player/${row.playerId}`)}
                >
                  <td>{i + 1}</td>
                  <td>{row.name}</td>
                  <td>{row.teamAbbr ?? '—'}</td>
                  <td>{row.seasons}</td>
                  <td>{row.value.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
