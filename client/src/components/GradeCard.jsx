import GradeBadge from './GradeBadge';
import CompareMagnitudeBar from './CompareMagnitudeBar';
import { compareGrades } from '../lib/gradeUtils';

export const CATEGORIES = ['Scoring', 'Playmaking', 'Rebounding', 'Defense', 'Efficiency', 'Longevity'];

const POS_ADJ_RE = /^\((guard|forward)-adj\)/;

// Header (just the category label, centered) and the badge row (names + grades + the magnitude
// bar between them) are always visible — the full "at a glance" scan: category, who's ahead, by
// how much, both grades. The bar lives in the badge row, not the header, specifically so it gets a
// fixed width instead of sharing space with a variable-length category label — every card's bar is
// now identical regardless of whether the label is "SCORING" or "REBOUNDING" (+ pos-adj tag).
// Stats + AI context sit behind one details/summary toggle per card, collapsed by default,
// spatially separate from the bar so the expand chevron never competes with the winner signal the
// way the old design (arrow and chevron sharing one column) did.
export default function GradeCard({ category, reportA, reportB, nameA, nameB }) {
  const catA = reportA?.categories?.[category] ?? null;
  const catB = reportB?.categories?.[category] ?? null;
  const gradeA = catA?.grade ?? null;
  const gradeB = catB?.grade ?? null;
  const cmp = (gradeA && gradeB) ? compareGrades(gradeA, gradeB) : 0;
  const aWins = cmp > 0;
  const bWins = cmp < 0;

  const hasPosAdj = category === 'Rebounding' && (
    POS_ADJ_RE.test(catA?.stats ?? '') || POS_ADJ_RE.test(catB?.stats ?? '')
  );

  return (
    <div className="grade-card">
      <div className="grade-card-header">
        <span className="grade-card-category">{category.toUpperCase()}</span>
        {hasPosAdj && <span className="grade-card-pos-adj">pos-adj</span>}
      </div>

      <div className="grade-card-badges">
        <div className="grade-card-badge-side">
          <span className="grade-card-badge-name">{nameA}</span>
          <GradeBadge grade={gradeA} size="large" winnerSide={aWins ? 'a' : null} />
        </div>
        <CompareMagnitudeBar gradeA={gradeA} gradeB={gradeB} size="sm" />
        <div className="grade-card-badge-side grade-card-badge-side--right">
          <GradeBadge grade={gradeB} size="large" winnerSide={bWins ? 'b' : null} />
          <span className="grade-card-badge-name">{nameB}</span>
        </div>
      </div>

      <details className="grade-card-details">
        <summary className="grade-card-toggle">
          <span>Show breakdown</span>
          <span className="grade-card-toggle-chevron" aria-hidden="true">▾</span>
        </summary>
        <div className="grade-card-panels">
          <div className={`grade-card-panel${aWins ? ' grade-card-panel--winner-a' : ''}`}>
            {catA ? (
              <>
                {catA.stats && <p className="grade-card-panel-stats">{catA.stats}</p>}
                <p className="grade-card-panel-context">{catA.context}</p>
              </>
            ) : (
              <p className="grade-card-panel-unavailable">Report unavailable</p>
            )}
          </div>
          <div className={`grade-card-panel${bWins ? ' grade-card-panel--winner-b' : ''}`}>
            {catB ? (
              <>
                {catB.stats && <p className="grade-card-panel-stats">{catB.stats}</p>}
                <p className="grade-card-panel-context">{catB.context}</p>
              </>
            ) : (
              <p className="grade-card-panel-unavailable">Report unavailable</p>
            )}
          </div>
        </div>
      </details>
    </div>
  );
}
