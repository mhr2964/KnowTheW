'use strict';

// The latest WNBA season we treat as DONE — the cap for distributions and player fingerprints.
//
// Why: the percentile model must be reproducible. Feeding the in-progress season into league
// distributions (or a player's career aggregate) pulls live ESPN data that changes after every
// game, so the same player's percentiles jitter between server restarts. Excluding the in-progress
// season freezes the inputs to completed data.
//
// Heuristic: a WNBA season for year Y finishes in the fall (Finals ~Sept/Oct), so year Y is only
// "complete" late in the calendar year. We use November as the cutoff (conservative — avoids a
// just-finished season whose stats are still settling). Replace with schedule-based detection if
// the date heuristic ever drifts.
function latestCompletedSeason(now = new Date()) {
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12
  return month >= 11 ? year : year - 1;
}

module.exports = { latestCompletedSeason };
