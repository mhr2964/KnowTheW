export function formatStatValue(key, val) {
  if (val === null || val === undefined) return '—';
  const lower = key.toLowerCase();
  if (lower.includes('percentage') || lower.includes('pct')) {
    const n = parseFloat(val);
    if (isNaN(n)) return '—';
    const pct = n <= 1 ? n * 100 : n;
    return `${pct.toFixed(1)}%`;
  }
  if (lower.includes('pergame') || lower.includes('pg') || lower.includes('average')) {
    const n = parseFloat(val);
    if (isNaN(n)) return '—';
    return Number(n.toFixed(1)).toString();
  }
  const n = Number(val);
  if (!isNaN(n) && typeof val === 'number') {
    return Number.isInteger(n) ? String(n) : n.toFixed(1);
  }
  return String(val);
}
