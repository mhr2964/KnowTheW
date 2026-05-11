export const GRADE_ORDER = ['F', 'D', 'D+', 'C-', 'C', 'C+', 'B-', 'B', 'B+', 'A-', 'A', 'A+'];

export function gradeIndex(letter) {
  return GRADE_ORDER.indexOf(letter);
}

export function compareGrades(a, b) {
  const ia = gradeIndex(a);
  const ib = gradeIndex(b);
  if (ia === -1 || ib === -1) return 0;
  if (ia > ib) return 1;
  if (ia < ib) return -1;
  return 0;
}

export function gradeBand(letter) {
  const i = gradeIndex(letter);
  if (i >= 9) return 'top';    // A- A A+
  if (i >= 6) return 'high';   // B- B B+
  if (i >= 3) return 'mid';    // C- C C+
  if (i >= 1) return 'low';    // D D+
  return 'bottom';             // F
}
