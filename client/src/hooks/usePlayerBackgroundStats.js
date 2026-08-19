import { useEffect, useState, useCallback } from 'react';

// Prefetches Play-by-Play and Advanced stats as soon as the player page has availableSeasons,
// not gated behind the user clicking either tab -- but strictly ONE request in flight at a time
// (current season for each tab first, then every remaining season, one at a time) rather than
// firing everything at once. Both tabs draw from the same shared, site-wide rate-limited
// BallDontLie budget (~500 req/min) that today's per-season rebuild exists to protect; prefetching
// unconditionally on every page view already multiplies background request volume for tabs a
// visitor may never open, so keeping the whole sequence serialized avoids that volume also turning
// into a concurrent burst on top of it.
export default function usePlayerBackgroundStats(playerId, availableSeasons, availablePlayoffSeasons) {
  const [pbp, setPbp] = useState({ headers: null, rows: [], careerRow: null, status: 'loading' });
  const [adv, setAdv] = useState({ current: null, pbpAllData: null, status: 'loading' });
  const [retryCount, setRetryCount] = useState(0);
  const retry = useCallback(() => setRetryCount(c => c + 1), []);

  useEffect(() => {
    if (!playerId || !availableSeasons?.length) return undefined;
    let cancelled = false;
    setPbp({ headers: null, rows: [], careerRow: null, status: 'loading' });
    setAdv({ current: null, pbpAllData: null, status: 'loading' });

    (async () => {
      // 1. PBP current season, 2. Advanced current season -- both tabs' fast path ready first,
      // before either tab's expensive full-career warm-up begins.
      const pbpCollected = [];
      try {
        const r = await fetch(`/api/players/${playerId}/pbp-table/season/${availableSeasons[0]}`);
        if (r.ok) {
          const d = await r.json();
          pbpCollected.push(d.row);
          if (!cancelled) setPbp(p => ({ ...p, headers: d.headers, rows: [...pbpCollected] }));
        }
      } catch { /* the sequential loop below will retry this season anyway on a hard reload */ }
      if (cancelled) return;

      try {
        const r = await fetch(`/api/players/${playerId}/advanced-pbp-all/season/${availableSeasons[0]}?seasontype=2`);
        if (r.ok) {
          const current = await r.json();
          if (!cancelled) setAdv(a => ({ ...a, current }));
        }
      } catch { /* non-fatal -- the final whole-career call below is the source of truth */ }
      if (cancelled) return;

      // 3. Remaining PBP seasons, one at a time.
      let pbpAnyFailed = false;
      for (const season of availableSeasons.slice(1)) {
        if (cancelled) return;
        try {
          const r = await fetch(`/api/players/${playerId}/pbp-table/season/${season}`);
          if (r.ok) {
            const d = await r.json();
            pbpCollected.push(d.row);
            if (!cancelled) setPbp(p => ({ ...p, rows: [...pbpCollected] }));
          } else if (r.status !== 404) pbpAnyFailed = true;
        } catch {
          pbpAnyFailed = true;
        }
      }
      if (cancelled) return;

      if (!pbpCollected.length) {
        setPbp(p => ({ ...p, status: pbpAnyFailed ? 'error' : 'empty' }));
      } else {
        try {
          const r = await fetch(`/api/players/${playerId}/pbp-table/career-row`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rows: pbpCollected }),
          });
          if (r.ok && !cancelled) {
            const { careerRow } = await r.json();
            setPbp(p => ({ ...p, careerRow }));
          }
        } catch { /* career row is a summary row; the season rows above are already usable */ }
        if (!cancelled) setPbp(p => ({ ...p, status: pbpAnyFailed ? 'partial' : 'done' }));
      }

      // 4. Remaining Advanced seasons (regular then playoffs), one at a time -- each call warms
      // computeSeasonPBP's per-season Mongo cache, so the final whole-career call below is fast.
      for (const season of availableSeasons.slice(1)) {
        if (cancelled) return;
        try { await fetch(`/api/players/${playerId}/advanced-pbp-all/season/${season}?seasontype=2`); }
        catch { /* warm-up only -- the final call recomputes live if this didn't land */ }
      }
      for (const season of availablePlayoffSeasons ?? []) {
        if (cancelled) return;
        try { await fetch(`/api/players/${playerId}/advanced-pbp-all/season/${season}?seasontype=3`); }
        catch { /* same as above */ }
      }
      if (cancelled) return;

      try {
        const r = await fetch(`/api/players/${playerId}/advanced-pbp-all`);
        if (!r.ok) throw new Error();
        const d = await r.json();
        if (!cancelled) setAdv(a => ({ ...a, pbpAllData: d, status: 'done' }));
      } catch {
        if (!cancelled) setAdv(a => ({ ...a, status: 'error' }));
      }
    })();

    return () => { cancelled = true; };
  }, [playerId, availableSeasons, availablePlayoffSeasons, retryCount]);

  return { pbp, adv, retry };
}
