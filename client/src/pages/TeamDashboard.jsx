import { useState, useEffect } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { formatStatValue } from '../lib/statFormatters';

export default function TeamDashboard() {
  const { team } = useOutletContext() ?? {};

  const [rosterPreview, setRosterPreview] = useState([]);
  const [rosterCount, setRosterCount] = useState(null);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterError, setRosterError] = useState(false);

  const [statsPreview, setStatsPreview] = useState(null);
  const [historyPreview, setHistoryPreview] = useState(null);
  const [historyError, setHistoryError] = useState(false);

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
                ? <img src={player.headshot} alt={player.name} className="team-dashboard-headshot" />
                : <div className="team-dashboard-headshot team-dashboard-headshot-placeholder">{player.name?.[0] ?? '?'}</div>
              }
              <span className="team-dashboard-player-name">{player.name}</span>
              <span className="team-dashboard-player-pos">{player.position}</span>
            </div>
          ))}
        </div>
        <Link to={`/team/${team.slug}/roster`} className="team-dashboard-card-link">View Roster →</Link>
      </div>

      <div className="team-dashboard-card">
        <div className="team-dashboard-card-headline">Team Stats</div>
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
        <div className="team-dashboard-card-headline">Franchise History</div>
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
                  <span className="team-dashboard-player-pos">Est. {historyPreview.founded}</span>
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
    </div>
  );
}
