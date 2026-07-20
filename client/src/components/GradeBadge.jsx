import { gradeBand } from '../lib/gradeUtils';

// winnerSide: 'a' | 'b' | null — colors the winner glow to match that side's compare color
// (--accent for A, --compare-b for B) instead of a single fixed winner color, so the badge itself
// carries the same side-identity as the magnitude bar and radar overlay next to it.
export default function GradeBadge({ grade, size, winnerSide }) {
  const sizeClass = size === 'large' ? ' grade-badge--large' : size === 'small' ? ' grade-badge--small' : '';
  const winnerClass = winnerSide ? ` grade-badge--winner grade-badge--winner-${winnerSide}` : '';
  if (!grade) return <span className={`grade-badge grade-badge--empty${sizeClass}${winnerClass}`}>—</span>;
  const band = gradeBand(grade);
  return (
    <span className={`grade-badge grade-badge--${band}${sizeClass}${winnerClass}`}>{grade}</span>
  );
}
