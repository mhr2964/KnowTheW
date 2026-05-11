import { Fragment } from 'react';

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

export default function ScheduleTable({ events, todayIso, dividerRef }) {
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
                        <span className="team-schedule-divider-label">
                          Next up &middot; {formatDateShort(todayIso)}
                        </span>
                        <span className="team-schedule-divider-rule" />
                      </div>
                    </td>
                  </tr>
                )}
                <tr className="team-history-row team-schedule-row">
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
                      <span className="team-schedule-gametime">{formatTime(event.date)}</span>
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
