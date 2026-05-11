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

  // Short peak window warning — either player < 3 seasons
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

export default function CompareVerdict({ reportA, reportB, nameA, nameB, mode, loading }) {
  const verdict = useMemo(() => computeVerdict(reportA, reportB, mode), [reportA, reportB, mode]);

  if (loading) {
    return (
      <div className="compare-verdict compare-verdict--skeleton">
        <div className="compare-verdict-skeleton-line" />
        <div className="compare-verdict-skeleton-line compare-verdict-skeleton-line--short" />
      </div>
    );
  }

  if (!verdict) return null;

  const { wonByA, wonByB, tied, overallCmp, overallA, overallB, overallMargin, volumeSignal, shortPeakWarning } = verdict;
  const winner = overallCmp > 0 ? nameA : overallCmp < 0 ? nameB : null;
  const loserGrade = overallCmp > 0 ? overallB : overallCmp < 0 ? overallA : null;
  const winnerGrade = overallCmp > 0 ? overallA : overallCmp < 0 ? overallB : null;

  return (
    <div className="compare-verdict">
      <p className="compare-verdict-label">AT A GLANCE</p>

      <div className="compare-verdict-cats">
        <span>{nameA} wins <strong>{wonByA}</strong></span>
        <span className="compare-verdict-sep">·</span>
        <span>{nameB} wins <strong>{wonByB}</strong></span>
        {tied > 0 && <>
          <span className="compare-verdict-sep">·</span>
          <span>Tie <strong>{tied}</strong></span>
        </>}
      </div>

      <div className="compare-verdict-overall">
        <span className="compare-verdict-overall-label">Overall</span>
        {overallA && <GradeBadge grade={overallA} />}
        <span className="compare-verdict-vs-arrow">vs</span>
        {overallB && <GradeBadge grade={overallB} />}
        {winner && <span className="compare-verdict-winner">{winner} wins</span>}
        {overallCmp === 0 && <span className="compare-verdict-winner">Tied</span>}
        {loserGrade && winnerGrade && overallMargin >= 3 && (
          <span className="compare-verdict-margin">
            ({overallMargin} grades apart)
          </span>
        )}
      </div>

      {volumeSignal && (
        <p className="compare-verdict-volume">{volumeSignal}</p>
      )}

      {shortPeakWarning && (
        <p className="compare-verdict-short-peak">Note: {shortPeakWarning}.</p>
      )}
    </div>
  );
}
