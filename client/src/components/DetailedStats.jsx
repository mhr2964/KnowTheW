import { useState, useEffect, useMemo, useRef } from 'react';
import StudyFlow from './StudyFlow';
import BrefTable from './BrefTable';
import useLazyFetch from '../hooks/useLazyFetch';
import GameLogTab from './GameLogTab';
import AdvancedTab from './AdvancedTab';
import PlayByPlayTab from './PlayByPlayTab';
import SplitsTab from './SplitsTab';


const ALL_TABLE_TYPES = [
  { key: 'perGame',   label: 'Per Game' },
  { key: 'totals',    label: 'Totals' },
  { key: 'per36',     label: 'Per 36' },
  { key: 'per100',    label: 'Per 100 Poss' },
  { key: 'advanced',  label: 'Advanced' },
  { key: 'gamelog',   label: 'Game Log' },
  { key: 'splits',    label: 'Splits' },
  { key: 'pbp',       label: 'Play-by-Play' },
];
const COMING_SOON = ['Adj. Shooting'];

const SOURCE_ACTIVE = {
  bdl:  new Set(['perGame', 'totals', 'per36']),
  wnba: new Set(['perGame', 'totals', 'per36', 'per100']),
  espn: new Set(['perGame', 'totals', 'per36', 'advanced', 'gamelog', 'splits', 'pbp']),
};

export default function DetailedStats({ playerId, playerName, onSaveDeck, initialTab, onTabChange }) {
  // initialTab seeds state once; subsequent changes come from handleTypeClick.
  // PlayerRoutePage keys <PlayerPage> on playerId so this re-runs on player switch.
  const [activeType, setActiveType] = useState(initialTab ?? 'perGame');
  const [activeSeason, setActiveSeason] = useState('regular');
  const [studyConfig, setStudyConfig] = useState(null);
  const [showPercentiles, setShowPercentiles] = useState(false);
  const exportRef = useRef(null);

  const { data, loading, error, refetch: refetchCareer } = useLazyFetch(
    `/api/players/${playerId}/detailed-stats`,
    true
  );

  const { data: percData, loading: percLoading } = useLazyFetch(
    `/api/players/${playerId}/percentiles`,
    showPercentiles
  );

  const { data: pbpAllData, loading: pbpAllLoading, error: pbpAllError, refetch: refetchPbp } = useLazyFetch(
    `/api/players/${playerId}/advanced-pbp-all`,
    activeType === 'advanced'
  );

  useEffect(() => {
    setShowPercentiles(false);
  }, [playerId]);

  const availableSeasons = useMemo(() => {
    const rows = data?.perGame?.regular?.rows ?? [];
    const seen = new Set();
    const seasons = [];
    for (const row of rows) {
      const s = String(row[0]);
      if (s && s !== 'undefined' && !seen.has(s)) { seen.add(s); seasons.push(s); }
    }
    return seasons.sort((a, b) => b.localeCompare(a));
  }, [data]);

  function handleTypeClick(key) {
    setActiveType(key);
    onTabChange?.(key);
  }

  if (loading) return <p className="status-msg" style={{ padding: '2rem 0' }}>Loading career stats…</p>;
  if (error) return (
    <p className="status-msg error" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '2rem 0' }}>
      Could not load career stats.
      <button type="button" className="btn-ghost compare-verdict-retry" onClick={refetchCareer}>Try again</button>
    </p>
  );
  if (!data) return null;
  const isEmpty = data.empty === true;

  const activeKeys = SOURCE_ACTIVE[data.source] ?? new Set(['perGame']);
  const enabledTypes = ALL_TABLE_TYPES.filter(t => activeKeys.has(t.key));
  const disabledTypes = ALL_TABLE_TYPES.filter(t => !activeKeys.has(t.key));
  const safeType = activeKeys.has(activeType) ? activeType : 'perGame';

  const isGamelog  = safeType === 'gamelog';
  const isAdvanced = safeType === 'advanced';
  const isSplits   = safeType === 'splits';
  const isPbp      = safeType === 'pbp';
  const isRawTab   = isGamelog || isAdvanced || isSplits || isPbp;
  const tableData  = isRawTab ? null : data[safeType];
  const hasPlayoffs = isRawTab ? false : !!tableData?.playoffs?.rows?.length;
  const curSeason = (!hasPlayoffs && activeSeason === 'playoffs') ? 'regular' : activeSeason;
  const regular = isRawTab ? null : (curSeason === 'regular' ? tableData?.regular : tableData?.playoffs);
  const career  = isRawTab ? null : (curSeason === 'regular' ? tableData?.regularCareer : tableData?.playoffCareer);

  function openStudy() {
    if (!regular) return;
    const { columns, rows } = regular;
    const careerRows = career?.rows ?? [];
    const studyData = [...rows, ...careerRows].map(row =>
      Object.fromEntries(columns.map((c, i) => [c.key, row[i]]))
    );
    // StudyFlow only special-cases type:'pct' (0-1 fraction -> "51.2%"); pct100 values fall through
    // to its plain-number formatting same as 'num' always did here. No HIDDEN filter needed —
    // server-emitted columns never include PLAYER_ID/LEAGUE_ID/TEAM_ID.
    const studyCols = columns.map(c => ({ key: c.key, label: c.label, type: c.kind === 'pct' ? 'pct' : 'text' }));
    const typeLabel = enabledTypes.find(t => t.key === safeType)?.label ?? safeType;
    const suffix = curSeason === 'playoffs' ? ' (Playoffs)' : '';
    setStudyConfig({ data: studyData, columns: studyCols, deckName: `${playerName} ${typeLabel}${suffix}` });
  }

  return (
    <>
      <div className="detailed-stats">
        <div className="stat-type-tabs">
          {enabledTypes.map(t => (
            <button
              key={t.key}
              type="button"
              className={`stat-type-tab${safeType === t.key ? ' active' : ''}`}
              onClick={() => handleTypeClick(t.key)}
            >
              {t.label}
            </button>
          ))}
          {disabledTypes.map(t => (
            <button key={t.key} type="button" className="stat-type-tab soon" disabled>{t.label}</button>
          ))}
          {COMING_SOON.map(label => (
            <button key={label} type="button" className="stat-type-tab soon" disabled>{label}</button>
          ))}
        </div>

        {isAdvanced ? (
          <AdvancedTab
            pbpAllData={pbpAllData}
            pbpAllLoading={pbpAllLoading}
            pbpAllError={pbpAllError}
            refetchPbp={refetchPbp}
          />
        ) : isGamelog ? (
          <GameLogTab playerId={playerId} playerName={playerName} availableSeasons={availableSeasons} />
        ) : isSplits ? (
          <SplitsTab playerId={playerId} playerName={playerName} availableSeasons={availableSeasons} />
        ) : isPbp ? (
          <PlayByPlayTab playerId={playerId} availableSeasons={availableSeasons} />
        ) : (
          <>
            <div className="stat-table-header">
              <div className="stat-season-bar">
                <button
                  type="button"
                  className={`stat-season-tab${curSeason === 'regular' ? ' active' : ''}`}
                  onClick={() => setActiveSeason('regular')}
                >
                  Regular Season
                </button>
                {hasPlayoffs && (
                  <button
                    type="button"
                    className={`stat-season-tab${curSeason === 'playoffs' ? ' active' : ''}`}
                    onClick={() => setActiveSeason('playoffs')}
                  >
                    Playoffs
                  </button>
                )}
              </div>
              {!isEmpty && (
                <label className="perc-toggle">
                  <input
                    type="checkbox"
                    checked={showPercentiles}
                    onChange={() => setShowPercentiles(v => !v)}
                  />
                  <span className="perc-toggle-track"><span className="perc-toggle-thumb" /></span>
                  <span className="perc-toggle-label">{percLoading ? 'Loading…' : 'Percentiles'}</span>
                </label>
              )}
              {regular && (
                <>
                  <button type="button" className="study-trigger-btn" onClick={openStudy}>
                    Study this table
                  </button>
                  <button type="button" className="btn-ghost bref-export-btn" onClick={() => exportRef.current?.()}>
                    Export CSV
                  </button>
                </>
              )}
            </div>
            <BrefTable
              regular={regular}
              career={career}
              percentiles={showPercentiles && !percLoading ? percData : null}
              viewMode={safeType}
              emptyMessage={isEmpty ? "Hasn't played WNBA games yet." : undefined}
              filename={`${playerName}-${safeType}${curSeason === 'playoffs' ? '-playoffs' : ''}.csv`}
              exportRef={exportRef}
            />
          </>
        )}
      </div>

      {studyConfig && (
        <StudyFlow
          {...studyConfig}
          onClose={() => setStudyConfig(null)}
          onSave={onSaveDeck}
        />
      )}
    </>
  );
}
