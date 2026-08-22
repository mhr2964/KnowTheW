import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useLazyFetch from '../hooks/useLazyFetch';
import { setPageMeta, resetPageMeta } from '../lib/pageMeta';

// By-conference: seed already encodes BDL's own tiebreak logic (win% alone can disagree with
// conference record/head-to-head), so ranking within a conference re-sorts on the number the seed
// column itself shows, not a re-derived one.
function sortBySeed(rows) {
  return [...rows].sort((a, b) => (a.playoffSeed ?? 99) - (b.playoffSeed ?? 99));
}

// Combined: seed is conference-scoped (two different teams both show "1"), so ranking across every
// team needs its own ordering -- win% descending, wins as the tiebreak. This is a real-terms
// re-ranking, not just a relabeling of the same order two conferences happen to share.
function sortByWinPct(rows) {
  return [...rows].sort((a, b) => (b.winPct ?? -1) - (a.winPct ?? -1) || (b.wins ?? 0) - (a.wins ?? 0));
}

// `rank` is precomputed by the caller (playoff seed for by-conference, 1-based overall position
// for combined) rather than derived in here, since the two modes number teams on entirely different
// bases. `showConference` swaps the Seed column's neighbor for a Conf column when conference
// grouping itself isn't providing that context (combined mode only).
function StandingsTable({ title, rows, showConference }) {
  const navigate = useNavigate();
  return (
    <div className="standings-group">
      <h2 className="section-title">{title}</h2>
      <div className="standings-table-wrap">
        <table className="standings-table">
          <thead>
            <tr>
              <th className="standings-col-seed">{showConference ? 'Rank' : 'Seed'}</th>
              <th className="standings-col-team">Team</th>
              {showConference && <th className="standings-col-split">Conf</th>}
              <th>W</th>
              <th>L</th>
              <th>PCT</th>
              {!showConference && <th>GB</th>}
              <th className="standings-col-split">Home</th>
              <th className="standings-col-split">Away</th>
              {!showConference && <th className="standings-col-split">Conf</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr
                key={row.teamId}
                className="standings-row"
                onClick={() => row.slug && navigate(`/team/${row.slug}`)}
              >
                <td className="standings-col-seed">{row.rank ?? '—'}</td>
                <td className="standings-col-team">
                  {row.logo && <img src={row.logo} alt="" className="standings-team-logo" />}
                  <span>{row.name ?? row.abbreviation ?? '—'}</span>
                </td>
                {showConference && (
                  <td className="standings-col-split">{row.conference?.replace(' Conference', '') ?? '—'}</td>
                )}
                <td>{row.wins ?? '—'}</td>
                <td>{row.losses ?? '—'}</td>
                <td>{row.winPct != null ? row.winPct.toFixed(3).replace(/^0\./, '.') : '—'}</td>
                {!showConference && <td>{row.gamesBehind ?? '—'}</td>}
                <td className="standings-col-split">{row.homeRecord ?? '—'}</td>
                <td className="standings-col-split">{row.awayRecord ?? '—'}</td>
                {!showConference && <td className="standings-col-split">{row.conferenceRecord ?? '—'}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const CONFERENCE_ORDER = ['Eastern Conference', 'Western Conference'];

function groupByConference(data) {
  const byConference = new Map();
  for (const row of data) {
    const key = row.conference ?? 'Other';
    if (!byConference.has(key)) byConference.set(key, []);
    byConference.get(key).push(row);
  }
  const conferences = [...byConference.keys()].sort((a, b) => {
    const ia = CONFERENCE_ORDER.indexOf(a), ib = CONFERENCE_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
  return conferences.map(conf => ({
    conference: conf,
    rows: sortBySeed(byConference.get(conf)).map(row => ({ ...row, rank: row.playoffSeed })),
  }));
}

export default function StandingsPage() {
  const { data, loading, error, refetch } = useLazyFetch('/api/standings', true);
  const [viewMode, setViewMode] = useState('conference');

  useEffect(() => {
    setPageMeta('Standings — KnowTheW', 'Current WNBA standings by conference — wins, losses, games behind, and playoff seed.');
    return resetPageMeta;
  }, []);

  if (loading || !data) return <p className="status-msg">Loading standings...</p>;
  if (error) return (
    <p className="status-msg error" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      Could not load standings.
      <button type="button" className="btn-ghost compare-verdict-retry" onClick={refetch}>Try again</button>
    </p>
  );

  const conferenceGroups = viewMode === 'conference' ? groupByConference(data) : null;
  const combinedRows = viewMode === 'combined'
    ? sortByWinPct(data).map((row, i) => ({ ...row, rank: i + 1 }))
    : null;

  return (
    <>
      <h1>Standings</h1>
      <div className="stat-season-bar standings-view-toggle">
        <button
          type="button"
          className={`stat-season-tab${viewMode === 'conference' ? ' active' : ''}`}
          onClick={() => setViewMode('conference')}
        >
          By Conference
        </button>
        <button
          type="button"
          className={`stat-season-tab${viewMode === 'combined' ? ' active' : ''}`}
          onClick={() => setViewMode('combined')}
        >
          Combined
        </button>
      </div>
      {viewMode === 'conference'
        ? conferenceGroups.map(g => <StandingsTable key={g.conference} title={g.conference} rows={g.rows} showConference={false} />)
        : <StandingsTable title="All Teams" rows={combinedRows} showConference />}
    </>
  );
}
