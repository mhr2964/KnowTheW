import { gradeBand } from '../lib/gradeUtils';

export default function GradeBadge({ grade }) {
  if (!grade) return <span className="grade-badge grade-badge--empty">—</span>;
  const band = gradeBand(grade);
  return (
    <span className={`grade-badge grade-badge--${band}`}>{grade}</span>
  );
}
