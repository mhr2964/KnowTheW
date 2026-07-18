import { useMemo, useState } from 'react';
import HeaderTooltip from './HeaderTooltip';
import { HIDDEN, LABELS, PCT_COLS, PCT100_COLS } from '../lib/statsColumns';
import { STAT_DEFINITIONS } from '../lib/statDefinitions';

export const LEFT_COLS = new Set(['SEASON_ID', 'TEAM_ABBREVIATION', 'date', 'opp', 'result']);

// kind: 'num' (plain) | 'pct' (0-1 fraction, renders .XXX) | 'pct100' (0-1 internally, renders XX.X)
// | 'date' (ISO date string, renders "Aug 12" — sorts correctly as a string since ISO order is
// chronological order, so no separate sort-key/display-value split is needed).
export function fmt(kind, val) {
  if (val === null || val === undefined || val === '') return '—';
  if (kind === 'pct') {
    if (typeof val !== 'number') return '—';
    return val.toFixed(3).replace(/^0\./, '.');
  }
  if (kind === 'pct100') {
    if (typeof val !== 'number') return '—';
    return (val * 100).toFixed(1);
  }
  if (kind === 'date') {
    const d = new Date(val);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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

// Missing values always sort to the bottom regardless of direction, so an empty cell never
// reads as "highest" when a column is sorted descending.
function compareRows(a, b, idx, dir) {
  const av = a[idx];
  const bv = b[idx];
  const aEmpty = av === null || av === undefined || av === '';
  const bEmpty = bv === null || bv === undefined || bv === '';
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;
  if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
  return String(av).localeCompare(String(bv)) * dir;
}

function toCsvCell(val) {
  const s = val === null || val === undefined ? '' : String(val);
  return /["\n,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(filename, cols, rows, careerRow) {
  const lines = [cols.map(c => toCsvCell(c.label)).join(',')];
  for (const row of rows) {
    lines.push(cols.map(c => toCsvCell(fmt(c.kind, row[c.idx]))).join(','));
  }
  if (careerRow) {
    lines.push(cols.map(c => toCsvCell(
      c.key === 'SEASON_ID' ? 'Career' : c.key === 'TEAM_ABBREVIATION' ? '' : fmt(c.kind, careerRow[c.idx])
    )).join(','));
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function BrefTable({ regular, career, percentiles, viewMode = 'perGame', emptyMessage, headerGroups, cellClassName, filename }) {
  const [sort, setSort] = useState(null); // {key, dir: 1|-1} | null

  // Server-emitted `columns` ({key,label,kind}) is the primary path (detailed-stats,
  // advanced-pbp-all). A bare `headers` array is still a fallback for PlayByPlayTab, whose
  // PBP_TABLE_HEADERS keys live outside statColumns.js and aren't part of this migration.
  const { columns, headers, rows } = regular ?? {};
  const cols = columns
    ? columns.map((c, i) => ({ ...c, idx: i }))
    : headers
        ? headers
            .map((h, i) => ({ key: h, idx: i, label: LABELS[h] ?? h, kind: PCT_COLS.has(h) ? 'pct' : PCT100_COLS.has(h) ? 'pct100' : 'num' }))
            .filter(c => !HIDDEN.has(c.key))
        : [];
  const careerRow = career?.rows?.[0];

  const sortedRows = useMemo(() => {
    if (!rows || !sort) return rows;
    const col = cols.find(c => c.key === sort.key);
    if (!col) return rows;
    return [...rows].sort((a, b) => compareRows(a, b, col.idx, sort.dir));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sort]);

  const toggleSort = (key) => setSort(prev => {
    if (!prev || prev.key !== key) return { key, dir: -1 };
    if (prev.dir === -1) return { key, dir: 1 };
    return null;
  });

  if (!regular) return <p className="stats-na">{emptyMessage ?? 'No data available.'}</p>;

  return (
    <>
      <div className="bref-toolbar">
        <button
          type="button"
          className="btn-ghost bref-export-btn"
          onClick={() => downloadCsv(filename ?? 'stats.csv', cols, sortedRows, careerRow)}
        >
          Export CSV
        </button>
      </div>
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
              <th
                key={c.key}
                className="bref-th-sortable"
                aria-sort={sort?.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}
                onClick={() => toggleSort(c.key)}
              >
                <HeaderTooltip label={c.label} definition={STAT_DEFINITIONS[c.key]} />
                <span className="bref-sort-indicator">
                  {sort?.key === c.key ? (sort.dir === 1 ? '▲' : '▼') : ''}
                </span>
              </th>
            ))}</tr>
          </thead>
          <tbody>
            {sortedRows.map((row, ri) => {
              const seasonPerc = percentiles?.[String(row[0])]?.[viewMode];
              return (
                <tr key={ri}>
                  {cols.map(c => {
                    const raw  = row[c.idx];
                    const perc = seasonPerc?.[c.key];
                    const extraClass = cellClassName?.(row, c) ?? '';
                    return (
                      <td
                        key={c.key}
                        className={[LEFT_COLS.has(c.key) ? 'td-l' : '', extraClass].filter(Boolean).join(' ')}
                        style={{ backgroundColor: percColor(perc) }}
                        title={perc !== null && perc !== undefined ? `${ordinal(perc)} percentile` : undefined}
                      >
                        {fmt(c.kind, raw)}
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
                      : fmt(c.kind, careerRow[c.idx])}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
