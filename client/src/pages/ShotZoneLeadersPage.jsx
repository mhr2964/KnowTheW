import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useLazyFetch from '../hooks/useLazyFetch';
import { setPageMeta, resetPageMeta } from '../lib/pageMeta';
import { getCurrentSeason } from '../lib/currentSeason';

// Same 2022 floor as the player/team shot charts -- BDL's zone tracking doesn't exist before this.
const SHOT_CHART_MIN_SEASON = 2022;

function buildSeasonOptions() {
  const top = getCurrentSeason();
  const years = [];
  for (let y = top; y >= SHOT_CHART_MIN_SEASON; y--) years.push(y);
  return years;
}

export default function ShotZoneLeadersPage() {
  const navigate = useNavigate();
  const [season, setSeason] = useState(getCurrentSeason());
  const [postseason, setPostseason] = useState(false);
  const [zoneKey, setZoneKey] = useState('restricted_area');

  useEffect(() => {
    setPageMeta('Shot Zone Leaders — KnowTheW', 'League leaders by field goal percentage in each court shot zone, by season.');
    return resetPageMeta;
  }, []);

  const url = `/api/league/shot-zone-leaders?season=${season}&postseason=${postseason}`;
  const { data, loading, error, refetch } = useLazyFetch(url, true);

  const zone = data?.zones?.find(z => z.key === zoneKey);

  return (
    <>
      <h1>Shot Zone Leaders</h1>

      <div className="stat-season-bar" style={{ marginBottom: '0.75rem' }}>
        <select className="gl-select" value={season} onChange={e => setSeason(parseInt(e.target.value, 10))}>
          {buildSeasonOptions().map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <button
          type="button"
          className={`stat-season-tab${!postseason ? ' active' : ''}`}
          onClick={() => setPostseason(false)}
        >
          Regular Season
        </button>
        <button
          type="button"
          className={`stat-season-tab${postseason ? ' active' : ''}`}
          onClick={() => setPostseason(true)}
        >
          Playoffs
        </button>
      </div>

      {data?.zones && (
        <div className="stat-season-bar" style={{ marginBottom: '1rem', flexWrap: 'wrap' }}>
          {data.zones.map(z => (
            <button
              key={z.key}
              type="button"
              className={`stat-season-tab${zoneKey === z.key ? ' active' : ''}`}
              onClick={() => setZoneKey(z.key)}
            >
              {z.label}
            </button>
          ))}
        </div>
      )}

      {loading && <p className="status-msg">Loading leaders...</p>}
      {error && (
        <p className="status-msg error" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          Could not load shot zone leaders.
          <button type="button" className="btn-ghost compare-verdict-retry" onClick={refetch}>Try again</button>
        </p>
      )}
      {!loading && !error && data && zone?.leaders.length === 0 && (
        <p className="status-msg">No qualifying leaders for {zone.label} in {season}.</p>
      )}
      {!loading && !error && zone?.leaders.length > 0 && (
        <div className="standings-table-wrap">
          <table className="standings-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Player</th>
                <th>Team</th>
                <th>FGM-FGA</th>
                <th>FG%</th>
              </tr>
            </thead>
            <tbody>
              {zone.leaders.map((row, i) => (
                <tr
                  key={row.bdlPlayerId}
                  className="standings-row"
                  onClick={() => row.playerId != null && navigate(`/player/${row.playerId}`)}
                >
                  <td>{i + 1}</td>
                  <td>{row.name}</td>
                  <td>{row.teamAbbr ?? '—'}</td>
                  <td>{row.fgm}-{row.fga}</td>
                  <td>{(row.fgPct * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
