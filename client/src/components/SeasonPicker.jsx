import { getCurrentSeason } from '../lib/currentSeason';

export default function SeasonPicker({ value, onChange, foundedYear, disabled }) {
  const currentSeason = getCurrentSeason();
  const top = Math.max(foundedYear, currentSeason);

  const years = [];
  for (let y = top; y >= foundedYear; y--) {
    years.push(y);
  }
  if (years.length === 0) years.push(value ?? foundedYear);
  if (!years.includes(value)) years.unshift(value);

  return (
    <select
      className="team-header-season-picker"
      value={value}
      disabled={disabled}
      title={disabled ? 'History spans all seasons' : undefined}
      onChange={e => onChange(parseInt(e.target.value, 10))}
    >
      {years.map(y => (
        <option key={y} value={y}>{y}</option>
      ))}
    </select>
  );
}
