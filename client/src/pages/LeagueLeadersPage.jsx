import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useLazyFetch from '../hooks/useLazyFetch';
import { setPageMeta, resetPageMeta } from '../lib/pageMeta';
import { getCurrentSeason } from '../lib/currentSeason';

// ESPN's byathlete league-stats feed (this page's data source for seasons before BDL takes over)
// only goes back to 2002 -- see docs/design/design.md's data-sources note (1997-2001 is a separate
// bulk-legacy dataset with no league-wide leaderboard view).
const LEADERS_MIN_SEASON = 2002;

const PCT_KEYS = new Set(['FG_PCT', 'FG3_PCT', 'FT_PCT']);

function buildSeasonOptions() {
  const top = getCurrentSeason();
  const years = [];
  for (let y = top; y >= LEADERS_MIN_SEASON; y--) years.push(y);
  return years;
}

function formatValue(key, value) {
  return PCT_KEYS.has(key) ? `${(value * 100).toFixed(1)}%` : value.toFixed(1);
}

export default function LeagueLeadersPage() {
  const navigate = useNavigate();
  const [season, setSeason] = useState(getCurrentSeason());
  const [mode, setMode] = useState('PerGame');
  const [categoryKey, setCategoryKey] = useState('PTS');

  useEffect(() => {
    setPageMeta('League Leaders — KnowTheW', 'League leaders in points, rebounds, assists, steals, blocks, and shooting percentages, by season.');
    return resetPageMeta;
  }, []);

  const url = `/api/league/leaders?season=${season}&mode=${mode}`;
  const { data, loading, error, refetch } = useLazyFetch(url, true);

  const category = data?.categories?.find(c => c.key === categoryKey);

  return (
    <>
      <h1>League Leaders</h1>

      <div className="stat-season-bar" style={{ marginBottom: '0.75rem' }}>
        <select className="gl-select" value={season} onChange={e => setSeason(parseInt(e.target.value, 10))}>
          {buildSeasonOptions().map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <button
          type="button"
          className={`stat-season-tab${mode === 'PerGame' ? ' active' : ''}`}
          onClick={() => setMode('PerGame')}
        >
          Per Game
        </button>
        <button
          type="button"
          className={`stat-season-tab${mode === 'Totals' ? ' active' : ''}`}
          onClick={() => setMode('Totals')}
        >
          Totals
        </button>
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

      {loading && <p className="status-msg">Loading leaders...</p>}
      {error && (
        <p className="status-msg error" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          Could not load league leaders.
          <button type="button" className="btn-ghost compare-verdict-retry" onClick={refetch}>Try again</button>
        </p>
      )}
      {!loading && !error && data && category?.leaders.length === 0 && (
        <p className="status-msg">No qualifying leaders for {category.label} in {season}.</p>
      )}
      {!loading && !error && category?.leaders.length > 0 && (
        <div className="standings-table-wrap">
          <table className="standings-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Player</th>
                <th>Team</th>
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
                  <td>{formatValue(category.key, row.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
