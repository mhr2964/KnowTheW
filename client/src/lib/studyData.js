// Shared "Study this table" deck builder. Generalizes what DetailedStats.jsx originally hand-rolled
// for the 5 generic BrefTable tabs so every tab (including the 5 that render their own raw table)
// can build a deck the same way -- see BrefTable.jsx's own dual-path column resolution, which this
// mirrors: a server-emitted `columns` ({key,label,kind}) array is used as-is; a bare `headers` string
// array (PlayByPlayTab) is mapped through the same LABELS/PCT_COLS/PCT100_COLS/HIDDEN lookup BrefTable
// itself uses, preserving each column's original index so `rows` (indexed by original header
// position, not post-filter position) still line up after HIDDEN columns are dropped.
import { HIDDEN, LABELS, PCT_COLS, PCT100_COLS } from './statsColumns';

function resolveColumns(columns, headers) {
  if (columns) return columns.map((c, i) => ({ ...c, idx: i }));
  if (!headers) return [];
  return headers
    .map((h, i) => ({ key: h, idx: i, label: LABELS[h] ?? h, kind: PCT_COLS.has(h) ? 'pct' : PCT100_COLS.has(h) ? 'pct100' : 'num' }))
    .filter(c => !HIDDEN.has(c.key));
}

// StudyFlow only special-cases type:'pct' (0-1 fraction -> "51.2%"); pct100 values fall through to
// its plain-number formatting, same as 'num' always did.
export function buildStudyDeck({ columns, headers, rows, careerRows = [] }) {
  const cols = resolveColumns(columns, headers);
  const allRows = [...(rows ?? []), ...careerRows];
  const data = allRows.map(row => Object.fromEntries(cols.map(c => [c.key, row[c.idx]])));
  const studyColumns = cols.map(c => ({ key: c.key, label: c.label, type: c.kind === 'pct' ? 'pct' : 'text' }));
  return { data, columns: studyColumns };
}
