import GradeBadge from './GradeBadge';
import { compareGrades } from '../lib/gradeUtils';

const CATEGORIES = ['Scoring', 'Playmaking', 'Rebounding', 'Defense', 'Efficiency', 'Longevity'];

const POS_ADJ_RE = /^\((guard|forward)-adj\)/;

function GradeGridRow({ category, catA, catB, nameA, nameB, gradeA, gradeB }) {
  const cmp = gradeA && gradeB ? compareGrades(gradeA, gradeB) : 0;

  // cmp > 0 → A wins, cmp < 0 → B wins, 0 → tie / no data
  const aWins = cmp > 0;
  const bWins = cmp < 0;

  const hasPosAdj = category === 'Rebounding' && (
    POS_ADJ_RE.test(catA?.stats ?? '') || POS_ADJ_RE.test(catB?.stats ?? '')
  );

  const expandContent = (
    <div className="grade-grid-expand">
      <div className="grade-grid-expand-panel grade-grid-expand-panel--left">
        <span className="grade-grid-expand-name">{nameA}</span>
        {catA ? (
          <>
            {catA.stats && <p className="grade-grid-expand-stats">{catA.stats}</p>}
            <p className="grade-grid-expand-context">{catA.context}</p>
          </>
        ) : (
          <p className="grade-grid-expand-unavailable">Report unavailable</p>
        )}
      </div>
      <div className="grade-grid-expand-divider" />
      <div className="grade-grid-expand-panel grade-grid-expand-panel--right">
        <span className="grade-grid-expand-name">{nameB}</span>
        {catB ? (
          <>
            {catB.stats && <p className="grade-grid-expand-stats">{catB.stats}</p>}
            <p className="grade-grid-expand-context">{catB.context}</p>
          </>
        ) : (
          <p className="grade-grid-expand-unavailable">Report unavailable</p>
        )}
      </div>
    </div>
  );

  return (
    <details className="grade-grid-row">
      <summary className="grade-grid-row-summary">
        {/* Left half — Player A's grade, right-aligned toward the center */}
        <div className="grade-grid-cell grade-grid-cell--left">
          <GradeBadge grade={gradeA} size="large" winner={aWins} />
        </div>

        {/* Center — stat label, winner arrow, expand chevron */}
        <div className="grade-grid-center">
          <span className="grade-grid-row-label">{category.toUpperCase()}</span>
          {hasPosAdj && <span className="grade-grid-pos-adj-label">pos-adj</span>}
          {(aWins || bWins) && (
            <span className="grade-grid-winner-arrow" aria-hidden="true">
              {aWins ? '◀' : '▶'}
            </span>
          )}
          <span className="grade-grid-row-chevron" aria-hidden="true">▾</span>
        </div>

        {/* Right half — Player B's grade, left-aligned toward the center */}
        <div className="grade-grid-cell grade-grid-cell--right">
          <GradeBadge grade={gradeB} size="large" winner={bWins} />
        </div>
      </summary>
      {expandContent}
    </details>
  );
}

export default function GradeGrid({ reportA, reportB, nameA, nameB }) {
  return (
    <div className="grade-grid">
      {/* Column header strip */}
      <div className="grade-grid-header">
        <span className="grade-grid-header-name grade-grid-header-name--left">{nameA}</span>
        <span className="grade-grid-header-sep" />
        <span className="grade-grid-header-name grade-grid-header-name--right">{nameB}</span>
      </div>

      {CATEGORIES.map(cat => (
        <GradeGridRow
          key={cat}
          category={cat}
          catA={reportA?.categories?.[cat] ?? null}
          catB={reportB?.categories?.[cat] ?? null}
          nameA={nameA}
          nameB={nameB}
          gradeA={reportA?.categories?.[cat]?.grade ?? null}
          gradeB={reportB?.categories?.[cat]?.grade ?? null}
        />
      ))}
    </div>
  );
}
