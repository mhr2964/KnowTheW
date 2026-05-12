import { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import ScheduleTable from '../components/ScheduleTable';

export default function TeamSchedulePage() {
  const { team, season, isCurrentSeason } = useOutletContext() ?? {};
  const isDefunct = !!team?.defunct;

  const [regularEvents, setRegularEvents] = useState([]);
  const [playoffEvents, setPlayoffEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const dividerRef = useRef(null);
  const todayIso = new Date().toISOString();

  // For past seasons the season is complete — always fetch playoffs to show full picture.
  const needsPlayoffs =
    !isCurrentSeason ||
    (team?.seedLabel != null && team.seedLabel !== '') ||
    new Date().getMonth() >= 8;

  useEffect(() => {
    if (!team?.id || isDefunct) return;

    const controller = new AbortController();
    setLoading(true);
    setError(false);
    setRegularEvents([]);
    setPlayoffEvents([]);

    const regularFetch = fetch(
      `/api/teams/${team.id}/schedule?season=${season}&seasontype=2`,
      { signal: controller.signal }
    ).then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); });

    const fetches = needsPlayoffs
      ? Promise.all([
          regularFetch,
          fetch(
            `/api/teams/${team.id}/schedule?season=${season}&seasontype=3`,
            { signal: controller.signal }
          ).then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); }),
        ])
      : regularFetch.then(d => [d, null]);

    fetches
      .then(([regData, poData]) => {
        setRegularEvents(regData?.empty ? [] : (regData?.events ?? []));
        setPlayoffEvents(poData?.empty ? [] : (poData?.events ?? []));
        setLoading(false);
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          setError(true);
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [team?.id, season, needsPlayoffs, isDefunct]);

  useEffect(() => {
    if (!loading && isCurrentSeason && dividerRef.current) {
      dividerRef.current.scrollIntoView({ block: 'center', behavior: 'auto' });
    }
  }, [loading, isCurrentSeason]);

  if (isDefunct) return (
    <div className="team-spoke-content">
      <p className="status-msg">Schedule data is not available for historical franchises.</p>
    </div>
  );

  if (loading) return (
    <div className="team-spoke-content">
      <p className="status-msg">Loading schedule…</p>
    </div>
  );

  if (error) return (
    <div className="team-spoke-content">
      <p className="status-msg error">Couldn&apos;t load schedule.</p>
    </div>
  );

  return (
    <div className="team-spoke-content team-schedule-page">
      <h3 className="team-stats-season">{season} Schedule</h3>

      {regularEvents.length === 0 && playoffEvents.length === 0 ? (
        <p className="status-msg">Schedule not yet available.</p>
      ) : (() => {
        // If the regular-season list has any future game, the divider belongs on the
        // regular-season table. Otherwise (regular season empty or fully past), give the
        // divider to the playoff table so "today" still scrolls into view.
        const todayMs = Date.now();
        const regularHasFuture = regularEvents.some(e => new Date(e.date).getTime() > todayMs);
        return (
          <>
            <ScheduleTable
              events={regularEvents}
              todayIso={todayIso}
              dividerRef={regularHasFuture ? dividerRef : null}
            />

            {playoffEvents.length > 0 && (
              <>
                <h4 className="team-schedule-subheader">Playoffs</h4>
                <ScheduleTable
                  events={playoffEvents}
                  todayIso={todayIso}
                  dividerRef={regularHasFuture ? null : dividerRef}
                />
              </>
            )}
          </>
        );
      })()}
    </div>
  );
}
