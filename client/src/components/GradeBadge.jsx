import { gradeBand } from '../lib/gradeUtils';

export default function GradeBadge({ grade, size }) {
  const sizeClass = size === 'large' ? ' grade-badge--large' : '';
  if (!grade) return <span className={`grade-badge grade-badge--empty${sizeClass}`}>—</span>;
  const band = gradeBand(grade);
  return (
    <span className={`grade-badge grade-badge--${band}${sizeClass}`}>{grade}</span>
  );
}
