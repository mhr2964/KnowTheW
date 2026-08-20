import { useState, useEffect } from 'react';
import useSeasonScopedFetch from '../hooks/useSeasonScopedFetch';

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
// FG%, not a scatter/dot chart. Geometry is illustrative (WNBA-proportioned but hand-placed, not
// pulled from a regulation-court spec) -- the point is the shape/color reading correctly, not
// millimeter accuracy.
//
// Layering trick instead of path-boolean subtraction: zones are drawn widest-first, most specific
// last, so each smaller shape visually overwrites the part of the broader shape beneath it
// (above_the_break_3 full-width rect -> corner strips -> arc-bounded mid-range shape -> paint
// rect -> restricted-area D-shape -> backcourt strip drawn last, at the very top edge, uses its own
// space and never overlaps anything else). Every zone's true SVG region only matters for the click/
// hover target, not for exact area math -- values shown come straight from the API, never derived
// from pixel area.

const W = 500;
const H = 340;
const HOOP = { x: 250, y: 287.5 }; // 5.25ft from baseline, matches real hoop-to-baseline distance
const ARC_R = 237.5; // 23.75ft arc radius
const CORNER_X = [30, 470]; // 3ft in from each sideline
const CORNER_TOP_Y = 200; // 14ft from baseline -- where the straight corner line meets the arc
const LANE = { x1: 170, x2: 330, y1: 150 }; // 16ft-wide lane, 19ft from baseline to free-throw line
const RA_R = 40; // 4ft restricted-area radius

// fgPct -> fill color. True 0-100% domain (nothing clamped/clipped -- 0% and 100% are the real
// endpoints), but WNBA zone FG% almost never touches either extreme (real zones cluster ~35-80%),
// so a straight linear map would waste most of the ramp's contrast on values that never occur. This
// sigmoid re-centers the steepest color change on that realistic band (center 0.5) so real zones
// spread across most of the ramp -- diverging cold-blue/neutral-grey/hot-orange, not a single hue.
function lerpColor(c0, c1, t) {
  const a = c0.match(/\w\w/g).map(h => parseInt(h, 16));
  const b = c1.match(/\w\w/g).map(h => parseInt(h, 16));
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
const RAMP_K = 12;
const RAMP_C = 0.5;
const sigmoid = t => 1 / (1 + Math.exp(-RAMP_K * (t - RAMP_C)));
const RAMP_MIN = sigmoid(0);
const RAMP_MAX = sigmoid(1);
function zoneColor(fga, fgPct) {
  if (fga === 0) return 'var(--surface-2)';
  const raw = Math.max(0, Math.min(1, fgPct));
  const t = (sigmoid(raw) - RAMP_MIN) / (RAMP_MAX - RAMP_MIN);
  return t < 0.5
    ? lerpColor('#1fc8ff', '#5c5c5c', t / 0.5)
    : lerpColor('#5c5c5c', '#ff5720', (t - 0.5) / 0.5);
}

function ZonePath({ zone, d, onHover }) {
  return (
    <path
      d={d}
      fill={zoneColor(zone.fga, zone.fgPct)}
      className="shot-zone-path"
      onMouseEnter={() => onHover(zone)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(zone)}
      onBlur={() => onHover(null)}
      tabIndex={zone.fga > 0 ? 0 : -1}
      role="img"
      aria-label={`${zone.label}: ${zone.fgm}-${zone.fga} (${(zone.fgPct * 100).toFixed(1)}%)`}
    />
  );
}

function CourtDiagram({ zones, onHover }) {
  const byKey = Object.fromEntries(zones.map(z => [z.key, z]));

  const aboveBreakPath = `M 0,0 L ${W},0 L ${W},${CORNER_TOP_Y} L 0,${CORNER_TOP_Y} Z`;
  const cornerLeftPath = `M 0,0 L ${CORNER_X[0]},0 L ${CORNER_X[0]},${H} L 0,${H} Z`;
  const cornerRightPath = `M ${CORNER_X[1]},0 L ${W},0 L ${W},${H} L ${CORNER_X[1]},${H} Z`;
  const midRangePath = `M ${CORNER_X[0]},${H} L ${CORNER_X[0]},${CORNER_TOP_Y} A ${ARC_R},${ARC_R} 0 0 1 ${CORNER_X[1]},${CORNER_TOP_Y} L ${CORNER_X[1]},${H} Z`;
  const paintPath = `M ${LANE.x1},${LANE.y1} L ${LANE.x2},${LANE.y1} L ${LANE.x2},${H} L ${LANE.x1},${H} Z`;
  const raPath = `M ${HOOP.x - RA_R},${H} L ${HOOP.x - RA_R},${HOOP.y} A ${RA_R},${RA_R} 0 0 1 ${HOOP.x + RA_R},${HOOP.y} L ${HOOP.x + RA_R},${H} Z`;
  const backcourtPath = `M 0,0 L ${W},0 L ${W},30 L 0,30 Z`;

  return (
    <svg viewBox={`0 -30 ${W} ${H + 30}`} className="shot-chart-svg" role="group" aria-label="Shot chart by court zone">
      {/* Zone fills, widest-first so smaller shapes below correctly overwrite them visually. */}
      {byKey.above_the_break_3 && <ZonePath zone={byKey.above_the_break_3} d={aboveBreakPath} onHover={onHover} />}
      {byKey.left_corner_3 && <ZonePath zone={byKey.left_corner_3} d={cornerLeftPath} onHover={onHover} />}
      {byKey.right_corner_3 && <ZonePath zone={byKey.right_corner_3} d={cornerRightPath} onHover={onHover} />}
      {byKey.mid_range && <ZonePath zone={byKey.mid_range} d={midRangePath} onHover={onHover} />}
      {byKey.in_the_paint_non_ra && <ZonePath zone={byKey.in_the_paint_non_ra} d={paintPath} onHover={onHover} />}
      {byKey.restricted_area && <ZonePath zone={byKey.restricted_area} d={raPath} onHover={onHover} />}
      {byKey.backcourt && <ZonePath zone={byKey.backcourt} d={backcourtPath} onHover={onHover} />}

      {/* Court markings drawn on top of the fills, decorative only. */}
      <g className="shot-chart-lines" fill="none">
        <rect x={LANE.x1} y={LANE.y1} width={LANE.x2 - LANE.x1} height={H - LANE.y1} />
        <circle cx={HOOP.x} cy={LANE.y1} r={60} />
        <path d={`M ${CORNER_X[0]},0 L ${CORNER_X[0]},${CORNER_TOP_Y} A ${ARC_R},${ARC_R} 0 0 1 ${CORNER_X[1]},${CORNER_TOP_Y} L ${CORNER_X[1]},0`} />
        <circle cx={HOOP.x} cy={HOOP.y} r={7.5} className="shot-chart-emphasis" />
        <line x1={HOOP.x - 30} y1={HOOP.y - 4} x2={HOOP.x + 30} y2={HOOP.y - 4} className="shot-chart-emphasis" />
      </g>
    </svg>
  );
}

export default function ShotChart({ playerId, playerName, availableSeasons }) {
  const [season, setSeason] = useState(null);
  const [hoverZone, setHoverZone] = useState(null);

  useEffect(() => {
    if (!season && availableSeasons.length > 0) setSeason(availableSeasons[0]);
  }, [season, availableSeasons]);

  const shotChartUrl = season ? `/api/players/${playerId}/shotchart?season=${season}` : null;
  const { data: chart, loading, error, retry } = useSeasonScopedFetch(shotChartUrl, { parse: parseShotChart });

  return (
    <>
      <div className="gl-controls">
        {availableSeasons.length > 1 && (
          <select className="gl-select" value={season ?? ''} onChange={e => setSeason(e.target.value)}>
            {availableSeasons.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
        {chart && (
          <button
            type="button"
            className="btn-ghost bref-export-btn"
            onClick={() => downloadZonesCsv(`${playerName}-shotchart-${season}.csv`, chart.zones)}
          >
            Export CSV
          </button>
        )}
      </div>

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
                  <td><span className="legend-dot" style={{ background: zoneColor(z.fga, z.fgPct) }} />{z.label}</td>
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
