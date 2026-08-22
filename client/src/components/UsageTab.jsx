import { useState, useEffect, useRef } from 'react';
import BrefTable from './BrefTable';
import TableToolbar from './TableToolbar';
import { buildStudyDeck } from '../lib/studyData';
import useSeasonScopedFetch from '../hooks/useSeasonScopedFetch';

// A 404 means "no usage-share data this player-season, either side" -- a legitimate empty result
// (the underlying tracking-data floor is 2022, narrower than career-stats coverage), not an error,
// same posture as ClutchTab's parseClutch.
async function parseUsage(r) {
  if (r.status === 404) return null;
  if (!r.ok) throw new Error();
  return r.json();
}

export default function UsageTab({ playerId, playerName, availableSeasons, onOpenStudy, seasonBarRef, onSeasonChange }) {
  const [season, setSeason] = useState(null);
  const [seasonType, setSeasonType] = useState('regular');
  const exportRef = useRef(null);

  useEffect(() => {
    if (!season && availableSeasons.length > 0) setSeason(availableSeasons[0]);
  }, [season, availableSeasons]);

  function handleSeasonChange(s) {
    setSeason(s);
    setSeasonType('regular');
  }

  // Both season sides come back in one response (server/routes/players.js) -- toggling below is a
  // local swap, not a refetch, same as ClutchTab.
  const usageUrl = season ? `/api/players/${playerId}/usage?season=${season}` : null;
  const { data: current, loading, error, retry } = useSeasonScopedFetch(usageUrl, { parse: parseUsage });

  useEffect(() => {
    onSeasonChange?.(current?.hasPlayoffs ? seasonType : null);
  }, [current, seasonType, onSeasonChange]);

  const table = seasonType === 'playoffs' ? current?.playoffs : current?.regular;

  function openStudy() {
    if (!table) return;
    const suffix = seasonType === 'playoffs' ? ' (Playoffs)' : '';
    const deck = buildStudyDeck({ columns: table.columns, rows: table.rows });
    onOpenStudy?.({ ...deck, deckName: `${playerName} Usage ${season}${suffix}` });
  }

  return (
    <>
      <TableToolbar
        leading={
          <>
            {current?.hasPlayoffs && (
              <div className="stat-season-bar" ref={seasonBarRef}>
                <button
                  type="button"
                  className={`stat-season-tab${seasonType === 'regular' ? ' active' : ''}`}
                  onClick={() => setSeasonType('regular')}
                >
                  Regular Season
                </button>
                <button
                  type="button"
                  className={`stat-season-tab${seasonType === 'playoffs' ? ' active' : ''}`}
                  onClick={() => setSeasonType('playoffs')}
                >
                  Playoffs
                </button>
              </div>
            )}
            {availableSeasons.length > 1 && (
              <select className="gl-select" value={season ?? ''} onChange={e => handleSeasonChange(e.target.value)}>
                {availableSeasons.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
          </>
        }
        showStudy={!!table}
        onStudy={openStudy}
        showExport={!!table}
        onExport={() => exportRef.current?.()}
      />
      {loading && <p className="status-msg" style={{ padding: '1rem 0' }}>Loading usage stats…</p>}
      {error && (
        <p className="status-msg error" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          Could not load usage stats.
          <button type="button" className="btn-ghost compare-verdict-retry" onClick={retry}>Try again</button>
        </p>
      )}
      {!loading && !error && (
        <BrefTable
          regular={table}
          emptyMessage="No usage data this season."
          filename={`${playerName}-usage-${season}${seasonType === 'playoffs' ? '-playoffs' : ''}.csv`}
          exportRef={exportRef}
        />
      )}
    </>
  );
}
