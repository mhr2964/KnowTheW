import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useLazyFetch from '../hooks/useLazyFetch';
import ComparePickerModal from '../components/ComparePickerModal';
import CompareModeToggle from '../components/CompareModeToggle';
import CompareVerdict from '../components/CompareVerdict';
import GradeCard, { CATEGORIES } from '../components/GradeCard';
import ArchetypeBadge from '../components/ArchetypeBadge';
import FingerprintRadar from '../components/FingerprintRadar';
import { initialsOf } from '../lib/initials';

// ESPN canonical headshot URL — used as fallback when the roster feed omits a headshot.
function espnHeadshotUrl(id) {
  return `https://a.espncdn.com/i/headshots/wnba/players/full/${id}.png`;
}

// Abbreviated → full team name for the teams that appear in WNBA history.
const TEAM_ABBR_MAP = {
  SEA: 'Seattle Storm',
  PHX: 'Phoenix Mercury',
  MIN: 'Minnesota Lynx',
  IND: 'Indiana Fever',
  NY:  'New York Liberty',
  NYL: 'New York Liberty',
  LVA: 'Las Vegas Aces',
  LAS: 'Las Vegas Aces',
  SA:  'San Antonio Stars',
  SAS: 'San Antonio Silver Stars',
  UTA: 'Utah Starzz',
  LAL: 'Los Angeles Sparks',
  LA:  'Los Angeles Sparks',
  CON: 'Connecticut Sun',
  ORL: 'Orlando Miracle',
  WAS: 'Washington Mystics',
  CHI: 'Chicago Sky',
  ATL: 'Atlanta Dream',
  DAL: 'Dallas Wings',
  TUL: 'Tulsa Shock',
  DET: 'Detroit Shock',
  GSV: 'Golden State Valkyries',
};

// Pull the most recent season's team abbreviation from a detailed-stats response.
// Returns the full team name (or abbreviation as fallback) or null if unavailable.
function deriveLastTeamName(details) {
  const table = details?.perGame?.regular;
  const rows = table?.rows;
  if (!Array.isArray(rows) || rows.length === 0) return null;
  // Rows are ordered ascending by season year; last row = most recent season.
  const lastRow = rows[rows.length - 1];
  // Resolve the team-abbreviation column by NAME from the response's own columns, rather than a
  // hardcoded positional index — the client shouldn't depend on the server's column ordering.
  const abbrIdx = table.columns?.findIndex(c => c.key === 'TEAM_ABBREVIATION') ?? -1;
  const abbr = abbrIdx >= 0 ? lastRow?.[abbrIdx] : null;
  if (!abbr || abbr === '') return null;
  return TEAM_ABBR_MAP[abbr] ?? abbr;
}

function PlayerHero({ player, loading, error, onChangeSide, sideB, finalTeamName }) {
  const sideBClass = sideB ? ' compare-hero-side-b' : '';
  const [imgError, setImgError] = useState(false);

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
  const isRetired = p.retired === true;
  const displayTeam = p.teamName ?? (isRetired ? finalTeamName : null);
  const imgSrc = p.headshot ?? espnHeadshotUrl(p.id);

  return (
    <div className={`compare-hero-player${sideBClass}`}>
      {!imgError
        ? <img
            src={imgSrc}
            alt={p.name}
            className="compare-hero-img"
            onError={() => setImgError(true)}
          />
        : <div className="compare-hero-img placeholder">{initialsOf(p.name)}</div>
      }
      <div className="compare-hero-info">
        <div className="compare-hero-meta">
          {p.jersey && <span className="player-hero-jersey">#{p.jersey}</span>}
          {displayTeam && (
            <span className="player-hero-team">
              {displayTeam}{isRetired && !p.teamName && <em className="compare-hero-former"> (former)</em>}
            </span>
          )}
        </div>
        <h2 className="compare-hero-name">{p.name}</h2>
        <ArchetypeBadge playerId={p.id} />
        <button type="button" className="compare-change-link" onClick={onChangeSide}>Change</button>
      </div>
    </div>
  );
}

// Career-wide playstyle profile — independent of the Peak/Career/Playoffs mode toggle, so it
// typically resolves well before the AI-graded report does and fills the page during that wait
// instead of leaving it blank. Renders nothing if either side's sample is too thin for a fingerprint
// (server returns dimensions: null), matching how ArchetypeBadge already handles that case.
function ArchetypeRadarSection({ archA, archB, nameA, nameB }) {
  const dimsA = archA?.dimensions;
  const dimsB = archB?.dimensions;
  if (!Array.isArray(dimsA) || !Array.isArray(dimsB)) return null;
  return (
    <div className="compare-radar-section">
      <p className="compare-radar-caption">
        Career playstyle profile — percentile-based, not affected by the mode toggle above.
      </p>
      <FingerprintRadar dimensions={dimsA} overlay={dimsB} />
      <div className="compare-radar-legend">
        <span className="compare-radar-legend-item compare-radar-legend-item--a">{nameA}</span>
        <span className="compare-radar-legend-item compare-radar-legend-item--b">{nameB}</span>
      </div>
    </div>
  );
}

function GradeCardListSkeleton() {
  return (
    <div className="grade-card-list">
      {CATEGORIES.map(cat => (
        <div key={cat} className="grade-card grade-card--skeleton">
          <div className="grade-card-skeleton-header" />
          <div className="grade-card-panels">
            <div className="grade-card-skeleton-panel" />
            <div className="grade-card-skeleton-panel" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ComparePage() {
  const { idA, idB } = useParams();
  const navigate = useNavigate();
  const [mode, setMode] = useState('career');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState(null);

  const isSamePlayer = String(idA) === String(idB);
  const reportsEnabled = !isSamePlayer;

  // Player profile fetches — always enabled
  const { data: playerA, loading: loadingA, error: errorA } = useLazyFetch(`/api/players/${idA}`, true);
  const { data: playerB, loading: loadingB, error: errorB } = useLazyFetch(`/api/players/${idB}`, true);

  // Detailed stats — fetched only for retired players to derive their final team name.
  // Retired flag is not known until the profile resolves, so we enable only after.
  const retiredA = (playerA?.player ?? playerA)?.retired === true;
  const retiredB = (playerB?.player ?? playerB)?.retired === true;
  const { data: detailsA } = useLazyFetch(`/api/players/${idA}/detailed-stats`, retiredA && !loadingA);
  const { data: detailsB } = useLazyFetch(`/api/players/${idB}/detailed-stats`, retiredB && !loadingB);

  // Graded reports — re-fetch when mode changes (url key changes)
  const reportUrlA = `/api/players/${idA}/graded-report?mode=${mode}`;
  const reportUrlB = `/api/players/${idB}/graded-report?mode=${mode}`;
  const { data: reportA, loading: loadingReportA, error: errorReportA, refetch: refetchA } = useLazyFetch(reportUrlA, reportsEnabled);
  const { data: reportB, loading: loadingReportB, error: errorReportB, refetch: refetchB } = useLazyFetch(reportUrlB, reportsEnabled);

  // Archetype/playstyle fingerprints for the radar overlay — career-wide, not mode-scoped, so this
  // fetch is independent of `mode` and (being Mongo-cached, not an LLM call) usually resolves long
  // before the graded reports do. A second, independent hit of the same endpoint ArchetypeBadge
  // calls internally in the hero above — an accepted cheap duplicate rather than prop-drilling.
  const { data: archA } = useLazyFetch(`/api/players/${idA}/archetype`, reportsEnabled);
  const { data: archB } = useLazyFetch(`/api/players/${idB}/archetype`, reportsEnabled);

  const nameA = playerA?.player?.name ?? playerA?.name ?? 'Player A';
  const nameB = playerB?.player?.name ?? playerB?.name ?? 'Player B';

  const finalTeamNameA = useMemo(() => deriveLastTeamName(detailsA), [detailsA]);
  const finalTeamNameB = useMemo(() => deriveLastTeamName(detailsB), [detailsB]);

  useEffect(() => {
    if (isSamePlayer) {
      document.title = 'Compare players — KnowTheW';
    } else if (nameA !== 'Player A' && nameB !== 'Player B') {
      document.title = `${nameA} vs ${nameB} — KnowTheW`;
    }
    return () => { document.title = 'KnowTheW'; };
  }, [nameA, nameB, isSamePlayer]);

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

  const bothReportsLoading = loadingReportA || loadingReportB;

  // Per-spec: 503 or error on one side should still render the other
  const reportAData = errorReportA ? null : reportA;
  const reportBData = errorReportB ? null : reportB;

  const bothUnavailable = errorReportA && errorReportB;

  // Empty-state for playoffs (server returns { empty: true })
  const emptyA = reportA?.empty === true;
  const emptyB = reportB?.empty === true;

  const effectiveReportA = emptyA ? null : reportAData;
  const effectiveReportB = emptyB ? null : reportBData;

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
          <div className="compare-hero-pair">
            <PlayerHero
              player={playerA}
              loading={loadingA}
              error={errorA}
              onChangeSide={() => openPickerFor('a')}
              finalTeamName={finalTeamNameA}
            />
            <div className="compare-hero-vs">VS</div>
            <PlayerHero
              player={playerB}
              loading={loadingB}
              error={errorB}
              onChangeSide={() => openPickerFor('b')}
              sideB
              finalTeamName={finalTeamNameB}
            />
          </div>

          <CompareModeToggle
            mode={mode}
            onChange={setMode}
            reportA={effectiveReportA}
            reportB={effectiveReportB}
            loadingA={loadingReportA}
            loadingB={loadingReportB}
          />

          <ArchetypeRadarSection archA={archA} archB={archB} nameA={nameA} nameB={nameB} />

          {bothUnavailable ? (
            <div className="compare-ai-unavailable">
              <p>AI-graded reports are temporarily unavailable.</p>
              <div className="compare-ai-unavailable-retries">
                <button type="button" className="btn-ghost compare-verdict-retry" onClick={refetchA}>Retry {nameA}</button>
                <button type="button" className="btn-ghost compare-verdict-retry" onClick={refetchB}>Retry {nameB}</button>
              </div>
            </div>
          ) : (
            <>
              {bothReportsLoading && (
                <div className="compare-loading-hint">
                  <span className="compare-loading-dot" />
                  Generating AI grades — this can take up to a minute on first load
                </div>
              )}
              <CompareVerdict
                reportA={effectiveReportA}
                reportB={effectiveReportB}
                nameA={nameA}
                nameB={nameB}
                loading={bothReportsLoading}
                errorA={errorReportA}
                errorB={errorReportB}
                onRetryA={refetchA}
                onRetryB={refetchB}
              />

              {/* Category cards — always expanded, no collapse */}
              {bothReportsLoading
                ? <GradeCardListSkeleton />
                : (
                  <div className="grade-card-list">
                    {CATEGORIES.map(cat => (
                      <GradeCard
                        key={cat}
                        category={cat}
                        reportA={effectiveReportA}
                        reportB={effectiveReportB}
                        nameA={nameA}
                        nameB={nameB}
                      />
                    ))}
                  </div>
                )
              }
            </>
          )}

          {/* Playoffs empty state — single side or both */}
          {mode === 'playoffs' && (emptyA || emptyB) && !bothReportsLoading && (
            <div className="compare-playoffs-empty">
              {emptyA && <p>{nameA} has no playoff data.</p>}
              {emptyB && <p>{nameB} has no playoff data.</p>}
            </div>
          )}

          <p className="compare-ai-disclaimer">
            AI-generated grades — based on box-score data. May contain inaccuracies.
          </p>
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
