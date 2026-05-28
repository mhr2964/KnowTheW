import HeaderTooltip from './HeaderTooltip';
import { HIDDEN, LABELS, PCT_COLS, PCT100_COLS } from '../lib/statsColumns';
import { STAT_DEFINITIONS } from '../lib/statDefinitions';

export const LEFT_COLS = new Set(['SEASON_ID', 'TEAM_ABBREVIATION']);

export function fmt(key, val) {
  if (val === null || val === undefined || val === '') return '—';
  if (PCT_COLS.has(key)) {
    if (typeof val !== 'number') return '—';
    return val.toFixed(3).replace(/^0\./, '.');
  }
  if (PCT100_COLS.has(key)) {
    if (typeof val !== 'number') return '—';
    return (val * 100).toFixed(1);
  }
  if (typeof val === 'number' && !Number.isInteger(val)) return val.toFixed(1);
  return String(val);
}

export function ordinal(n) {
  if (n === null || n === undefined) return null;
  const v = n % 100;
  const suffix = (v >= 11 && v <= 13) ? 'th' : (['th','st','nd','rd'][n % 10] || 'th');
  return `${n}${suffix}`;
}

export function percColor(p) {
  if (p === null || p === undefined) return undefined;
  const alpha = (Math.abs(p - 50) / 50) * 0.5;
  if (p > 50) return `rgba(34,197,94,${alpha.toFixed(3)})`;
  if (p < 50) return `rgba(239,68,68,${alpha.toFixed(3)})`;
  return undefined;
}

export default function BrefTable({ regular, career, percentiles, viewMode = 'perGame', emptyMessage, headerGroups }) {
  if (!regular) return <p className="stats-na">{emptyMessage ?? 'No data available.'}</p>;
  const { headers, rows } = regular;
  const cols = headers
    .map((h, i) => ({ key: h, idx: i, label: LABELS[h] ?? h }))
    .filter(c => !HIDDEN.has(c.key));
  const careerRow = career?.rows?.[0];

  return (
    <div className="bref-wrap">
      <table className="bref-table">
        <thead>
          {headerGroups && (
            <tr className="bref-group-row">
              {headerGroups.map((g, i) => (
                <th key={i} colSpan={g.span} className={g.label ? 'bref-group-header' : 'bref-group-empty'}>
                  {g.label}
                </th>
              ))}
            </tr>
          )}
          <tr>{cols.map(c => (
            <th key={c.key}>
              <HeaderTooltip label={c.label} definition={STAT_DEFINITIONS[c.key]} />
            </th>
          ))}</tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => {
            const seasonPerc = percentiles?.[String(row[0])]?.[viewMode];
            return (
              <tr key={ri}>
                {cols.map(c => {
                  const raw  = row[c.idx];
                  const perc = seasonPerc?.[c.key];
                  return (
                    <td
                      key={c.key}
                      className={LEFT_COLS.has(c.key) ? 'td-l' : ''}
                      style={{ backgroundColor: percColor(perc) }}
                      title={perc !== null && perc !== undefined ? `${ordinal(perc)} percentile` : undefined}
                    >
                      {fmt(c.key, raw)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
          {careerRow && (
            <tr className="career-row">
              {cols.map(c => (
                <td key={c.key} className={LEFT_COLS.has(c.key) ? 'td-l' : ''}>
                  {c.key === 'SEASON_ID' ? 'Career'
                    : c.key === 'TEAM_ABBREVIATION' ? ''
                    : fmt(c.key, careerRow[c.idx])}
                </td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
