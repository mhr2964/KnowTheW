import { gradeBand } from '../lib/gradeUtils';

export default function GradeBadge({ grade, size, winner }) {
  const sizeClass = size === 'large' ? ' grade-badge--large' : size === 'small' ? ' grade-badge--small' : '';
  const winnerClass = winner ? ' grade-badge--winner' : '';
  if (!grade) return <span className={`grade-badge grade-badge--empty${sizeClass}${winnerClass}`}>—</span>;
  const band = gradeBand(grade);
  return (
    <span className={`grade-badge grade-badge--${band}${sizeClass}${winnerClass}`}>{grade}</span>
  );
}
