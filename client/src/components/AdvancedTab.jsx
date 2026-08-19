import { useRef, useState } from 'react';
import BrefTable from './BrefTable';

// Purely a display component -- the actual season-by-season fetch (current season, then the rest
// of the career one at a time, then the authoritative whole-career call) runs in
// usePlayerBackgroundStats (see DetailedStats.jsx), started as soon as the player page loads rather
// than gated behind this tab being clicked. `data`/`retry` are that hook's shared state, so
// re-opening this tab doesn't re-fetch anything already in flight or done.
export default function AdvancedTab({ data, retry }) {
  const [advSeason, setAdvSeason] = useState('regular');
  const exportRef = useRef(null);
  const { current, pbpAllData, status } = data;

  if (status === 'error') return (
    <p className="status-msg error" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      Could not load advanced stats.
      <button type="button" className="btn-ghost compare-verdict-retry" onClick={retry}>Try again</button>
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
