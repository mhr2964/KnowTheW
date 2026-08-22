import { useState, useEffect } from 'react';
import CourtDiagram, { zoneColor } from './CourtDiagram';

// Team-level shot chart -- see providers/balldontlie/teamShotChart.js. Two framings from one fetch:
// "own" (where this team shoots from) and "opponent" (opponent zone FG% while facing this team --
// the defensive-tendency framing the roadmap flagged as the more novel one, since nothing else on
// the site surfaces this). A toggle switches which side is drawn; both are already in hand from the
// single /teams/:id/shotchart fetch, so switching is a local state flip, not a refetch -- same
// pattern as the player Shot Chart's Regular/Playoffs toggle.
const SIDES = [
  { key: 'own', label: 'Team Shooting' },
  { key: 'opponent', label: 'Opponent Shooting (Allowed)' },
];

export default function TeamShotChart({ teamId, season }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [side, setSide] = useState('own');
  const [hoverZone, setHoverZone] = useState(null);

  useEffect(() => {
    if (!teamId) return;
    const controller = new AbortController();
    setData(null);
    setError(false);
    setLoading(true);
    fetch(`/api/teams/${teamId}/shotchart?season=${season}`, { signal: controller.signal })
      .then(r => {
        if (r.status === 404) return null;
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(d => { setData(d); setLoading(false); })
      .catch(err => {
        if (err.name !== 'AbortError') {
          setError(true);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [teamId, season]);

  if (loading) return <p className="status-msg" style={{ padding: '1rem 0' }}>Loading shot chart…</p>;
  if (error) return <p className="status-msg error">Could not load shot chart.</p>;
  if (!data) return null;

  const chart = data[side];
  if (!chart) return null;

  return (
    <div className="team-stats-group">
      <h4 className="team-stats-group-label">Shot Chart</h4>
      <div className="stat-season-bar" style={{ marginBottom: '0.75rem' }}>
        {SIDES.map(s => (
          <button
            key={s.key}
            type="button"
            className={`stat-season-tab${side === s.key ? ' active' : ''}`}
            onClick={() => setSide(s.key)}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="shot-chart-wrap">
        <CourtDiagram zones={chart.zones} onHover={setHoverZone} />
        <table className="shot-chart-legend">
          <caption className="sr-only">Shooting percentage by court zone</caption>
          <thead>
            <tr><th>Zone</th><th>FGM-FGA</th><th>FG%</th></tr>
          </thead>
          <tbody>
            {chart.zones.map(z => (
              <tr key={z.key} className={hoverZone?.key === z.key ? 'shot-chart-legend-active' : undefined}>
                <td><span className="legend-dot" style={{ background: zoneColor(z.fga, z.fgPct, z.leagueAvgPct) }} />{z.label}</td>
                <td>{z.fgm}-{z.fga}</td>
                <td>{z.fga > 0 ? `${(z.fgPct * 100).toFixed(1)}%` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
