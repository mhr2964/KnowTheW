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

export default function SplitsTab({ playerId, playerName, availableSeasons, onOpenStudy, seasonBarRef, onSeasonChange }) {
  const [season, setSeason] = useState(null);
  const [splitType, setSplitType] = useState('homeaway');
  const [splitSeasonType, setSplitSeasonType] = useState('regular');
  const exportRef = useRef(null);

  useEffect(() => {
    if (!season && availableSeasons.length > 0) setSeason(availableSeasons[0]);
  }, [season, availableSeasons]);

  function handleSeasonChange(s) {
    setSeason(s);
    setSplitSeasonType('regular');
  }

  const splitsUrl = season
    ? `/api/players/${playerId}/splits?season=${season}&type=${splitType}&postseason=${splitSeasonType === 'playoffs'}`
    : null;
  const { data: current, loading, error, retry } = useSeasonScopedFetch(splitsUrl);

  // Reports up to DetailedStats' sticky-nav season indicator (see AdvancedTab for the same pattern).
  useEffect(() => {
    onSeasonChange?.(current?.hasPlayoffs ? splitSeasonType : null);
  }, [current, splitSeasonType, onSeasonChange]);

  const splitLabel = SPLIT_TYPES.find(t => t.key === splitType)?.label ?? splitType;

  function openStudy() {
    if (!current) return;
    const suffix = splitSeasonType === 'playoffs' ? ' (Playoffs)' : '';
    const deck = buildStudyDeck({ columns: current.columns, rows: current.rows });
    onOpenStudy?.({ ...deck, deckName: `${playerName} Splits (${splitLabel}) ${season}${suffix}` });
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
                  className={`stat-season-tab${splitSeasonType === 'regular' ? ' active' : ''}`}
                  onClick={() => setSplitSeasonType('regular')}
                >
                  Regular Season
                </button>
                <button
                  type="button"
                  className={`stat-season-tab${splitSeasonType === 'playoffs' ? ' active' : ''}`}
                  onClick={() => setSplitSeasonType('playoffs')}
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
          filename={`${playerName}-splits-${splitLabel.toLowerCase().replace(/\W+/g, '-')}-${season}${splitSeasonType === 'playoffs' ? '-playoffs' : ''}.csv`}
          exportRef={exportRef}
        />
      )}
    </>
  );
}
