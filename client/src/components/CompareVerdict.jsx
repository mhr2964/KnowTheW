import { useMemo } from 'react';
import GradeBadge from './GradeBadge';
import CompareMagnitudeBar from './CompareMagnitudeBar';
import { compareGrades } from '../lib/gradeUtils';

const CATEGORIES = ['Scoring', 'Playmaking', 'Rebounding', 'Defense', 'Efficiency', 'Longevity'];

// [accolades key, display label] — championships last since it's the marquee one.
const ACCOLADE_LABELS = [
  ['mvp', 'MVP'],
  ['finalsMVP', 'Finals MVP'],
  ['dpoy', 'DPOY'],
  ['roy', 'ROY'],
  ['sixth', '6th Player'],
  ['allWnbaFirst', 'All-WNBA 1st'],
  ['championships', 'Championships'],
];

// Renders nothing for a side with zero accolades — not an empty "0" row. Career facts, so shown
// unfiltered by the Peak/Career/Playoffs mode toggle (a title won is a title won).
function AccoladeChips({ accolades, sideClass }) {
  if (!accolades) return null;
  const chips = ACCOLADE_LABELS
    .map(([key, label]) => ({ label, count: accolades[key]?.length ?? 0 }))
    .filter(c => c.count > 0);
  if (!chips.length) return null;
  return (
    <div className={`compare-accolade-chips ${sideClass}`}>
      {chips.map(c => (
        <span key={c.label} className="compare-accolade-chip">{c.label} ×{c.count}</span>
      ))}
    </div>
  );
}

function computeVerdict(reportA, reportB) {
  if (!reportA || !reportB) return null;

  let wonByA = 0;
  let wonByB = 0;
  let tied = 0;

  for (const cat of CATEGORIES) {
    const gradeA = reportA.categories?.[cat]?.grade;
    const gradeB = reportB.categories?.[cat]?.grade;
    if (!gradeA || !gradeB) continue;
    const cmp = compareGrades(gradeA, gradeB);
    if (cmp > 0) wonByA++;
    else if (cmp < 0) wonByB++;
    else tied++;
  }

  const overallA = reportA.overall?.grade;
  const overallB = reportB.overall?.grade;
  const overallCmp = (overallA && overallB) ? compareGrades(overallA, overallB) : 0;

  const gpA = reportA.volume?.gp ?? 0;
  const gpB = reportB.volume?.gp ?? 0;
  let volumeSignal = null;
  if (gpA > 0 && gpB > 0) {
    const maxGp = Math.max(gpA, gpB);
    const minGp = Math.min(gpA, gpB);
    const ratio = maxGp / minGp;
    const smallSample = minGp <= 30 && maxGp >= 100;
    if (ratio >= 1.5 || smallSample) {
      const biggerName = gpA >= gpB ? reportA.playerName : reportB.playerName;
      const smallerName = gpA < gpB ? reportA.playerName : reportB.playerName;
      const smallerGp = Math.min(gpA, gpB);
      const biggerGp = Math.max(gpA, gpB);
      if (smallSample) {
        volumeSignal = `${smallerName}'s sample (${smallerGp} GP) is much smaller than ${biggerName}'s (${biggerGp} GP)`;
      } else {
        volumeSignal = `${biggerName}'s sample is ${ratio.toFixed(1)}× ${smallerName}'s by games played`;
      }
    }
  }

  let shortPeakWarning = null;
  const peakA = reportA.peakSeasons?.length ?? 0;
  const peakB = reportB.peakSeasons?.length ?? 0;
  if (peakA > 0 || peakB > 0) {
    const nameA = reportA.playerName;
    const nameB = reportB.playerName;
    const warnings = [];
    if (peakA > 0 && peakA < 3) warnings.push(`${nameA}'s peak window is only ${peakA} season${peakA > 1 ? 's' : ''}`);
    if (peakB > 0 && peakB < 3) warnings.push(`${nameB}'s peak window is only ${peakB} season${peakB > 1 ? 's' : ''}`);
    if (warnings.length) shortPeakWarning = warnings.join(' · ') + ' — limited sample for comparison';
  }

  return { wonByA, wonByB, tied, overallCmp, overallA, overallB, volumeSignal, shortPeakWarning };
}

export default function CompareVerdict({ reportA, reportB, nameA, nameB, loading, errorA, errorB, onRetryA, onRetryB }) {
  const verdict = useMemo(() => computeVerdict(reportA, reportB), [reportA, reportB]);

  if (loading) {
    return (
      <div className="compare-verdict compare-verdict--skeleton">
        <div className="compare-verdict-skeleton-line" />
        <div className="compare-verdict-skeleton-line compare-verdict-skeleton-line--short" />
      </div>
    );
  }

  const oneErrored = (errorA && reportB) || (errorB && reportA);
  if (!verdict && oneErrored) {
    const gradeA = reportA?.overall?.grade ?? null;
    const gradeB = reportB?.overall?.grade ?? null;
    const failingName = errorA ? nameA : nameB;
    const onRetry = errorA ? onRetryA : onRetryB;
    return (
      <div className="compare-verdict">
        <p className="compare-verdict-label">AT A GLANCE</p>
        <div className="compare-verdict-fight">
          <span className="compare-verdict-fight-side compare-verdict-fight-side--left">
            <span className="compare-verdict-fight-name">{nameA}</span>
            {gradeA ? <GradeBadge grade={gradeA} size="large" /> : <span className="compare-verdict-grade-dash">—</span>}
          </span>
          <span className="compare-verdict-fight-divider">vs</span>
          <span className="compare-verdict-fight-side compare-verdict-fight-side--right">
            {gradeB ? <GradeBadge grade={gradeB} size="large" /> : <span className="compare-verdict-grade-dash">—</span>}
            <span className="compare-verdict-fight-name">{nameB}</span>
          </span>
        </div>
        <p className="compare-verdict-error-notice">
          Couldn&apos;t load graded report for {failingName}
          {onRetry && (
            <button type="button" className="btn-ghost compare-verdict-retry" onClick={onRetry}>
              Try again
            </button>
          )}
        </p>
      </div>
    );
  }

  if (!verdict) return null;

  const { wonByA, wonByB, tied, overallCmp, overallA, overallB, volumeSignal, shortPeakWarning } = verdict;

  const aWinsOverall = overallCmp > 0;
  const bWinsOverall = overallCmp < 0;

  return (
    <div className="compare-verdict">
      <p className="compare-verdict-label">AT A GLANCE</p>

      {/* Fight-night score line */}
      <div className="compare-verdict-fight">
        <span className={`compare-verdict-fight-side compare-verdict-fight-side--left${aWinsOverall ? ' compare-verdict-fight-side--winner' : ''}`}>
          <span className="compare-verdict-fight-name">{nameA}</span>
          <span className={`compare-verdict-score${aWinsOverall ? ' compare-verdict-score--winner' : ''}`}>{wonByA}</span>
        </span>

        <span className="compare-verdict-fight-divider">—</span>

        <span className={`compare-verdict-fight-side compare-verdict-fight-side--right${bWinsOverall ? ' compare-verdict-fight-side--winner' : ''}`}>
          <span className={`compare-verdict-score${bWinsOverall ? ' compare-verdict-score--winner' : ''}`}>{wonByB}</span>
          <span className="compare-verdict-fight-name">{nameB}</span>
        </span>
      </div>

      {tied > 0 && (
        <p className="compare-verdict-tied">
          {tied} tied categor{tied === 1 ? 'y' : 'ies'}
        </p>
      )}

      {(reportA?.accolades || reportB?.accolades) && (
        <div className="compare-accolade-row">
          <AccoladeChips accolades={reportA?.accolades} sideClass="compare-accolade-chips--left" />
          <AccoladeChips accolades={reportB?.accolades} sideClass="compare-accolade-chips--right" />
        </div>
      )}

      {/* Overall grade — one magnitude bar instead of a separate arrow glyph, same language as
          each category card below. */}
      {overallA && overallB && (
        <div className="compare-verdict-overall-row">
          <span className="compare-verdict-overall-side compare-verdict-overall-side--left">
            <GradeBadge grade={overallA} size="large" winnerSide={aWinsOverall ? 'a' : null} />
          </span>
          <div className="compare-verdict-overall-center">
            <span className="compare-verdict-overall-label">OVERALL</span>
            <CompareMagnitudeBar gradeA={overallA} gradeB={overallB} size="lg" />
          </div>
          <span className="compare-verdict-overall-side compare-verdict-overall-side--right">
            <GradeBadge grade={overallB} size="large" winnerSide={bWinsOverall ? 'b' : null} />
          </span>
        </div>
      )}

      {(reportA?.overall?.summary || reportB?.overall?.summary) && (
        <div className="compare-overall-summaries">
          {reportA?.overall?.summary && (
            <div className="compare-overall-summary">
              <span className="compare-overall-summary-name">{nameA}</span>
              <p>{reportA.overall.summary}</p>
            </div>
          )}
          {reportB?.overall?.summary && (
            <div className="compare-overall-summary">
              <span className="compare-overall-summary-name">{nameB}</span>
              <p>{reportB.overall.summary}</p>
            </div>
          )}
        </div>
      )}

      {(volumeSignal || shortPeakWarning) && (
        <p className="compare-verdict-volume">
          {[volumeSignal, shortPeakWarning].filter(Boolean).join(' · ')}
        </p>
      )}
    </div>
  );
}
