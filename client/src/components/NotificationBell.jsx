import { useState, useEffect } from 'react';
import { useNotifications } from '../hooks/useNotifications';

function formatGameDate(iso) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  }).format(new Date(iso));
}

// Correct at render/poll time only (no live countdown) -- the 4h TTL keeps a notification
// around well past tipoff, so without this a "starts in 10 min" and a "started 2h ago" game
// look identical.
function gameStatus(iso) {
  const diffMs = new Date(iso).getTime() - Date.now();
  if (diffMs <= 0) return 'In progress';
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 60) return `in ${minutes} min`;
  return `in ${Math.round(minutes / 60)}h`;
}

export default function NotificationBell({ teamRepId }) {
  const enabled = !!teamRepId;
  const [open, setOpen] = useState(false);
  const { notifications } = useNotifications(enabled, teamRepId);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = e => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  if (!enabled) return null;

  return (
    <div className="notif-bell-wrap">
      <button
        type="button"
        className="notif-bell-btn"
        aria-label="Notifications"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {notifications.length > 0 && <span className="notif-bell-badge">{notifications.length}</span>}
      </button>

      {open && (
        <>
          <div className="notif-backdrop" onClick={() => setOpen(false)} />
          <div className="notif-dropdown">
            {notifications.length === 0 ? (
              <p className="notif-empty">Nothing new right now</p>
            ) : (
              <ul className="notif-list">
                {notifications.map(n => (
                  <li key={n.id} className="notif-item">
                    {n.type === 'injury'
                      ? <>{n.playerName} is now <strong>{n.status}</strong>{n.returnDate ? ` (est. return ${n.returnDate})` : ''}</>
                      : <>{n.atVs} {n.opponent?.abbreviation ?? '?'} — {formatGameDate(n.gameDate)} ({gameStatus(n.gameDate)})</>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
