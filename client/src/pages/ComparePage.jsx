import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useLazyFetch from '../hooks/useLazyFetch';
import CompareTable from '../components/CompareTable';
import ComparePickerModal from '../components/ComparePickerModal';
import { initialsOf } from '../lib/initials';
import { buildMergedRows } from '../lib/compareTableRows';

const COMPARE_TABS = [
  { key: 'perGame',  label: 'Per Game' },
  { key: 'totals',   label: 'Totals' },
  { key: 'per36',    label: 'Per 36' },
  { key: 'advanced', label: 'Advanced' },
];

function PlayerHero({ player, loading, error, onChangeSide, sideB }) {
  const sideBClass = sideB ? ' compare-hero-side-b' : '';
  if (loading) {
    return (
      <div className={`compare-hero-player compare-hero-skeleton${sideBClass}`}>
        <div className="compare-hero-img placeholder" />
        <div className="compare-hero-info">
          <div className="compare-hero-skeleton-name" />
        </div>
      </div>
    );
  }
  if (error) return (
    <div className={`compare-hero-player compare-hero-error${sideBClass}`}>
      <p className="status-msg error">Could not load player.</p>
      <button type="button" className="compare-change-link" onClick={onChangeSide}>Change</button>
    </div>
  );
  if (!player) return null;

  const p = player.player ?? player;
  return (
    <div className={`compare-hero-player${sideBClass}`}>
      {p.headshot
        ? <img src={p.headshot} alt={p.name} className="compare-hero-img" />
        : <div className="compare-hero-img placeholder">{initialsOf(p.name)}</div>
      }
      <div className="compare-hero-info">
        <div className="compare-hero-meta">
          {p.jersey && <span className="player-hero-jersey">#{p.jersey}</span>}
          {p.teamName && <span className="player-hero-team">{p.teamName}</span>}
        </div>
        <h2 className="compare-hero-name">{p.name}</h2>
        <button type="button" className="compare-change-link" onClick={onChangeSide}>Change</button>
      </div>
    </div>
  );
}

// Normalize advanced-pbp-all response to { headers, rows, careerRow } per season type
function extractAdvanced(pbpData, seasonType) {
  if (!pbpData) return { headers: null, rows: [], careerRow: null };
  const split = seasonType === 'playoffs' && pbpData.playoffs
    ? pbpData.playoffs
    : pbpData.regular;
  return {
    headers: pbpData.headers ?? null,
    rows: split?.rows ?? [],
    careerRow: split?.careerRow ?? null,
  };
}

// Normalize detailed-stats response for a given tab + season type
function extractDetailed(statsData, tabKey, seasonType) {
  if (!statsData || statsData.empty === true) return { headers: null, rows: [], careerRow: null };
  const tableData = statsData[tabKey];
  if (!tableData) return { headers: null, rows: [], careerRow: null };
  const split = seasonType === 'playoffs' ? tableData.playoffs : tableData.regular;
  const careerSplit = seasonType === 'playoffs' ? tableData.playoffCareer : tableData.regularCareer;
  return {
    headers: split?.headers ?? tableData.regular?.headers ?? null,
    rows: split?.rows ?? [],
    careerRow: careerSplit?.rows?.[0] ?? null,
  };
}

export default function ComparePage() {
  const { idA, idB } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('perGame');
  const [activeSeason, setActiveSeason] = useState('regular');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState(null);

  // Player profile fetches — always enabled
  const { data: playerA, loading: loadingA, error: errorA } = useLazyFetch(`/api/players/${idA}`, true);
  const { data: playerB, loading: loadingB, error: errorB } = useLazyFetch(`/api/players/${idB}`, true);

  // Detailed stats — always enabled
  const { data: statsA, loading: loadingStatsA, error: errorStatsA } = useLazyFetch(`/api/players/${idA}/detailed-stats`, true);
  const { data: statsB, loading: loadingStatsB, error: errorStatsB } = useLazyFetch(`/api/players/${idB}/detailed-stats`, true);

  // Advanced pbp — lazy, only when advanced tab is active
  const isAdvanced = activeTab === 'advanced';
  const { data: pbpA, loading: loadingPbpA, error: errorPbpA } = useLazyFetch(`/api/players/${idA}/advanced-pbp-all`, isAdvanced);
  const { data: pbpB, loading: loadingPbpB, error: errorPbpB } = useLazyFetch(`/api/players/${idB}/advanced-pbp-all`, isAdvanced);

  const isSamePlayer = String(idA) === String(idB);

  const nameA = playerA?.player?.name;
  const nameB = playerB?.player?.name;
  useEffect(() => {
    if (isSamePlayer) {
      document.title = 'Compare players — KnowTheW';
    } else if (nameA && nameB) {
      document.title = `${nameA} vs ${nameB} — KnowTheW`;
    }
    return () => { document.title = 'KnowTheW'; };
  }, [nameA, nameB, isSamePlayer]);

  // Determine data sources for the active tab
  let dataA, dataB, tableLoadingA, tableLoadingB, tableErrorA, tableErrorB;
  if (isAdvanced) {
    dataA = extractAdvanced(pbpA, activeSeason);
    dataB = extractAdvanced(pbpB, activeSeason);
    tableLoadingA = loadingPbpA;
    tableLoadingB = loadingPbpB;
    tableErrorA = errorPbpA;
    tableErrorB = errorPbpB;
  } else {
    dataA = extractDetailed(statsA, activeTab, activeSeason);
    dataB = extractDetailed(statsB, activeTab, activeSeason);
    tableLoadingA = loadingStatsA;
    tableLoadingB = loadingStatsB;
    tableErrorA = errorStatsA;
    tableErrorB = errorStatsB;
  }

  // Determine playoff availability for active tab
  const hasPlayoffs = isAdvanced
    ? !!(pbpA?.playoffs || pbpB?.playoffs)
    : !!(statsA?.[activeTab]?.playoffs?.rows?.length || statsB?.[activeTab]?.playoffs?.rows?.length);

  // Auto-snap to regular when no playoffs available
  const curSeason = hasPlayoffs ? activeSeason : 'regular';

  // Build merged table data (pure, safe to call with partial data)
  const merged = buildMergedRows({
    headersA: dataA.headers,
    rowsA: dataA.rows,
    careerRowA: dataA.careerRow,
    headersB: dataB.headers,
    rowsB: dataB.rows,
    careerRowB: dataB.careerRow,
  });

  function openPickerFor(target) {
    setPickerTarget(target);
    setPickerOpen(true);
  }

  function handlePick(newId) {
    setPickerOpen(false);
    if (pickerTarget === 'a') navigate(`/compare/${newId}/${idB}`);
    else navigate(`/compare/${idA}/${newId}`);
  }

  function handleBack() {
    if (window.history.state?.idx > 0) navigate(-1);
    else navigate('/');
  }

  function handleTabClick(key) {
    setActiveTab(key);
  }

  return (
    <>
      <button type="button" className="back-btn" onClick={handleBack}>← Back</button>

      {isSamePlayer ? (
        <div className="compare-same-player">
          <p className="status-msg">Both sides are the same player.</p>
          <button type="button" className="btn-ghost" onClick={() => openPickerFor('b')}>
            Pick a different player to compare
          </button>
        </div>
      ) : (
        <>
          {/* Compact single-row hero */}
          <div className="compare-hero-pair">
            <PlayerHero
              player={playerA}
              loading={loadingA}
              error={errorA}
              onChangeSide={() => openPickerFor('a')}
            />
            <div className="compare-hero-vs">VS</div>
            <PlayerHero
              player={playerB}
              loading={loadingB}
              error={errorB}
              onChangeSide={() => openPickerFor('b')}
              sideB
            />
          </div>

          {/* Shared tab strip */}
          <div className="stat-type-tabs compare-tabs">
            {COMPARE_TABS.map(t => (
              <button
                key={t.key}
                type="button"
                className={`stat-type-tab${activeTab === t.key ? ' active' : ''}`}
                onClick={() => handleTabClick(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Season toggle */}
          <div className="stat-table-header compare-season-header">
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
          </div>

          {/* Merged comparison table */}
          <CompareTable
            headers={merged.headers}
            mergedRows={merged.mergedRows}
            mergedCareerRow={merged.mergedCareerRow}
            loadingA={tableLoadingA}
            loadingB={tableLoadingB}
            errorA={tableErrorA}
            errorB={tableErrorB}
          />
        </>
      )}

      {pickerOpen && (
        <ComparePickerModal
          currentPlayerId={pickerTarget === 'a' ? idB : idA}
          onPick={handlePick}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </>
  );
}
