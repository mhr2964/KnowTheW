import { gradeIndex, compareGrades } from '../lib/gradeUtils';

const MAX_GAP = 11; // F to A+ span on the 12-step GRADE_ORDER scale

// Whole-letter-grade boundaries from GRADE_ORDER (['F','D','D+','C-','C','C+','B-','B','B+','A-','A','A+']):
// F=0, D=1, C=4, B=7, A=10 — F/D is only 1 step apart since F has no +/- variant, unlike the other
// three-step-wide letters. Real boundaries, not an approximated "every 3 steps."
const NOTCH_GAPS = [1, 4, 7, 10];

// Center-anchored bar showing which side leads a grade comparison and by how much. Fill extends
// from the center divider toward the leading side; length is proportional to the grade-index gap
// (max 11 steps, F to A+). Replaces the old single-purpose winner arrow — one visual answers both
// "who won" (fill color/side) and "by how much" (fill length), which a letter grade alone can't.
// Ties and missing grades render a flat neutral track, no fill.
//
// The caption is always shown (not just for big gaps) — a bar's length alone is hard to read at a
// glance without a text anchor, especially for small gaps where the fill is a sliver.
export default function CompareMagnitudeBar({ gradeA, gradeB, size = 'sm', showMargin = true }) {
  const hasBoth = Boolean(gradeA && gradeB);
  const cmp = hasBoth ? compareGrades(gradeA, gradeB) : 0;
  const gap = hasBoth ? Math.abs(gradeIndex(gradeA) - gradeIndex(gradeB)) : 0;
  const fillSide = cmp > 0 ? 'a' : cmp < 0 ? 'b' : null;
  // sqrt (not linear) so small gaps — the overwhelming majority of real comparisons — still read
  // as a visible fill instead of a barely-there sliver; a 1-grade gap out of a possible 11-grade
  // span is a real difference and should look like one. Still maxes out at 50% (track edge) for
  // the largest possible gap, same as before.
  const fillPct = fillSide ? Math.sqrt(gap / MAX_GAP) * 50 : 0;
  const caption = !hasBoth ? null : gap === 0 ? 'Even' : `${gap} grade${gap === 1 ? '' : 's'} apart`;

  // Fixed scale marks, not fill-dependent — always rendered on both sides of center regardless of
  // who's leading, using the exact same sqrt transform as the fill so a notch sits exactly where
  // the fill's edge would land at that grade-gap. Rendered before the fill in DOM order so the
  // fill (painted later, on top) visually covers any notch it has "passed."
  const notches = NOTCH_GAPS.flatMap((g) => {
    const pct = Math.sqrt(g / MAX_GAP) * 50;
    return [{ key: `${g}-hi`, left: 50 + pct }, { key: `${g}-lo`, left: 50 - pct }];
  });

  return (
    <div className={`compare-mag-bar compare-mag-bar--${size}`}>
      <div className="compare-mag-bar-track" aria-hidden="true">
        <div className="compare-mag-bar-center" />
        {notches.map(n => (
          <div key={n.key} className="compare-mag-bar-notch" style={{ left: `${n.left}%` }} />
        ))}
        {fillSide && (
          <div
            className={`compare-mag-bar-fill compare-mag-bar-fill--${fillSide}`}
            style={{ width: `${fillPct}%` }}
          />
        )}
      </div>
      {showMargin && caption && (
        <span className="compare-mag-bar-margin">{caption}</span>
      )}
    </div>
  );
}
