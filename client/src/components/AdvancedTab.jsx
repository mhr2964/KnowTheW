import { useRef, useState } from 'react';
import BrefTable from './BrefTable';

export default function AdvancedTab({ pbpAllData, pbpAllLoading, pbpAllError, refetchPbp }) {
  const [advSeason, setAdvSeason] = useState('regular');
  const exportRef = useRef(null);

  return (
    <>
      {pbpAllLoading && <p className="status-msg" style={{ padding: '1rem 0' }}>Loading advanced stats… (fetching play-by-play for all seasons)</p>}
      {pbpAllError && (
        <p className="status-msg error" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          Could not load advanced stats.
          <button type="button" className="btn-ghost compare-verdict-retry" onClick={refetchPbp}>Try again</button>
        </p>
      )}
      {!pbpAllLoading && !pbpAllError && pbpAllData && (() => {
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
      })()}
    </>
  );
}
