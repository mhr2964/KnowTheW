import { useState, useEffect } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { formatStatValue } from '../lib/statFormatters';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmtDateShort(iso) {
  const d = new Date(iso);
  return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
}

function fmtTime(iso) {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
}

export default function TeamDashboard() {
  const { team } = useOutletContext() ?? {};

  const [rosterPreview, setRosterPreview] = useState([]);
  const [rosterCount, setRosterCount] = useState(null);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterError, setRosterError] = useState(false);

  const [statsPreview, setStatsPreview] = useState(null);
  const [historyPreview, setHistoryPreview] = useState(null);
  const [historyError, setHistoryError] = useState(false);

  const [schedulePreview, setSchedulePreview] = useState(null);
  const [scheduleError, setScheduleError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setRosterLoading(true);
    setRosterError(false);
    fetch(`/api/teams/${team.id}/roster`, { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => {
        const players = data.players ?? [];
        setRosterCount(players.length);
        setRosterPreview(players.slice(0, 3));
        setRosterLoading(false);
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          setRosterError(true);
          setRosterLoading(false);
        }
      });
    return () => controller.abort();
  }, [team.id]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/teams/${team.id}/stats`, { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => {
        const s = data?.stats ?? {};
        const ppg = s.ptsPg ?? null;
        const opp = s.oppPpg ?? null;
        if (ppg !== null || opp !== null) setStatsPreview({ ppg, opp });
      })
      .catch(() => {});
    return () => controller.abort();
  }, [team.id]);

  useEffect(() => {
    const controller = new AbortController();
    setHistoryError(false);
    fetch(`/api/teams/${team.id}/history`, { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => {
        const founded = data?.founded ?? null;
        const championships = data?.championships ?? [];
        const seasons = data?.seasons ?? [];
        // Only finished playoff appearances — exclude in-progress current season (seed set but no result yet).
        const lastPlayoff = seasons.find(s => s.playoffResult != null);
        setHistoryPreview({ founded, championships, lastPlayoff });
      })
      .catch(err => {
        if (err.name !== 'AbortError') setHistoryError(true);
      });
    return () => controller.abort();
  }, [team.id]);

  useEffect(() => {
    const controller = new AbortController();
    setScheduleError(false);
    const season = new Date().getFullYear();
    fetch(`/api/teams/${team.id}/schedule?season=${season}&seasontype=2`, { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => {
        const events = data?.empty ? [] : (data?.events ?? []);
        const todayMs = Date.now();
        const nextGame = events.find(e => new Date(e.date).getTime() > todayMs) ?? null;
        const lastGame = [...events].reverse().find(e => new Date(e.date).getTime() <= todayMs) ?? null;
        setSchedulePreview({ nextGame, lastGame, empty: data?.empty ?? false });
      })
      .catch(err => {
        if (err.name !== 'AbortError') setScheduleError(true);
      });
    return () => controller.abort();
  }, [team.id]);

  return (
    <div className="team-dashboard-grid">
      <div className="team-dashboard-card">
        <div className="team-dashboard-card-headline">
          Roster
          {!rosterLoading && rosterCount !== null && (
            <span className="team-dashboard-badge">{rosterCount} active</span>
          )}
        </div>
        <div className="team-dashboard-card-body">
          {rosterLoading && <p className="team-dashboard-placeholder">Loading...</p>}
          {!rosterLoading && rosterError && (
            <p className="team-dashboard-placeholder">Couldn&apos;t load roster preview.</p>
          )}
          {!rosterLoading && !rosterError && rosterPreview.length === 0 && (
            <p className="team-dashboard-placeholder">No roster data.</p>
          )}
          {!rosterLoading && !rosterError && rosterPreview.map(player => (
            <div key={player.id} className="team-dashboard-player-row">
              {player.headshot
                ? <img src={player.headshot} alt="" className="team-dashboard-headshot" />
                : <div className="team-dashboard-headshot team-dashboard-headshot-placeholder" aria-hidden="true">{player.name?.[0] ?? '?'}</div>
              }
              <span className="team-dashboard-player-name">{player.name}</span>
              <span className="team-dashboard-player-pos">{player.position}</span>
            </div>
          ))}
        </div>
        <Link to={`/team/${team.slug}/roster`} className="team-dashboard-card-link">View Roster →</Link>
      </div>

      <div className="team-dashboard-card">
        <div className="team-dashboard-card-headline">Stats</div>
        <div className="team-dashboard-card-body">
          {statsPreview ? (
            <>
              <div className="team-dashboard-player-row">
                <span className="team-dashboard-player-name">PPG</span>
                <span className="team-dashboard-player-pos">{formatStatValue('ptsPg', statsPreview.ppg)}</span>
              </div>
              <div className="team-dashboard-player-row">
                <span className="team-dashboard-player-name">Opp PPG</span>
                <span className="team-dashboard-player-pos">{formatStatValue('oppPpg', statsPreview.opp)}</span>
              </div>
            </>
          ) : (
            <p className="team-dashboard-placeholder">Stats preview unavailable.</p>
          )}
        </div>
        <Link to={`/team/${team.slug}/stats`} className="team-dashboard-card-link">View Stats →</Link>
      </div>

      <div className="team-dashboard-card">
        <div className="team-dashboard-card-headline">History</div>
        <div className="team-dashboard-card-body">
          {historyError ? (
            <p className="team-dashboard-placeholder">History preview unavailable.</p>
          ) : !historyPreview ? (
            <p className="team-dashboard-placeholder">Loading history…</p>
          ) : (
            <>
              <div className="team-dashboard-player-row">
                <span className="team-dashboard-player-name">Championships</span>
                <span className="team-dashboard-player-pos">
                  {historyPreview.championships.length > 0
                    ? `${historyPreview.championships.length} title${historyPreview.championships.length > 1 ? 's' : ''}`
                    : 'No championships yet'}
                </span>
              </div>
              {historyPreview.founded != null && (
                <div className="team-dashboard-player-row">
                  <span className="team-dashboard-player-name">Founded</span>
                  <span className="team-dashboard-player-pos">{historyPreview.founded}</span>
                </div>
              )}
              {historyPreview.lastPlayoff != null && (
                <div className="team-dashboard-player-row">
                  <span className="team-dashboard-player-name">Last playoff</span>
                  <span className="team-dashboard-player-pos">
                    {historyPreview.lastPlayoff.playoffResult != null
                      ? `${historyPreview.lastPlayoff.playoffResult} ${historyPreview.lastPlayoff.year}`
                      : `Made playoffs ${historyPreview.lastPlayoff.year}`}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
        <Link to={`/team/${team.slug}/history`} className="team-dashboard-card-link">View History →</Link>
      </div>

      <div className="team-dashboard-card">
        <div className="team-dashboard-card-headline">Next Up</div>
        <div className="team-dashboard-card-body">
          {scheduleError ? (
            <p className="team-dashboard-placeholder">Schedule preview unavailable.</p>
          ) : schedulePreview === null ? (
            <p className="team-dashboard-placeholder">Loading…</p>
          ) : schedulePreview.empty || (!schedulePreview.nextGame && !schedulePreview.lastGame) ? (
            <p className="team-dashboard-placeholder">Schedule not yet available.</p>
          ) : (
            <>
              {schedulePreview.nextGame && (
                <div className="team-dashboard-player-row">
                  <span className="team-dashboard-player-name team-schedule-card-label">Next</span>
                  <span className="team-schedule-card-atvs">{schedulePreview.nextGame.atVs}</span>
                  {schedulePreview.nextGame.opponent?.logo && (
                    <img
                      src={schedulePreview.nextGame.opponent.logo}
                      alt=""
                      className="team-schedule-card-logo"
                      aria-hidden="true"
                    />
                  )}
                  <span className="team-dashboard-player-pos">{schedulePreview.nextGame.opponent?.abbreviation}</span>
                  <span className="team-dashboard-player-pos">{fmtDateShort(schedulePreview.nextGame.date)}</span>
                  <span className="team-dashboard-player-pos">{fmtTime(schedulePreview.nextGame.date)}</span>
                </div>
              )}
              {schedulePreview.lastGame && (
                <div className="team-dashboard-player-row">
                  <span className="team-dashboard-player-name team-schedule-card-label">Last</span>
                  {schedulePreview.lastGame.result && (
                    <span className={`team-schedule-result-pill team-schedule-result-pill--${schedulePreview.lastGame.result.toLowerCase()}`}>
                      {schedulePreview.lastGame.result}
                    </span>
                  )}
                  {schedulePreview.lastGame.teamScore != null && (
                    <span className="team-dashboard-player-pos">
                      {schedulePreview.lastGame.teamScore}–{schedulePreview.lastGame.oppScore}
                    </span>
                  )}
                  <span className="team-dashboard-player-pos">{schedulePreview.lastGame.opponent?.abbreviation}</span>
                  <span className="team-dashboard-player-pos">{fmtDateShort(schedulePreview.lastGame.date)}</span>
                </div>
              )}
              {!schedulePreview.nextGame && schedulePreview.lastGame && (
                <p className="team-dashboard-placeholder team-schedule-season-complete">Season complete</p>
              )}
            </>
          )}
        </div>
        <Link to={`/team/${team.slug}/schedule`} className="team-dashboard-card-link">View Schedule →</Link>
      </div>
    </div>
  );
}
