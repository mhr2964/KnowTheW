import { useState, useEffect } from 'react';
import { fetchNotifications } from '../lib/authFetch';

const POLL_INTERVAL_MS = 60000;

// Polls GET /api/notifications every 60s while `enabled` and the tab is visible.
// Pauses polling on a hidden tab (request volume should track actively-viewed
// tabs, not total logged-in sessions) and does an immediate fetch on becoming
// visible again. `teamRepId` is in the effect's deps (not just `enabled`) so
// switching team reps re-fetches immediately instead of showing the previous
// rep's notifications until the next 60s poll.
export function useNotifications(enabled, teamRepId) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!enabled) {
      setNotifications([]);
      setLoading(false);
      setError(null);
      return;
    }

    let intervalId = null;
    let controller = null;

    const load = () => {
      controller?.abort();
      controller = new AbortController();
      setLoading(true);
      fetchNotifications(controller.signal)
        .then(({ ok, status, data }) => {
          if (ok) {
            setNotifications(data?.notifications ?? []);
            setError(null);
          } else {
            setError(data?.error ?? `Could not load notifications (${status}).`);
            // Session cookie has silently expired — retrying every 60s can never
            // succeed until `enabled` flips via AuthContext, so stop polling.
            if (status === 401) stopInterval();
          }
          setLoading(false);
        })
        .catch(err => {
          if (err.name !== 'AbortError') {
            setError('Could not load notifications.');
            setLoading(false);
          }
        });
    };

    const startInterval = () => {
      if (intervalId) return;
      intervalId = setInterval(load, POLL_INTERVAL_MS);
    };

    const stopInterval = () => {
      if (intervalId) clearInterval(intervalId);
      intervalId = null;
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        stopInterval();
      } else {
        load();
        startInterval();
      }
    };

    load();
    startInterval();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      controller?.abort();
      stopInterval();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [enabled, teamRepId]);

  return { notifications, loading, error };
}
