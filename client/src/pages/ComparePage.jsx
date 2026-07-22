import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useLazyFetch from '../hooks/useLazyFetch';
import ComparePickerModal from '../components/ComparePickerModal';
import CompareModeToggle from '../components/CompareModeToggle';
import CompareVerdict from '../components/CompareVerdict';
import GradeCard, { CATEGORIES } from '../components/GradeCard';
import { setPageMeta, resetPageMeta } from '../lib/pageMeta';

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

  // Combinatorial player-pair pages are excluded from indexing (see robots.txt/sitemap.js) — too
  // many low-uniqueness permutations to be a good search landing page — but still get real
  // title/description for tab titles, bookmarks, and social shares of a specific comparison.
  useEffect(() => {
    if (isSamePlayer) {
      setPageMeta('Compare players — KnowTheW', 'Compare WNBA player stats and AI-graded reports side by side on KnowTheW.', { noindex: true });
    } else if (nameA !== 'Player A' && nameB !== 'Player B') {
      setPageMeta(`${nameA} vs ${nameB} — KnowTheW`, `Side-by-side stat comparison and AI-graded report: ${nameA} vs ${nameB} on KnowTheW.`, { noindex: true });
    }
    return resetPageMeta;
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
                archA={archA}
                archB={archB}
                loading={bothReportsLoading}
                errorA={errorReportA}
                errorB={errorReportB}
                onRetryA={refetchA}
                onRetryB={refetchB}
                playerA={playerA}
                playerB={playerB}
                loadingHeroA={loadingA}
                loadingHeroB={loadingB}
                errorHeroA={errorA}
                errorHeroB={errorB}
                onChangeSideA={() => openPickerFor('a')}
                onChangeSideB={() => openPickerFor('b')}
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
