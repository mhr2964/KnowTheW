import { useState, useEffect, useRef } from 'react';
import BrefTable from './BrefTable';
import TableToolbar from './TableToolbar';
import { buildStudyDeck } from '../lib/studyData';
import useSeasonScopedFetch from '../hooks/useSeasonScopedFetch';

const SPLIT_TYPES = [
  { key: 'homeaway', label: 'Home/Away' },
  { key: 'month', label: 'Monthly' },
  { key: 'opponent', label: 'By Opponent' },
];

export default function SplitsTab({ playerId, playerName, availableSeasons, onOpenStudy }) {
  const [season, setSeason] = useState(null);
  const [splitType, setSplitType] = useState('homeaway');
  const exportRef = useRef(null);

  useEffect(() => {
    if (!season && availableSeasons.length > 0) setSeason(availableSeasons[0]);
  }, [season, availableSeasons]);

  const splitsUrl = season ? `/api/players/${playerId}/splits?season=${season}&type=${splitType}` : null;
  const { data: current, loading, error, retry } = useSeasonScopedFetch(splitsUrl);

  const splitLabel = SPLIT_TYPES.find(t => t.key === splitType)?.label ?? splitType;

  function openStudy() {
    if (!current) return;
    const deck = buildStudyDeck({ columns: current.columns, rows: current.rows });
    onOpenStudy?.({ ...deck, deckName: `${playerName} Splits (${splitLabel}) ${season}` });
  }

  return (
    <>
      <TableToolbar
        leading={
          <>
            {availableSeasons.length > 1 && (
              <select className="gl-select" value={season ?? ''} onChange={e => setSeason(e.target.value)}>
                {availableSeasons.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
            <select className="gl-select" value={splitType} onChange={e => setSplitType(e.target.value)}>
              {SPLIT_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </>
        }
        showStudy={!!current}
        onStudy={openStudy}
        showExport={!!current}
        onExport={() => exportRef.current?.()}
      />
      {loading && <p className="status-msg" style={{ padding: '1rem 0' }}>Loading splits…</p>}
      {error && (
        <p className="status-msg error" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          Could not load splits.
          <button type="button" className="btn-ghost compare-verdict-retry" onClick={retry}>Try again</button>
        </p>
      )}
      {!loading && !error && (
        <BrefTable
          regular={current}
          emptyMessage="No split data available."
          filename={`${playerName}-splits-${splitLabel.toLowerCase().replace(/\W+/g, '-')}-${season}.csv`}
          exportRef={exportRef}
        />
      )}
    </>
  );
}
