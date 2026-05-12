import GradeBadge from './GradeBadge';
import { compareGrades } from '../lib/gradeUtils';

const CATEGORIES = ['Scoring', 'Playmaking', 'Rebounding', 'Defense', 'Efficiency', 'Longevity'];

function GradeGridRow({ category, catA, catB, nameA, nameB, gradeA, gradeB }) {
  const cmp = gradeA && gradeB ? compareGrades(gradeA, gradeB) : 0;

  // cmp > 0 → A wins, cmp < 0 → B wins, 0 → tie / no data
  const aWins = cmp > 0;
  const bWins = cmp < 0;

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
          <GradeBadge grade={gradeA} size={aWins || cmp === 0 ? 'large' : 'small'} muted={bWins} />
          {aWins && <span className="grade-grid-arrow grade-grid-arrow--left" aria-hidden="true">◀</span>}
        </div>

        {/* Center — stat label + expand chevron */}
        <div className="grade-grid-center">
          <span className="grade-grid-row-label">{category.toUpperCase()}</span>
          <span className="grade-grid-row-chevron" aria-hidden="true">▾</span>
        </div>

        {/* Right half — Player B's grade, left-aligned toward the center */}
        <div className="grade-grid-cell grade-grid-cell--right">
          {bWins && <span className="grade-grid-arrow grade-grid-arrow--right" aria-hidden="true">▶</span>}
          <GradeBadge grade={gradeB} size={bWins || cmp === 0 ? 'large' : 'small'} muted={aWins} />
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
