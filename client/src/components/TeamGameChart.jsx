import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const MAX_MARGIN_FOR_SCALE = 30; // clamp bar height so one blowout doesn't flatten every other bar
// Same floor TeamSchedulePage.jsx uses to gate its own linkable rows -- a pre-2008 game has no BDL
// box-score id to link to.
const BOX_SCORE_MIN_SEASON = 2008;

function Bar({ event, show, linkable, navigate }) {
  if (!show || !event) return <div className="team-game-chart-spacer" />;
  const margin = Math.abs((event.teamScore ?? 0) - (event.oppScore ?? 0));
  const heightPct = Math.max(10, Math.min(100, (margin / MAX_MARGIN_FOR_SCALE) * 100));
  return (
    <button
      type="button"
      className={`team-game-chart-bar team-game-chart-bar--${show}`}
      style={{ height: `${heightPct}%` }}
      title={`${event.atVs} ${event.opponent?.abbreviation ?? ''} · ${event.result} ${event.teamScore}–${event.oppScore}`}
      onClick={linkable ? () => navigate(`/game/${event.id}`) : undefined}
      disabled={!linkable}
    />
  );
}

// Season-shape-at-a-glance win/loss margin chart (TeamDashboard.jsx) -- bbref shows this on every
// team-season page; this site had the same per-game teamScore/oppScore data (team schedule) but
// never visualized it. Regular season only, same scope decision four-factors/shotchart already made
// for this team page. Two stacked halves (win bars growing up into a shared middle baseline, loss
// bars growing down from it) rather than a single flex row, because flexbox has no built-in way to
// diverge bars from a shared zero-line in one row -- each half renders every game in the same
// left-to-right order, with an invisible spacer standing in for whichever result doesn't belong in
// that half, so the two halves' bars stay column-aligned. Hand-rolled divs, not a charting library
// -- this is 13 teams x ~44 games, not worth a dependency for.
export default function TeamGameChart({ teamId, season }) {
  const navigate = useNavigate();
  const [events, setEvents] = useState(null);

  useEffect(() => {
    if (!teamId) return;
    const controller = new AbortController();
    setEvents(null);
    fetch(`/api/teams/${teamId}/schedule?season=${season}&seasontype=2`, { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => setEvents(data?.empty ? [] : (data?.events ?? []).filter(e => e.result != null)))
      .catch(err => { if (err.name !== 'AbortError') setEvents([]); });
    return () => controller.abort();
  }, [teamId, season]);

  if (!events || events.length === 0) return null;
  const linkable = season >= BOX_SCORE_MIN_SEASON;

  return (
    <div className="team-game-chart">
      <div className="team-game-chart-label">
        Game Results — height is margin of victory{linkable ? ', click for box score' : ''}
      </div>
      <div className="team-game-chart-bars">
        <div className="team-game-chart-half team-game-chart-half--top">
          {events.map(e => <Bar key={e.id} event={e} show={e.result === 'W' && 'win'} linkable={linkable} navigate={navigate} />)}
        </div>
        <div className="team-game-chart-divider" />
        <div className="team-game-chart-half team-game-chart-half--bottom">
          {events.map(e => <Bar key={e.id} event={e} show={e.result === 'L' && 'loss'} linkable={linkable} navigate={navigate} />)}
        </div>
      </div>
    </div>
  );
}
