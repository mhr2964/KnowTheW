import { useEffect, useRef, useState } from 'react';
import BrefTable from './BrefTable';

// Warms one season at a time (current regular season first) via /advanced-pbp-all/season/:season,
// then makes one final call to the whole-career /advanced-pbp-all endpoint for the authoritative
// result (career totals, PER/WS, Regular/Playoffs split). Same rationale as PlayByPlayTab: a long
// career's all-seasons PBP computation needs hundreds of live BallDontLie requests and is
// structurally unable to finish inside Heroku's 30s router timeout in one shot (confirmed live,
// 2026-08-19). Each per-season warm-up call reuses computeSeasonPBP's existing Mongo cache
// (playerSeasonPbp), so by the time the final call runs, every past season is already cached and
// that call only has to live-compute the current season -- cheap regardless of career length.
export default function AdvancedTab({ playerId, availableSeasons, availablePlayoffSeasons }) {
  const [advSeason, setAdvSeason] = useState('regular');
  const exportRef = useRef(null);

  const [current, setCurrent] = useState(null); // { columns, row } for the current regular season
  const [pbpAllData, setPbpAllData] = useState(null); // final authoritative result
  const [status, setStatus] = useState('loading'); // 'loading' | 'done' | 'error'
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!availableSeasons?.length) return undefined;
    let cancelled = false;
    setCurrent(null);
    setPbpAllData(null);
    setStatus('loading');

    (async () => {
      const currentSeason = availableSeasons[0];
      try {
        const r = await fetch(`/api/players/${playerId}/advanced-pbp-all/season/${currentSeason}?seasontype=2`);
        if (r.ok && !cancelled) setCurrent(await r.json());
      } catch {
        // Non-fatal: the final /advanced-pbp-all call below is the source of truth either way.
      }
      if (cancelled) return;

      for (const season of availableSeasons.slice(1)) {
        if (cancelled) return;
        try {
          await fetch(`/api/players/${playerId}/advanced-pbp-all/season/${season}?seasontype=2`);
        } catch { /* warm-up only -- failures here just mean the final call recomputes it live */ }
      }
      for (const season of availablePlayoffSeasons ?? []) {
        if (cancelled) return;
        try {
          await fetch(`/api/players/${playerId}/advanced-pbp-all/season/${season}?seasontype=3`);
        } catch { /* same as above */ }
      }
      if (cancelled) return;

      try {
        const r = await fetch(`/api/players/${playerId}/advanced-pbp-all`);
        if (!r.ok) throw new Error();
        const d = await r.json();
        if (!cancelled) { setPbpAllData(d); setStatus('done'); }
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();

    return () => { cancelled = true; };
  }, [playerId, availableSeasons, availablePlayoffSeasons, retryCount]);

  if (status === 'error') return (
    <p className="status-msg error" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      Could not load advanced stats.
      <button type="button" className="btn-ghost compare-verdict-retry" onClick={() => setRetryCount(c => c + 1)}>Try again</button>
    </p>
  );

  // Final result ready: render exactly the full Regular/Playoffs view.
  if (pbpAllData) {
    const advHasPlayoffs = !!pbpAllData.playoffs;
    const advSplit = (advSeason === 'playoffs' && advHasPlayoffs)
      ? pbpAllData.playoffs
      : pbpAllData.regular;
    return (
      <>
        <div className="stat-table-header">
          <div className="stat-season-bar">
            <button type="button" className={`stat-season-tab${advSeason === 'regular' ? ' active' : ''}`} onClick={() => setAdvSeason('regular')}>Regular Season</button>
            {advHasPlayoffs && (
              <button type="button" className={`stat-season-tab${advSeason === 'playoffs' ? ' active' : ''}`} onClick={() => setAdvSeason('playoffs')}>Playoffs</button>
            )}
          </div>
          <button type="button" className="btn-ghost bref-export-btn" onClick={() => exportRef.current?.()}>
            Export CSV
          </button>
        </div>
        <BrefTable
          regular={{ columns: pbpAllData.columns, rows: advSplit?.rows ?? [] }}
          career={advSplit?.careerRow ? { columns: pbpAllData.columns, rows: [advSplit.careerRow] } : null}
          exportRef={exportRef}
        />
      </>
    );
  }

  if (!current) return <p className="status-msg" style={{ padding: '1rem 0' }}>Loading advanced stats…</p>;

  // Current season only, while the rest of the career warms in behind it.
  return (
    <>
      <BrefTable
        regular={{ columns: current.columns, rows: [current.row] }}
        career={null}
      />
      <p className="status-msg" style={{ padding: '0.75rem 0' }}>Loading rest of career…</p>
    </>
  );
}
