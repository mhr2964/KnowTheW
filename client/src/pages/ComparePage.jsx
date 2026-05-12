import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useLazyFetch from '../hooks/useLazyFetch';
import ComparePickerModal from '../components/ComparePickerModal';
import CompareModeToggle from '../components/CompareModeToggle';
import CompareVerdict from '../components/CompareVerdict';
import GradeGrid from '../components/GradeGrid';
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
  const rows = details?.perGame?.regular?.rows;
  if (!Array.isArray(rows) || rows.length === 0) return null;
  // Rows are ordered ascending by season year; last row = most recent season.
  const lastRow = rows[rows.length - 1];
  // Index 1 is TEAM_ABBREVIATION per ESPN_DETAILED_HEADERS.
  const abbr = lastRow?.[1];
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
        <button type="button" className="compare-change-link" onClick={onChangeSide}>Change</button>
      </div>
    </div>
  );
}

function GradeGridSkeleton() {
  return (
    <div className="grade-grid grade-grid--skeleton">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="grade-grid-skeleton-row" />
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
  const { data: reportA, loading: loadingReportA, error: errorReportA } = useLazyFetch(reportUrlA, reportsEnabled);
  const { data: reportB, loading: loadingReportB, error: errorReportB } = useLazyFetch(reportUrlB, reportsEnabled);

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

          {bothUnavailable ? (
            <div className="compare-ai-unavailable">
              <p>AI-graded reports are temporarily unavailable. Try again later or switch modes.</p>
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
                mode={mode}
                loading={bothReportsLoading}
                errorA={errorReportA}
                errorB={errorReportB}
              />

              {/* Grade grid */}
              {bothReportsLoading
                ? <GradeGridSkeleton />
                : <GradeGrid
                    reportA={effectiveReportA}
                    reportB={effectiveReportB}
                    nameA={nameA}
                    nameB={nameB}
                  />
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
