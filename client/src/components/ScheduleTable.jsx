import { Fragment } from 'react';
import { useNavigate } from 'react-router-dom';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDateFull(iso) {
  const d = new Date(iso);
  return `${DAY_NAMES[d.getDay()]} ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
}

function formatDateShort(iso) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatTime(iso) {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
}

// odds is already oriented to THIS team's side (server-side perspective flip -- see
// routes/teams.js's /teams/:id/schedule and lib/gameOdds.js's orientOddsForTeam), so this is a
// straight display job: no home/away logic here. One representative sportsbook's line (see
// providers/balldontlie/odds.js -- books genuinely disagree, this isn't a consensus line), vendor
// named in the tooltip so the line reads as "according to DraftKings", not as gospel.
function formatOdds(odds) {
  if (!odds) return null;
  const spread = odds.spread != null ? (Number(odds.spread) > 0 ? `+${odds.spread}` : odds.spread) : null;
  const total = odds.total != null ? `O/U ${odds.total}` : null;
  return [spread, total].filter(Boolean).join(' · ');
}

// linkable: true only for a regular-season table on a BDL-covered season (playoffs are always
// ESPN-sourced, with no BDL game id at all -- see schedule.js's header comment; the box score
// route is BDL-only, see boxScore.js). Restricted further to completed games (event.result set) --
// an upcoming game has no box score data yet.
export default function ScheduleTable({ events, todayIso, dividerRef, linkable = false }) {
  const navigate = useNavigate();
  if (!events || events.length === 0) return null;

  const todayMs = new Date(todayIso).getTime();
  const firstFutureIdx = events.findIndex(e => new Date(e.date).getTime() > todayMs);

  const allPast = firstFutureIdx === -1;
  const allFuture = firstFutureIdx === 0;

  return (
    <div className="team-history-table-wrap">
      <table className="team-history-table team-schedule-table">
        <thead>
          <tr>
            <th className="team-history-cell team-history-cell--head">
              <span className="th-full">Date</span>
              <span className="th-short">Date</span>
            </th>
            <th className="team-history-cell team-history-cell--head">Opponent</th>
            <th className="team-history-cell team-history-cell--head">
              <span className="th-full">Result / Time</span>
              <span className="th-short">Result</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {allFuture && (
            <tr ref={dividerRef} className="team-schedule-divider-row">
              <td colSpan={3} className="team-schedule-divider-cell">
                <div className="team-schedule-divider-inner">
                  <span className="team-schedule-divider-rule" />
                  <span className="team-schedule-divider-label">
                    Season starts {formatDateFull(events[0].date)}
                  </span>
                  <span className="team-schedule-divider-rule" />
                </div>
              </td>
            </tr>
          )}

          {events.map((event, idx) => {
            const isFuture = new Date(event.date).getTime() > todayMs;
            const showDivider = !allFuture && !allPast && idx === firstFutureIdx;

            return (
              <Fragment key={event.id}>
                {showDivider && (
                  <tr ref={dividerRef} className="team-schedule-divider-row">
                    <td colSpan={3} className="team-schedule-divider-cell">
                      <div className="team-schedule-divider-inner">
                        <span className="team-schedule-divider-rule" />
                        <span className="team-schedule-divider-label">Next up</span>
                        <span className="team-schedule-divider-rule" />
                      </div>
                    </td>
                  </tr>
                )}
                <tr
                  className={`team-history-row team-schedule-row${showDivider ? ' team-schedule-row--next' : ''}${linkable && !isFuture && event.result ? ' team-schedule-row--linkable' : ''}`}
                  onClick={linkable && !isFuture && event.result ? () => navigate(`/game/${event.id}`) : undefined}
                >
                  <td className="team-history-cell team-schedule-cell">
                    <span className="th-full">{formatDateFull(event.date)}</span>
                    <span className="th-short">{formatDateShort(event.date)}</span>
                  </td>
                  <td className="team-history-cell team-schedule-cell team-schedule-cell--opponent">
                    <div className="team-schedule-opponent-inner">
                      <span className="team-schedule-atvs">{event.atVs}</span>
                      {event.opponent?.logo && (
                        <img
                          src={event.opponent.logo}
                          alt=""
                          className="team-schedule-opp-logo"
                          aria-hidden="true"
                        />
                      )}
                      <span className="team-schedule-opp-abbr">{event.opponent?.abbreviation ?? '—'}</span>
                    </div>
                  </td>
                  <td className="team-history-cell team-schedule-cell">
                    {isFuture ? (
                      <span className="team-schedule-gametime-wrap">
                        <span className="team-schedule-gametime">{formatTime(event.date)}</span>
                        {event.odds && (
                          <span className="team-schedule-odds" title={`Odds via ${event.odds.vendor}`}>
                            {formatOdds(event.odds)}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="team-schedule-result-wrap">
                        {event.result && (
                          <span className={`team-schedule-result-pill team-schedule-result-pill--${event.result.toLowerCase()}`}>
                            {event.result}
                          </span>
                        )}
                        {event.teamScore != null && event.oppScore != null && (
                          <span className="team-schedule-score">
                            {event.teamScore}–{event.oppScore}
                          </span>
                        )}
                        <span className="th-full team-schedule-final">Final</span>
                      </span>
                    )}
                  </td>
                </tr>
              </Fragment>
            );
          })}

          {allPast && (
            <tr className="team-schedule-footer-row">
              <td colSpan={3} className="team-schedule-footer-cell">Season complete</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
