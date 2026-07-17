'use strict';

// The latest WNBA season we treat as DONE — the cap for distributions and player fingerprints.
//
// Why: the percentile model must be reproducible. Feeding the in-progress season into league
// distributions (or a player's career aggregate) pulls live ESPN data that changes after every
// game, so the same player's percentiles jitter between server restarts. Excluding the in-progress
// season freezes the inputs to completed data.
//
// Heuristic: a WNBA season for year Y finishes in the fall (regular season ~Sept, Finals done by
// ~mid-Oct historically), so year Y is only "complete" late in the calendar year. November 1 is a
// deliberate, conservative cutoff — a real ~2-3 week safety margin every year, not a placeholder —
// and this has caused zero observed failures since it was introduced.
//
// There is no cheap way to make this schedule-based today: getTeamSchedule/getPlayoffSchedule
// (server/providers/SportsDataProvider.js) are per-team only, and there's no league-wide
// scoreboard/"is the season over" endpoint wired into the ESPN provider. If the Nov 1 cutoff is
// ever actually observed to be wrong for a real season (not hypothetically), the two real options
// are: (a) cheapest — treat one fixed team's schedule as a proxy, since every WNBA team plays the
// same season calendar, or (b) most correct but more work — add a real league-wide schedule/
// scoreboard provider method. Don't build either speculatively; this function would also need to
// become async (or cache a periodically-refreshed value) to use them, which is its own complexity
// not worth taking on without a concrete failure driving it.
function latestCompletedSeason(now = new Date()) {
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12
  return month >= 11 ? year : year - 1;
}

// Plain calendar-year check — distinct from latestCompletedSeason above. This answers "is this
// season over, so its PBP/advanced/on-off computation is safe to cache in Mongo" (past seasons
// don't change; the current season is still being played, so it must stay live). It is NOT the
// conservative jitter-safety cap distributions/fingerprints use — don't reach for this one there.
function isPastSeason(season, now = new Date()) {
  return Number(season) < now.getFullYear();
}

module.exports = { latestCompletedSeason, isPastSeason };
