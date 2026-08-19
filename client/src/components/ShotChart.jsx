import { useState, useEffect, useRef } from 'react';

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

// fgPct -> fill color. Clamped to a realistic WNBA zone-FG% band (not the full 0-100 range) so
// the color scale actually shows contrast between zones instead of clustering near one hue --
// most zone FG%s fall between ~25% and ~70%. A stylistic normalization, not a league-average
// comparison (no league-wide zone data is fetched for this).
function zoneColor(fga, fgPct) {
  if (fga === 0) return 'var(--surface-2)';
  const t = Math.max(0, Math.min(1, (fgPct - 0.25) / (0.70 - 0.25)));
  const hue = 215 - t * 205; // 215 (cool blue) -> 10 (warm red-orange)
  return `hsl(${hue.toFixed(0)}, 70%, 45%)`;
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
        <circle cx={HOOP.x} cy={HOOP.y} r={7.5} />
        <line x1={HOOP.x - 30} y1={HOOP.y - 4} x2={HOOP.x + 30} y2={HOOP.y - 4} strokeWidth={3} />
      </g>
    </svg>
  );
}

export default function ShotChart({ playerId, availableSeasons }) {
  const [season, setSeason] = useState(null);
  const [cache, setCache] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [hoverZone, setHoverZone] = useState(null);
  const abortRef = useRef(null);
  const fetchedRef = useRef(new Set());

  useEffect(() => {
    if (!season && availableSeasons.length > 0) setSeason(availableSeasons[0]);
  }, [season, availableSeasons]);

  useEffect(() => {
    if (!season) return;
    if (fetchedRef.current.has(season)) return;
    fetchedRef.current.add(season);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(false);

    fetch(`/api/players/${playerId}/shotchart?season=${season}`, { signal: controller.signal })
      .then(r => {
        if (r.status === 404) return null;
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(d => {
        setCache(prev => ({ ...prev, [season]: d }));
        setLoading(false);
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          fetchedRef.current.delete(season);
          setError(true);
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [season, playerId, retryCount]);

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  const chart = cache[season] ?? null;

  return (
    <>
      <div className="gl-controls">
        {availableSeasons.length > 1 && (
          <select className="gl-select" value={season ?? ''} onChange={e => setSeason(e.target.value)}>
            {availableSeasons.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
      </div>

      {loading && <p className="status-msg" style={{ padding: '1rem 0' }}>Loading shot chart…</p>}
      {error && (
        <p className="status-msg error" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          Could not load shot chart.
          <button type="button" className="btn-ghost compare-verdict-retry" onClick={() => { setError(false); setRetryCount(c => c + 1); }}>Try again</button>
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
                  <td>{z.label}</td>
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
