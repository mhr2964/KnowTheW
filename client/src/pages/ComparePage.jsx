import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useLazyFetch from '../hooks/useLazyFetch';
import BrefTable from '../components/BrefTable';
import CompareSummary from '../components/CompareSummary';
import ComparePickerModal from '../components/ComparePickerModal';
import { initialsOf } from '../lib/initials';

const COMPARE_TABS = [
  { key: 'perGame',  label: 'Per Game' },
  { key: 'totals',   label: 'Totals' },
  { key: 'per36',    label: 'Per 36' },
  { key: 'per100',   label: 'Per 100 Poss' },
  { key: 'advanced', label: 'Advanced', disabled: true },
  { key: 'gamelog',  label: 'Game Log', disabled: true },
];

function PlayerHero({ player, loading, error, onRetry }) {
  if (loading) return <div className="compare-hero-player"><p className="status-msg">Loading...</p></div>;
  if (error) return (
    <div className="compare-hero-player compare-hero-error">
      <p className="status-msg error">Could not load player.</p>
      <button type="button" className="btn-ghost" onClick={onRetry}>Retry</button>
    </div>
  );
  if (!player) return null;

  const p = player.player ?? player;
  return (
    <div className="compare-hero-player">
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
      </div>
    </div>
  );
}

function PlayerTable({ statsData, statsLoading, statsError, onRetry, activeTab }) {
  if (statsLoading) return <p className="status-msg" style={{ padding: '1.5rem 0' }}>Loading stats...</p>;
  if (statsError) return (
    <div>
      <p className="status-msg error">Could not load stats.</p>
      <button type="button" className="btn-ghost" onClick={onRetry}>Retry</button>
    </div>
  );
  if (!statsData) return null;

  const isEmpty = statsData.empty === true;
  const tableData = isEmpty ? null : statsData[activeTab];
  const regular = tableData?.regular ?? null;
  const career = tableData?.regularCareer ?? null;

  return (
    <BrefTable
      regular={regular}
      career={career}
      emptyMessage={isEmpty ? "Hasn't played WNBA games yet." : undefined}
    />
  );
}

export default function ComparePage() {
  const { idA, idB } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('perGame');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState(null);

  // Four parallel fetches — each enabled immediately
  const { data: playerA, loading: loadingA, error: errorA } = useLazyFetch(`/api/players/${idA}`, true);
  const { data: playerB, loading: loadingB, error: errorB } = useLazyFetch(`/api/players/${idB}`, true);
  const { data: statsA, loading: loadingStatsA, error: errorStatsA } = useLazyFetch(`/api/players/${idA}/detailed-stats`, true);
  const { data: statsB, loading: loadingStatsB, error: errorStatsB } = useLazyFetch(`/api/players/${idB}/detailed-stats`, true);

  const isSamePlayer = String(idA) === String(idB);

  const nameA = playerA?.player?.name;
  const nameB = playerB?.player?.name;
  useEffect(() => {
    if (nameA && nameB) document.title = `${nameA} vs ${nameB} — KnowTheW`;
    return () => { document.title = 'KnowTheW'; };
  }, [nameA, nameB]);

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
          {/* Dual hero header */}
          <div className="compare-hero-pair">
            <div className="compare-hero-side">
              <PlayerHero
                player={playerA}
                loading={loadingA}
                error={errorA}
                onRetry={() => window.location.reload()}
              />
              <button type="button" className="compare-change-btn" onClick={() => openPickerFor('a')}>
                Change
              </button>
            </div>

            <div className="compare-hero-vs">VS</div>

            <div className="compare-hero-side compare-hero-side-b">
              <PlayerHero
                player={playerB}
                loading={loadingB}
                error={errorB}
                onRetry={() => window.location.reload()}
              />
              <button type="button" className="compare-change-btn" onClick={() => openPickerFor('b')}>
                Change
              </button>
            </div>
          </div>

          {/* Shared tab strip */}
          <div className="stat-type-tabs compare-tabs">
            {COMPARE_TABS.map(t => (
              <button
                key={t.key}
                type="button"
                className={`stat-type-tab${t.disabled ? ' soon' : activeTab === t.key ? ' active' : ''}`}
                disabled={!!t.disabled}
                onClick={t.disabled ? undefined : () => setActiveTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Career summary */}
          <CompareSummary
            statsA={statsA}
            statsB={statsB}
            emptyA={statsA?.empty === true}
            emptyB={statsB?.empty === true}
          />

          {/* Side-by-side per-season tables */}
          <div className="compare-tables">
            <div className="compare-table-wrap">
              <div className="compare-table-label">{nameA ?? 'Player A'}</div>
              <PlayerTable
                statsData={statsA}
                statsLoading={loadingStatsA}
                statsError={errorStatsA}
                onRetry={() => window.location.reload()}
                activeTab={activeTab}
              />
            </div>
            <div className="compare-table-wrap">
              <div className="compare-table-label">{nameB ?? 'Player B'}</div>
              <PlayerTable
                statsData={statsB}
                statsLoading={loadingStatsB}
                statsError={errorStatsB}
                onRetry={() => window.location.reload()}
                activeTab={activeTab}
              />
            </div>
          </div>
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
