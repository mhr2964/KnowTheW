// Hand-rolled SVG shot-court diagram, extracted from ShotChart.jsx (2026-08-22) so TeamShotChart.jsx
// can reuse the exact same geometry/coloring for team-level zone data rather than duplicating it.
// See ShotChart.jsx's git history for the original single-file version and its full design rationale
// (zone-aggregated FG%, not per-shot coordinates; layering trick instead of path-boolean subtraction;
// sigmoid color anchored to each zone's own league-average FG%).

const W = 500;
const H = 340;
const HOOP = { x: 250, y: 287.5 }; // 5.25ft from baseline, matches real hoop-to-baseline distance
const ARC_R = 237.5; // 23.75ft arc radius
const CORNER_X = [30, 470]; // 3ft in from each sideline
const CORNER_TOP_Y = 200; // 14ft from baseline -- where the straight corner line meets the arc
const LANE = { x1: 170, x2: 330, y1: 150 }; // 16ft-wide lane, 19ft from baseline to free-throw line
const RA_R = 40; // 4ft restricted-area radius

// fgPct -> fill color, anchored to THAT ZONE's own league-average FG% (leagueAvgPct), not a flat
// 50% -- restricted-area league average runs ~60-65%, mid-range ~35-40%, 3PT ~30-35%, so the same
// raw FG% means something very different depending on the zone. Falls back to a flat 0.5 center
// when leagueAvgPct is unavailable -- degraded but not broken.
function lerpColor(c0, c1, t) {
  const a = c0.match(/\w\w/g).map(h => parseInt(h, 16));
  const b = c1.match(/\w\w/g).map(h => parseInt(h, 16));
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
const RAMP_K = 12;
const sigmoidAt = (t, center) => 1 / (1 + Math.exp(-RAMP_K * (t - center)));
export function zoneColor(fga, fgPct, leagueAvgPct) {
  if (fga === 0) return 'var(--surface-2)';
  const center = leagueAvgPct != null ? Math.max(0.02, Math.min(0.98, leagueAvgPct)) : 0.5;
  const rampMin = sigmoidAt(0, center);
  const rampMax = sigmoidAt(1, center);
  const raw = Math.max(0, Math.min(1, fgPct));
  const t = (sigmoidAt(raw, center) - rampMin) / (rampMax - rampMin);
  return t < 0.5
    ? lerpColor('#1fc8ff', '#5c5c5c', t / 0.5)
    : lerpColor('#5c5c5c', '#ff5720', (t - 0.5) / 0.5);
}

function ZonePath({ zone, d, onHover }) {
  return (
    <path
      d={d}
      fill={zoneColor(zone.fga, zone.fgPct, zone.leagueAvgPct)}
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

export default function CourtDiagram({ zones, onHover }) {
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
