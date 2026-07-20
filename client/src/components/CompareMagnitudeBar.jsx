import { gradeIndex, compareGrades } from '../lib/gradeUtils';

const MAX_GAP = 11; // F to A+ span on the 12-step GRADE_ORDER scale

// Center-anchored bar showing which side leads a grade comparison and by how much. Fill extends
// from the center divider toward the leading side; length is proportional to the grade-index gap
// (max 11 steps, F to A+). Replaces the old single-purpose winner arrow — one visual answers both
// "who won" (fill color/side) and "by how much" (fill length), which a letter grade alone can't.
// Ties and missing grades render a flat neutral track, no fill.
export default function CompareMagnitudeBar({ gradeA, gradeB, size = 'sm', showMargin = true }) {
  const hasBoth = Boolean(gradeA && gradeB);
  const cmp = hasBoth ? compareGrades(gradeA, gradeB) : 0;
  const gap = hasBoth ? Math.abs(gradeIndex(gradeA) - gradeIndex(gradeB)) : 0;
  const fillSide = cmp > 0 ? 'a' : cmp < 0 ? 'b' : null;
  const fillPct = fillSide ? (gap / MAX_GAP) * 50 : 0;

  return (
    <div className={`compare-mag-bar compare-mag-bar--${size}`}>
      <div className="compare-mag-bar-track" aria-hidden="true">
        <div className="compare-mag-bar-center" />
        {fillSide && (
          <div
            className={`compare-mag-bar-fill compare-mag-bar-fill--${fillSide}`}
            style={{ width: `${fillPct}%` }}
          />
        )}
      </div>
      {showMargin && gap >= 3 && (
        <span className="compare-mag-bar-margin">{gap} grades apart</span>
      )}
    </div>
  );
}
