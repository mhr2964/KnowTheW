import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useLazyFetch from '../hooks/useLazyFetch';
import { setPageMeta, resetPageMeta } from '../lib/pageMeta';
import { fmt } from '../components/BrefTable';

function formatDateTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function TeamBox({ label, rows, teamTotals, navigate }) {
  return (
    <div className="standings-group">
      <h3>{label}</h3>
      <div className="standings-table-wrap">
        <table className="standings-table">
          <thead>
            <tr>
              <th>Player</th>
              <th>MIN</th>
              <th>PTS</th>
              <th>REB</th>
              <th>AST</th>
              <th>STL</th>
              <th>BLK</th>
              <th>TOV</th>
              <th>PF</th>
              <th>FG</th>
              <th>3P</th>
              <th>FT</th>
              <th>+/-</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr
                key={row.name}
                className="standings-row"
                onClick={() => row.playerId != null && navigate(`/player/${row.playerId}`)}
              >
                <td>{row.name}</td>
                <td>{row.minutes}</td>
                <td>{row.points}</td>
                <td>{row.rebounds}</td>
                <td>{row.assists}</td>
                <td>{row.steals}</td>
                <td>{row.blocks}</td>
                <td>{row.turnovers}</td>
                <td>{row.fouls}</td>
                <td>{row.fgm}-{row.fga}</td>
                <td>{row.fg3m}-{row.fg3a}</td>
                <td>{row.ftm}-{row.fta}</td>
                <td>{fmt('signed', row.plusMinus)}</td>
              </tr>
            ))}
            {teamTotals && (
              <tr className="standings-row" style={{ cursor: 'default', fontWeight: 700 }}>
                <td>Team</td>
                <td>—</td>
                <td>{teamTotals.points}</td>
                <td>{teamTotals.reb}</td>
                <td>{teamTotals.ast}</td>
                <td>{teamTotals.stl}</td>
                <td>{teamTotals.blk}</td>
                <td>{teamTotals.turnovers}</td>
                <td>{teamTotals.fouls}</td>
                <td>{teamTotals.fgm}-{teamTotals.fga}</td>
                <td>{teamTotals.fg3m}-{teamTotals.fg3a}</td>
                <td>{teamTotals.ftm}-{teamTotals.fta}</td>
                <td>—</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function GameBoxScorePage() {
  const { id } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    setPageMeta('Box Score — KnowTheW', 'Full WNBA game box score: final score, quarter-by-quarter breakdown, and both teams’ player stat lines.');
    return resetPageMeta;
  }, []);

  const { data, loading, error, refetch } = useLazyFetch(`/api/games/${id}`, true);

  function handleBack() {
    if (window.history.state?.idx > 0) navigate(-1);
    else navigate('/');
  }

  return (
    <>
      <button type="button" className="back-btn" onClick={handleBack}>← Back</button>

      {loading && <p className="status-msg">Loading box score...</p>}
      {error && (
        <p className="status-msg error" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          Could not load this box score.
          <button type="button" className="btn-ghost compare-verdict-retry" onClick={refetch}>Try again</button>
        </p>
      )}
      {!loading && !error && data && (
        <>
          <h1>{data.game.away.abbreviation} @ {data.game.home.abbreviation}</h1>
          <p className="status-msg">{formatDateTime(data.game.date)}</p>

          <div className="standings-table-wrap" style={{ marginBottom: '1.5rem' }}>
            <table className="standings-table">
              <thead>
                <tr>
                  <th>Team</th>
                  {data.quarterScores.map(q => <th key={q.period}>{q.period <= 4 ? `Q${q.period}` : `OT${q.period - 4}`}</th>)}
                  <th>Final</th>
                </tr>
              </thead>
              <tbody>
                <tr className="standings-row" style={{ cursor: 'default' }}>
                  <td>{data.game.away.abbreviation}</td>
                  {data.quarterScores.map(q => <td key={q.period}>{q.away}</td>)}
                  <td style={{ fontWeight: 700 }}>{data.game.away.score}</td>
                </tr>
                <tr className="standings-row" style={{ cursor: 'default' }}>
                  <td>{data.game.home.abbreviation}</td>
                  {data.quarterScores.map(q => <td key={q.period}>{q.home}</td>)}
                  <td style={{ fontWeight: 700 }}>{data.game.home.score}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <TeamBox label={data.game.away.abbreviation} rows={data.boxScores.away} teamTotals={data.teamTotals.away} navigate={navigate} />
          <TeamBox label={data.game.home.abbreviation} rows={data.boxScores.home} teamTotals={data.teamTotals.home} navigate={navigate} />
        </>
      )}
    </>
  );
}
