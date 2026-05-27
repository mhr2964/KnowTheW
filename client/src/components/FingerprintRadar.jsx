// Hand-rolled radar for the archetype card (no chart lib in the project — a radar is just a
// polygon). The filled SHAPE is the point: a scorer, a rim-protector, and a playmaker produce
// visibly different shapes, so playstyle reads in one look instead of from 13 equal bars. Decorative
// for sighted users (role="img" + aria-label carries the values; the expandable bars carry detail).
// Spoke count follows `dimensions.length` (currently 5 playstyle dimensions → a pentagon).

const SIZE = 200;
const CX = 100;
const CY = 100;
const R = 66;            // 100% radius; labels sit just outside it
const RINGS = [25, 50, 75, 100];

// Point on spoke i of n at `pct` of full radius. Spoke 0 points up (−90°), then clockwise.
function polar(i, n, pct) {
  const angle = ((-90 + i * (360 / n)) * Math.PI) / 180;
  const r = (pct / 100) * R;
  return [CX + r * Math.cos(angle), CY + r * Math.sin(angle)];
}

export default function FingerprintRadar({ dimensions }) {
  if (!Array.isArray(dimensions) || dimensions.length < 3) return null;
  const n = dimensions.length;

  const val = (d) => (typeof d.value === 'number' ? d.value : 0);
  const ringPoints = (pct) => dimensions.map((_, i) => polar(i, n, pct).join(',')).join(' ');
  const dataPoints = dimensions.map((d, i) => polar(i, n, val(d)).join(',')).join(' ');
  const summary = dimensions.map(d => `${d.label} ${d.value ?? 0}`).join(', ');

  return (
    <svg
      className="fp-radar"
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role="img"
      aria-label={`Play profile out of 100 — ${summary}.`}
    >
      {RINGS.map(pct => (
        <polygon key={`ring-${pct}`} className="fp-radar-grid" points={ringPoints(pct)} />
      ))}
      {dimensions.map((d, i) => {
        const [x, y] = polar(i, n, 100);
        return <line key={`axis-${d.key}`} className="fp-radar-axis" x1={CX} y1={CY} x2={x} y2={y} />;
      })}

      <polygon className="fp-radar-area" points={dataPoints} />

      {dimensions.map((d, i) => {
        const [x, y] = polar(i, n, val(d));
        return <circle key={`dot-${d.key}`} className="fp-radar-dot" cx={x} cy={y} r="2.4" />;
      })}

      {dimensions.map((d, i) => {
        const [lx, ly] = polar(i, n, 116);
        const dx = lx - CX;
        const anchor = Math.abs(dx) < 2 ? 'middle' : dx > 0 ? 'start' : 'end';
        return (
          <text key={`label-${d.key}`} className="fp-radar-label" x={lx} y={ly} textAnchor={anchor}>
            {d.label}
          </text>
        );
      })}
    </svg>
  );
}
