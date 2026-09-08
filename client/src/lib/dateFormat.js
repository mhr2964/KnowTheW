// Shared date-formatting helpers -- extracted from ScheduleTable.jsx, OddsHubPage.jsx,
// ScheduleHubPage.jsx, PlayoffsHubPage.jsx, and TeamDashboard.jsx, each of which had its own
// verbatim (or near-verbatim) copy of DAY_NAMES/MONTH_NAMES and a formatDate function. Three
// genuinely distinct formats are kept as separate named exports rather than collapsed into one
// "smart" formatter with options, since each callsite already knows which one it wants and a
// options-bag would just move the duplication into the call args instead of removing it.
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "Sun Sep 17" -- day-of-week + month name + day.
export function formatDateWithDay(iso) {
  const d = new Date(iso);
  return `${DAY_NAMES[d.getDay()]} ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
}

// "Sep 17" -- month name + day, no day-of-week (used where the day-of-week isn't the point, e.g.
// a season-long list already grouped chronologically).
export function formatDateMonthDay(iso) {
  const d = new Date(iso);
  return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
}

// "9/17" -- compact numeric, for the narrowest mobile columns.
export function formatDateNumeric(iso) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function formatTime(iso) {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
}
