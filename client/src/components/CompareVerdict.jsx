import { useMemo } from 'react';
import GradeBadge from './GradeBadge';
import { compareGrades, gradeIndex } from '../lib/gradeUtils';

const CATEGORIES = ['Scoring', 'Playmaking', 'Rebounding', 'Defense', 'Efficiency', 'Longevity'];

function computeVerdict(reportA, reportB, mode) {
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
  const overallMargin = (overallA && overallB) ? Math.abs(gradeIndex(overallA) - gradeIndex(overallB)) : 0;

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
        const modeLabel = mode === 'peak' ? 'peak window' : mode === 'playoffs' ? 'playoff sample' : 'career';
        volumeSignal = `${biggerName}'s ${modeLabel} is ${ratio.toFixed(1)}× ${smallerName}'s by games played`;
      }
    }
  }

  let shortPeakWarning = null;
  if (mode === 'peak') {
    const peakA = reportA.peakSeasons?.length ?? 0;
    const peakB = reportB.peakSeasons?.length ?? 0;
    const nameA = reportA.playerName;
    const nameB = reportB.playerName;
    const warnings = [];
    if (peakA > 0 && peakA < 3) warnings.push(`${nameA}'s peak window is only ${peakA} season${peakA > 1 ? 's' : ''}`);
    if (peakB > 0 && peakB < 3) warnings.push(`${nameB}'s peak window is only ${peakB} season${peakB > 1 ? 's' : ''}`);
    if (warnings.length) shortPeakWarning = warnings.join(' · ') + ' — limited sample for comparison';
  }

  return { wonByA, wonByB, tied, overallCmp, overallMargin, overallA, overallB, volumeSignal, shortPeakWarning };
}

export default function CompareVerdict({ reportA, reportB, nameA, nameB, mode, loading, errorA, errorB }) {
  const verdict = useMemo(() => computeVerdict(reportA, reportB, mode), [reportA, reportB, mode]);

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
        <p className="compare-verdict-error-notice">Couldn&apos;t load graded report for {failingName}</p>
      </div>
    );
  }

  if (!verdict) return null;

  const { wonByA, wonByB, tied, overallCmp, overallA, overallB, overallMargin, volumeSignal, shortPeakWarning } = verdict;

  // Which side is the overall winner
  const aWinsOverall = overallCmp > 0;
  const bWinsOverall = overallCmp < 0;
  const tiedOverall = overallCmp === 0;

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

      {/* Adversarial overall grades */}
      {overallA && overallB && (
        <div className="compare-verdict-overall-row">
          <span className="compare-verdict-overall-side compare-verdict-overall-side--left">
            {aWinsOverall && <span className="compare-verdict-overall-arrow" aria-hidden="true">◀</span>}
            <GradeBadge grade={overallA} size={aWinsOverall || tiedOverall ? 'large' : 'small'} muted={bWinsOverall} />
          </span>
          <span className="compare-verdict-overall-label">OVERALL</span>
          <span className="compare-verdict-overall-side compare-verdict-overall-side--right">
            <GradeBadge grade={overallB} size={bWinsOverall || tiedOverall ? 'large' : 'small'} muted={aWinsOverall} />
            {bWinsOverall && <span className="compare-verdict-overall-arrow" aria-hidden="true">▶</span>}
          </span>
        </div>
      )}

      {overallMargin >= 3 && !tiedOverall && (
        <p className="compare-verdict-margin">{overallMargin} grades apart</p>
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
