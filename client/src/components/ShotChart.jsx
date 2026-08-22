import { useState, useEffect } from 'react';
import TableToolbar from './TableToolbar';
import useSeasonScopedFetch from '../hooks/useSeasonScopedFetch';
import CourtDiagram, { zoneColor } from './CourtDiagram';

// A 404 means "no shot-location tracking for this player-season" -- a legitimate empty result,
// not an error (see shotChart.js's header comment on SHOT_CHART_MIN_SEASON coverage gaps).
async function parseShotChart(r) {
  if (r.status === 404) return null;
  if (!r.ok) throw new Error();
  return r.json();
}

function toCsvCell(val) {
  const s = val === null || val === undefined ? '' : String(val);
  return /["\n,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadZonesCsv(filename, zones) {
  const lines = [['Zone', 'FGM', 'FGA', 'FG%'].map(toCsvCell).join(',')];
  for (const z of zones) {
    lines.push([z.label, z.fgm, z.fga, z.fga > 0 ? (z.fgPct * 100).toFixed(1) : ''].map(toCsvCell).join(','));
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Hand-rolled SVG shot chart (no chart lib in the project, see FingerprintRadar.jsx). BDL's
// shot-location data is zone-aggregated FG% (7 real zones), NOT per-shot coordinates -- there is
// no x/y to plot, so this is a stylized half-court with each zone as a fillable region, colored by
// FG%, not a scatter/dot chart. The actual court geometry/coloring lives in CourtDiagram.jsx
// (extracted 2026-08-22 so the team-level shot chart can reuse it) -- this file is the player-page
// wrapper: season/playoffs toggle, fetch, legend table, CSV export, Study Flow handoff.

export default function ShotChart({ playerId, playerName, availableSeasons, availablePlayoffSeasons, onOpenStudy, seasonBarRef, onSeasonChange }) {
  const [season, setSeason] = useState(null);
  const [seasonType, setSeasonType] = useState('regular');
  const [hoverZone, setHoverZone] = useState(null);

  useEffect(() => {
    if (!season && availableSeasons.length > 0) setSeason(availableSeasons[0]);
  }, [season, availableSeasons]);

  function handleSeasonChange(s) {
    setSeason(s);
    setSeasonType('regular');
  }

  // The career boxscore's playoff-season list (same source DetailedStats.jsx already computes) --
  // an approximation, not shot-chart-specific coverage. A season can appear here yet still return
  // "no tracking available" below (BDL's own zone-tracking floor is 2022, narrower than career
  // stats' coverage), same graceful-empty-state the regular-season toggle already handles.
  const hasPlayoffSeason = !!availablePlayoffSeasons?.includes(season);

  // Reports up to DetailedStats' sticky-nav season indicator (see AdvancedTab for the same pattern).
  useEffect(() => {
    onSeasonChange?.(hasPlayoffSeason ? seasonType : null);
  }, [hasPlayoffSeason, seasonType, onSeasonChange]);

  const shotChartUrl = season
    ? `/api/players/${playerId}/shotchart?season=${season}&postseason=${seasonType === 'playoffs'}`
    : null;
  const { data: chart, loading, error, retry } = useSeasonScopedFetch(shotChartUrl, { parse: parseShotChart });

  // Zones are objects keyed by name (label/fgm/fga/fgPct), not BrefTable's positional-array rows --
  // studyData.js's buildStudyDeck assumes the latter, so this builds StudyFlow's {data, columns}
  // shape directly rather than forcing zone data through a column-index mapping it doesn't have.
  function openStudy() {
    if (!chart) return;
    const columns = [
      { key: 'label', label: 'Zone', type: 'text' },
      { key: 'fgm', label: 'FGM', type: 'text' },
      { key: 'fga', label: 'FGA', type: 'text' },
      { key: 'fgPct', label: 'FG%', type: 'pct' },
    ];
    const data = chart.zones.map(z => ({ label: z.label, fgm: z.fgm, fga: z.fga, fgPct: z.fga > 0 ? z.fgPct : null }));
    const suffix = seasonType === 'playoffs' ? ' (Playoffs)' : '';
    onOpenStudy?.({ data, columns, deckName: `${playerName} Shot Chart ${season}${suffix}` });
  }

  return (
    <>
      <TableToolbar
        leading={
          <>
            {hasPlayoffSeason && (
              <div className="stat-season-bar" ref={seasonBarRef}>
                <button
                  type="button"
                  className={`stat-season-tab${seasonType === 'regular' ? ' active' : ''}`}
                  onClick={() => setSeasonType('regular')}
                >
                  Regular Season
                </button>
                <button
                  type="button"
                  className={`stat-season-tab${seasonType === 'playoffs' ? ' active' : ''}`}
                  onClick={() => setSeasonType('playoffs')}
                >
                  Playoffs
                </button>
              </div>
            )}
            {availableSeasons.length > 1 && (
              <select className="gl-select" value={season ?? ''} onChange={e => handleSeasonChange(e.target.value)}>
                {availableSeasons.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
          </>
        }
        showStudy={!!chart}
        onStudy={openStudy}
        showExport={!!chart}
        onExport={() => downloadZonesCsv(`${playerName}-shotchart-${season}${seasonType === 'playoffs' ? '-playoffs' : ''}.csv`, chart.zones)}
      />

      {loading && <p className="status-msg" style={{ padding: '1rem 0' }}>Loading shot chart…</p>}
      {error && (
        <p className="status-msg error" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          Could not load shot chart.
          <button type="button" className="btn-ghost compare-verdict-retry" onClick={retry}>Try again</button>
        </p>
      )}
      {!loading && !error && !chart && (
        <p className="status-msg">No shot-location tracking available for this season.</p>
      )}
      {!loading && !error && chart && (
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
      )}
    </>
  );
}
