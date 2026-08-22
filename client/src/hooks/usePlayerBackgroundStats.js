import { useEffect, useState, useCallback } from 'react';

// Runs `fn(item)` for each item in `items`, strictly sequential (one in flight at a time), stopping
// immediately -- without starting the next item -- once `isCancelled()` returns true. `fn` owns its
// own try/catch: the PBP and Advanced sequences below each do different things with a failure
// (accumulate-and-continue vs silent warm-up-only), so that logic stays in the caller rather than
// being forced through shared callback params.
async function runSequential(items, isCancelled, fn) {
  for (const item of items) {
    if (isCancelled()) return;
    await fn(item);
  }
}

// Prefetches Play-by-Play and Advanced stats as soon as the player page has availableSeasons,
// not gated behind the user clicking either tab -- but strictly ONE request in flight at a time
// (current season for each tab first, then every remaining season, one at a time) rather than
// firing everything at once. Both tabs draw from the same shared, site-wide rate-limited
// BallDontLie budget (~500 req/min) that today's per-season rebuild exists to protect; prefetching
// unconditionally on every page view already multiplies background request volume for tabs a
// visitor may never open, so keeping the whole sequence serialized avoids that volume also turning
// into a concurrent burst on top of it.
export default function usePlayerBackgroundStats(playerId, availableSeasons, availablePlayoffSeasons) {
  const [pbp, setPbp] = useState({
    headers: null, rows: [], careerRow: null, status: 'loading', timedOutSeasons: [],
    hasPlayoffs: false, playoffRows: [], playoffCareerRow: null, playoffStatus: 'loading',
  });
  const [adv, setAdv] = useState({ current: null, full: null, status: 'loading', timedOutSeasons: [] });
  const [retryCount, setRetryCount] = useState(0);
  const retry = useCallback(() => setRetryCount(c => c + 1), []);

  useEffect(() => {
    if (!playerId || !availableSeasons?.length) return undefined;
    let cancelled = false;
    const isCancelled = () => cancelled;
    setPbp({
      headers: null, rows: [], careerRow: null, status: 'loading', timedOutSeasons: [],
      hasPlayoffs: (availablePlayoffSeasons?.length ?? 0) > 0, playoffRows: [], playoffCareerRow: null, playoffStatus: 'loading',
    });
    setAdv({ current: null, full: null, status: 'loading', timedOutSeasons: [] });

    (async () => {
      // 1. PBP current season, 2. Advanced current season -- both tabs' fast path ready first,
      // before either tab's expensive full-career warm-up begins.
      const pbpRows = [];
      try {
        const r = await fetch(`/api/players/${playerId}/pbp-table/season/${availableSeasons[0]}`);
        if (r.ok) {
          const d = await r.json();
          pbpRows.push(d.row);
          if (!cancelled) setPbp(p => ({ ...p, headers: d.headers, rows: [...pbpRows] }));
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

      // 3. Remaining PBP seasons, one at a time. Also captures headers here (not just in step 1
      // above) -- if the current season's fast-path request itself times out/fails, step 1 never
      // sets headers, and without this fallback the table would stay stuck on "Loading…" forever
      // even though every other season loaded fine (confirmed live, 2026-08-22: current season 504,
      // headers null, all 8 prior seasons 200 OK -- table never rendered until this fix).
      let pbpAnyFailed = false;
      const pbpTimedOut = [];
      await runSequential(availableSeasons.slice(1), isCancelled, async (season) => {
        try {
          const r = await fetch(`/api/players/${playerId}/pbp-table/season/${season}`);
          if (r.ok) {
            const d = await r.json();
            pbpRows.push(d.row);
            if (!cancelled) setPbp(p => ({ ...p, headers: p.headers ?? d.headers, rows: [...pbpRows] }));
          } else if (r.status === 504) {
            pbpAnyFailed = true;
            pbpTimedOut.push(season);
          } else if (r.status !== 404) pbpAnyFailed = true;
        } catch {
          pbpAnyFailed = true;
        }
      });
      if (cancelled) return;

      if (!pbpRows.length) {
        setPbp(p => ({ ...p, status: pbpAnyFailed ? 'error' : 'empty', timedOutSeasons: pbpTimedOut }));
      } else {
        try {
          const r = await fetch(`/api/players/${playerId}/pbp-table/career-row`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rows: pbpRows }),
          });
          if (r.ok && !cancelled) {
            const { careerRow } = await r.json();
            setPbp(p => ({ ...p, careerRow }));
          }
        } catch { /* career row is a summary row; the season rows above are already usable */ }
        if (!cancelled) setPbp(p => ({ ...p, status: pbpAnyFailed ? 'partial' : 'done', timedOutSeasons: pbpTimedOut }));
      }

      // 3b. Playoff PBP seasons, one at a time -- same per-season endpoint as the regular-season
      // loop above, just with seasontype=3. Independent of the regular-season status/career-row
      // handling: a player can have usable PBP for one season type and not the other.
      const playoffPbpRows = [];
      let playoffPbpAnyFailed = false;
      await runSequential(availablePlayoffSeasons ?? [], isCancelled, async (season) => {
        try {
          const r = await fetch(`/api/players/${playerId}/pbp-table/season/${season}?seasontype=3`);
          if (r.ok) {
            const d = await r.json();
            playoffPbpRows.push(d.row);
            if (!cancelled) setPbp(p => ({ ...p, headers: p.headers ?? d.headers, playoffRows: [...playoffPbpRows] }));
          } else if (r.status !== 404 && r.status !== 504) playoffPbpAnyFailed = true;
        } catch {
          playoffPbpAnyFailed = true;
        }
      });
      if (cancelled) return;

      if (playoffPbpRows.length) {
        try {
          const r = await fetch(`/api/players/${playerId}/pbp-table/career-row`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rows: playoffPbpRows }),
          });
          if (r.ok && !cancelled) {
            const { careerRow } = await r.json();
            setPbp(p => ({ ...p, playoffCareerRow: careerRow }));
          }
        } catch { /* career row is a summary row; the season rows above are already usable */ }
      }
      if (!cancelled) setPbp(p => ({ ...p, playoffStatus: playoffPbpRows.length ? 'done' : (playoffPbpAnyFailed ? 'error' : 'empty') }));

      // 4. Remaining Advanced seasons (regular then playoffs), one at a time -- each call warms
      // computeSeasonPBP's per-season Mongo cache, so the final whole-career call below is fast.
      // A 504 here means that season's own warm-up hit the same H12 budget the PBP loop above
      // does -- non-fatal to this loop (the final whole-career call recomputes live regardless),
      // but tracked so the tab can say which seasons the cache never got to warm for.
      const advTimedOut = [];
      await runSequential(availableSeasons.slice(1), isCancelled, async (season) => {
        try {
          const r = await fetch(`/api/players/${playerId}/advanced-pbp-all/season/${season}?seasontype=2`);
          if (r.status === 504) advTimedOut.push(season);
        } catch { /* warm-up only -- the final call recomputes live if this didn't land */ }
      });
      await runSequential(availablePlayoffSeasons ?? [], isCancelled, async (season) => {
        try {
          const r = await fetch(`/api/players/${playerId}/advanced-pbp-all/season/${season}?seasontype=3`);
          if (r.status === 504) advTimedOut.push(season);
        } catch { /* same as above */ }
      });
      if (cancelled) return;

      try {
        const r = await fetch(`/api/players/${playerId}/advanced-pbp-all`);
        if (!r.ok) throw new Error();
        const full = await r.json();
        if (!cancelled) setAdv(a => ({ ...a, full, status: 'done', timedOutSeasons: advTimedOut }));
      } catch {
        if (!cancelled) setAdv(a => ({ ...a, status: 'error', timedOutSeasons: advTimedOut }));
      }
    })();

    return () => { cancelled = true; };
  }, [playerId, availableSeasons, availablePlayoffSeasons, retryCount]);

  return { pbp, adv, retry };
}
