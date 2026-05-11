import { SUMMARY_STATS, SUMMARY_KEY_MAP, buildCareerMap, pickLeader } from '../lib/compareStats';
import { fmt } from './BrefTable';

function SummaryValue({ value, isLeader }) {
  return (
    <span className={isLeader ? 'compare-leader' : undefined}>
      {value}
    </span>
  );
}

export default function CompareSummary({ statsA, statsB, emptyA, emptyB }) {
  const careerA = statsA?.perGame?.regularCareer ?? null;
  const careerB = statsB?.perGame?.regularCareer ?? null;
  const mapA = buildCareerMap(careerA);
  const mapB = buildCareerMap(careerB);

  return (
    <div className="compare-summary">
      <div className="compare-summary-header">
        <span className="compare-summary-col-label">Player A</span>
        <span className="compare-summary-col-label compare-summary-stat-label">Stat</span>
        <span className="compare-summary-col-label compare-summary-col-label-b">Player B</span>
      </div>
      {SUMMARY_STATS.map(stat => {
        const rawKey = SUMMARY_KEY_MAP[stat];
        const rawA = mapA?.[rawKey];
        const rawB = mapB?.[rawKey];
        const leader = (emptyA || emptyB) ? null : pickLeader(mapA, mapB, stat);

        const fmtA = emptyA ? '—' : (rawA !== undefined ? fmt(rawKey, rawA) : '—');
        const fmtB = emptyB ? '—' : (rawB !== undefined ? fmt(rawKey, rawB) : '—');

        const indicator = leader === 'a' ? '▶' : leader === 'b' ? '◀' : '—';

        return (
          <div key={stat} className="compare-summary-row">
            <div className="compare-summary-cell compare-summary-cell-a">
              <SummaryValue value={fmtA} isLeader={leader === 'a'} />
            </div>
            <div className="compare-summary-indicator">
              <span className="compare-summary-stat">{stat}</span>
              <span className={`compare-summary-arrow${leader ? ' compare-summary-arrow-active' : ''}`}>
                {indicator}
              </span>
            </div>
            <div className="compare-summary-cell compare-summary-cell-b">
              <SummaryValue value={fmtB} isLeader={leader === 'b'} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
