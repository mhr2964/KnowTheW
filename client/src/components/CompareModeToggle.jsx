const MODES = [
  { key: 'peak',    label: 'Peak' },
  { key: 'career',  label: 'Full Career' },
  { key: 'playoffs', label: 'Playoffs' },
];

function yearRangeLabel(range) {
  if (!range || range.length < 2) return null;
  return `${range[0]}–${range[1]}`;
}

export default function CompareModeToggle({ mode, onChange, reportA, reportB, loadingA, loadingB }) {
  const peakSeasonsA = reportA?.peakSeasons;
  const peakSeasonsB = reportB?.peakSeasons;
  const nameA = reportA?.playerName;
  const nameB = reportB?.playerName;

  const showPeakWindow = mode === 'peak' && (peakSeasonsA?.length || peakSeasonsB?.length || loadingA || loadingB);

  const careerRangeA = reportA?.careerYearRange;
  const careerRangeB = reportB?.careerYearRange;
  const showCareerWindow = mode === 'career' && (careerRangeA || careerRangeB || loadingA || loadingB);

  const showPlayoffsWindow = mode === 'playoffs' && (careerRangeA || careerRangeB || loadingA || loadingB);

  function buildWindowLine(rangeA, rangeB, labelFnA, labelFnB) {
    const partA = rangeA
      ? `${nameA ?? 'Player A'}: ${labelFnA(rangeA)}`
      : loadingA ? `${nameA ?? 'Player A'}: …` : '';
    const partB = rangeB
      ? `${nameB ?? 'Player B'}: ${labelFnB(rangeB)}`
      : loadingB ? `${nameB ?? 'Player B'}: …` : '';
    if (partA && partB) return `${partA}  ·  ${partB}`;
    return partA || partB;
  }

  return (
    <div className="compare-mode-toggle-wrap">
      <div className="compare-mode-toggle">
        {MODES.map(m => (
          <button
            key={m.key}
            type="button"
            className={`compare-mode-btn${mode === m.key ? ' active' : ''}`}
            aria-pressed={mode === m.key}
            onClick={() => onChange(m.key)}
          >
            {m.label}
          </button>
        ))}
      </div>

      {showPeakWindow && (
        <p className="compare-mode-peak-window">
          {peakSeasonsA?.length
            ? `${nameA ?? 'Player A'}: ${peakSeasonsA[0]}–${peakSeasonsA[peakSeasonsA.length - 1]}`
            : loadingA ? `${nameA ?? 'Player A'}: …` : ''}
          {(peakSeasonsA?.length || loadingA) && (peakSeasonsB?.length || loadingB) ? '  ·  ' : ''}
          {peakSeasonsB?.length
            ? `${nameB ?? 'Player B'}: ${peakSeasonsB[0]}–${peakSeasonsB[peakSeasonsB.length - 1]}`
            : loadingB ? `${nameB ?? 'Player B'}: …` : ''}
        </p>
      )}

      {showCareerWindow && (
        <p className="compare-mode-peak-window">
          {buildWindowLine(
            careerRangeA, careerRangeB,
            yearRangeLabel, yearRangeLabel,
          )}
        </p>
      )}

      {showPlayoffsWindow && (
        <p className="compare-mode-peak-window">
          {buildWindowLine(
            careerRangeA, careerRangeB,
            r => yearRangeLabel(r) ?? '—',
            r => yearRangeLabel(r) ?? '—',
          )}
        </p>
      )}
    </div>
  );
}
