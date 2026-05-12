import GradeBadge from './GradeBadge';
import { compareGrades } from '../lib/gradeUtils';

const CATEGORIES = ['Scoring', 'Playmaking', 'Rebounding', 'Defense', 'Efficiency', 'Longevity'];

function GradeGridRow({ category, catA, catB, nameA, nameB, gradeA, gradeB, isOverall }) {
  const cmp = gradeA && gradeB ? compareGrades(gradeA, gradeB) : 0;

  const expandContent = (
    <div className="grade-grid-expand">
      <div className="grade-grid-expand-panel">
        <span className="grade-grid-expand-name">{nameA}</span>
        {catA ? (
          <>
            <p className="grade-grid-expand-stats">{catA.stats}</p>
            <p className="grade-grid-expand-context">{catA.context}</p>
          </>
        ) : (
          <p className="grade-grid-expand-unavailable">Report unavailable</p>
        )}
      </div>
      <div className="grade-grid-expand-divider" />
      <div className="grade-grid-expand-panel">
        <span className="grade-grid-expand-name">{nameB}</span>
        {catB ? (
          <>
            <p className="grade-grid-expand-stats">{catB.stats}</p>
            <p className="grade-grid-expand-context">{catB.context}</p>
          </>
        ) : (
          <p className="grade-grid-expand-unavailable">Report unavailable</p>
        )}
      </div>
    </div>
  );

  return (
    <details className={`grade-grid-row${isOverall ? ' grade-grid-row--overall' : ''}`}>
      <summary className="grade-grid-row-summary">
        <span className="grade-grid-row-label">{category.toUpperCase()}</span>
        <span className={`grade-grid-row-cell${cmp > 0 ? ' grade-grid-row-cell--winner' : ''}`}>
          <GradeBadge grade={gradeA} size="large" />
          {cmp > 0 && <span className="grade-grid-check" aria-hidden="true">✓</span>}
        </span>
        <span className={`grade-grid-row-cell${cmp < 0 ? ' grade-grid-row-cell--winner' : ''}`}>
          <GradeBadge grade={gradeB} size="large" />
          {cmp < 0 && <span className="grade-grid-check" aria-hidden="true">✓</span>}
        </span>
        <span className="grade-grid-row-chevron" aria-hidden="true">▶</span>
      </summary>
      {expandContent}
    </details>
  );
}

export default function GradeGrid({ reportA, reportB, nameA, nameB }) {
  const overallA = reportA?.overall;
  const overallB = reportB?.overall;

  return (
    <div className="grade-grid">
      <GradeGridRow
        category="Overall"
        catA={overallA ? { stats: '', context: overallA.summary } : null}
        catB={overallB ? { stats: '', context: overallB.summary } : null}
        nameA={nameA}
        nameB={nameB}
        gradeA={overallA?.grade ?? null}
        gradeB={overallB?.grade ?? null}
        isOverall
      />
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
