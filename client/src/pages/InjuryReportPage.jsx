import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useLazyFetch from '../hooks/useLazyFetch';
import { setPageMeta, resetPageMeta } from '../lib/pageMeta';
import InjuryPill from '../components/InjuryPill';

export default function InjuryReportPage() {
  const navigate = useNavigate();

  useEffect(() => {
    setPageMeta('Injury Report — KnowTheW', 'Current WNBA player injuries league-wide, with status and estimated return.');
    return resetPageMeta;
  }, []);

  const { data, loading, error, refetch } = useLazyFetch('/api/league/injuries', true);

  return (
    <>
      <h1>Injury Report</h1>

      {loading && <p className="status-msg">Loading injury report...</p>}
      {error && (
        <p className="status-msg error" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          Could not load the injury report.
          <button type="button" className="btn-ghost compare-verdict-retry" onClick={refetch}>Try again</button>
        </p>
      )}
      {!loading && !error && data?.length === 0 && (
        <p className="status-msg">No current injuries reported league-wide.</p>
      )}
      {!loading && !error && data?.length > 0 && (
        <div className="standings-table-wrap">
          <table className="standings-table">
            <thead>
              <tr>
                <th>Player</th>
                <th>Team</th>
                <th>Status</th>
                <th>Est. Return</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {data.map(row => (
                <tr
                  key={`${row.playerName}-${row.teamAbbr}`}
                  className="standings-row"
                  onClick={() => row.playerId != null && navigate(`/player/${row.playerId}`)}
                >
                  <td>{row.playerName}</td>
                  <td>{row.teamAbbr ?? '—'}</td>
                  <td><InjuryPill injury={row} /></td>
                  <td>{row.returnDate ?? '—'}</td>
                  <td className="injury-report-comment">{row.comment ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
