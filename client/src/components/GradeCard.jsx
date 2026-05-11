import GradeBadge from './GradeBadge';
import { compareGrades } from '../lib/gradeUtils';

export default function GradeCard({ category, reportA, reportB, nameA, nameB }) {
  const catA = reportA?.categories?.[category];
  const catB = reportB?.categories?.[category];

  const gradeA = catA?.grade ?? null;
  const gradeB = catB?.grade ?? null;
  const cmp = (gradeA && gradeB) ? compareGrades(gradeA, gradeB) : 0;

  const gpA = reportA?.volume?.gp;
  const gpB = reportB?.volume?.gp;
  const seasonsA = reportA?.volume?.seasons;
  const seasonsB = reportB?.volume?.seasons;

  const showVolume = (gpA != null || gpB != null);

  return (
    <div className="compare-grade-card">
      <div className="compare-grade-card-header">
        <span className="compare-grade-card-category">{category.toUpperCase()}</span>
        {cmp > 0 && <span className="compare-grade-card-leader">{nameA} leads</span>}
        {cmp < 0 && <span className="compare-grade-card-leader">{nameB} leads</span>}
        {cmp === 0 && gradeA && gradeB && <span className="compare-grade-card-tie">Tie</span>}
      </div>

      <div className="compare-grade-card-panels">
        <div className={`compare-grade-panel${cmp > 0 ? ' compare-grade-panel--winner' : ''}`}>
          <div className="compare-grade-panel-top">
            <span className="compare-grade-panel-name">{nameA}</span>
            <GradeBadge grade={gradeA} />
          </div>
          {catA
            ? <>
                <p className="compare-grade-panel-stats">{catA.stats}</p>
                <p className="compare-grade-panel-context">{catA.context}</p>
              </>
            : <p className="compare-grade-panel-unavailable">AI report unavailable for this player</p>
          }
        </div>

        <div className={`compare-grade-panel${cmp < 0 ? ' compare-grade-panel--winner' : ''}`}>
          <div className="compare-grade-panel-top">
            <span className="compare-grade-panel-name">{nameB}</span>
            <GradeBadge grade={gradeB} />
          </div>
          {catB
            ? <>
                <p className="compare-grade-panel-stats">{catB.stats}</p>
                <p className="compare-grade-panel-context">{catB.context}</p>
              </>
            : <p className="compare-grade-panel-unavailable">AI report unavailable for this player</p>
          }
        </div>
      </div>

      {showVolume && (
        <p className="compare-grade-card-volume">
          {gpA != null ? `${nameA}: ${gpA} GP${seasonsA != null ? `, ${seasonsA} seasons` : ''}` : ''}
          {gpA != null && gpB != null ? ' · ' : ''}
          {gpB != null ? `${nameB}: ${gpB} GP${seasonsB != null ? `, ${seasonsB} seasons` : ''}` : ''}
        </p>
      )}
    </div>
  );
}
