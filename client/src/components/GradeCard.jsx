import GradeBadge from './GradeBadge';
import CompareMagnitudeBar from './CompareMagnitudeBar';
import { compareGrades } from '../lib/gradeUtils';

export const CATEGORIES = ['Scoring', 'Playmaking', 'Rebounding', 'Defense', 'Efficiency', 'Longevity'];

const POS_ADJ_RE = /^\((guard|forward)-adj\)/;

// Always-expanded category card — no collapse, no chevron. Stats and AI context render
// immediately under each side's badge; the magnitude bar in the header is the only "who's ahead"
// signal, replacing the old winner-arrow-vs-expand-chevron pair that shared one column.
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
        <CompareMagnitudeBar gradeA={gradeA} gradeB={gradeB} size="sm" />
      </div>

      <div className="grade-card-panels">
        <div className={`grade-card-panel${aWins ? ' grade-card-panel--winner-a' : ''}`}>
          <div className="grade-card-panel-top">
            <span className="grade-card-panel-name">{nameA}</span>
            <GradeBadge grade={gradeA} winnerSide={aWins ? 'a' : null} />
          </div>
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
          <div className="grade-card-panel-top">
            <span className="grade-card-panel-name">{nameB}</span>
            <GradeBadge grade={gradeB} winnerSide={bWins ? 'b' : null} />
          </div>
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
    </div>
  );
}
