// Ordinal formatting — pure, source-agnostic. Lived inside espnClient until M9; it has nothing to
// do with ESPN, so it sits here where both the ESPN client and seasonInfo can share it.

/**
 * Format a 1-based rank as an ordinal label, e.g. 1 → "1st", 2 → "2nd", 11 → "11th".
 * Returns null for non-finite input so callers can omit the field rather than render "NaNth".
 * @param {number} n
 * @returns {string|null}
 */
function formatSeedLabel(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return null;
  const v = n % 100;
  const suffix = (v >= 11 && v <= 13) ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] || 'th');
  return `${n}${suffix}`;
}

module.exports = { formatSeedLabel };
