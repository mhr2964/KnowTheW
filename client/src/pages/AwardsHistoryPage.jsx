import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useLazyFetch from '../hooks/useLazyFetch';
import { setPageMeta, resetPageMeta } from '../lib/pageMeta';

function PlayerCell({ entry, navigate }) {
  if (!entry) return <td>—</td>;
  return (
    <td
      className={entry.playerId != null ? 'awards-player-link' : ''}
      onClick={() => entry.playerId != null && navigate(`/player/${entry.playerId}`)}
    >
      {entry.name}
    </td>
  );
}

export default function AwardsHistoryPage() {
  const navigate = useNavigate();

  useEffect(() => {
    setPageMeta('Awards History — KnowTheW', 'WNBA MVP, Finals MVP, Defensive Player of the Year, Rookie of the Year, Sixth Player, and All-WNBA First Team winners, 1997-present.');
    return resetPageMeta;
  }, []);

  const { data, loading, error, refetch } = useLazyFetch('/api/league/awards', true);

  return (
    <>
      <h1>Awards History</h1>

      {loading && <p className="status-msg">Loading awards history...</p>}
      {error && (
        <p className="status-msg error" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          Could not load awards history.
          <button type="button" className="btn-ghost compare-verdict-retry" onClick={refetch}>Try again</button>
        </p>
      )}
      {!loading && !error && data && (
        <div className="standings-table-wrap">
          <table className="standings-table">
            <thead>
              <tr>
                <th>Year</th>
                <th>MVP</th>
                <th>Finals MVP</th>
                <th>Defensive POY</th>
                <th>Rookie of the Year</th>
                <th>Sixth Player</th>
                <th>All-WNBA First Team</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map(row => (
                <tr key={row.year}>
                  <td>{row.year}</td>
                  <PlayerCell entry={row.mvp} navigate={navigate} />
                  <PlayerCell entry={row.finalsMvp} navigate={navigate} />
                  <PlayerCell entry={row.dpoy} navigate={navigate} />
                  <PlayerCell entry={row.roy} navigate={navigate} />
                  <PlayerCell entry={row.sixth} navigate={navigate} />
                  <td>
                    {row.allWnbaFirst.length === 0
                      ? '—'
                      : row.allWnbaFirst.map((entry, i) => (
                        <span key={entry.name}>
                          <span
                            className={entry.playerId != null ? 'awards-player-link' : ''}
                            onClick={() => entry.playerId != null && navigate(`/player/${entry.playerId}`)}
                          >
                            {entry.name}
                          </span>
                          {i < row.allWnbaFirst.length - 1 ? ', ' : ''}
                        </span>
                      ))}
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
