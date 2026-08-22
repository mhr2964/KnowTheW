import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import StudyFlow from './StudyFlow';
import BrefTable, { fmt } from './BrefTable';
import TableToolbar from './TableToolbar';
import { buildStudyDeck } from '../lib/studyData';
import useLazyFetch from '../hooks/useLazyFetch';
import usePlayerBackgroundStats from '../hooks/usePlayerBackgroundStats';
import GameLogTab from './GameLogTab';
import AdvancedTab from './AdvancedTab';
import PlayByPlayTab from './PlayByPlayTab';
import SplitsTab from './SplitsTab';
import ShotChart from './ShotChart';

// Percentile coverage only exists for these viewModes (see percentileClient.js's PERCENTILE_STATS) --
// Per 100 Poss would need a league-wide team-pace fetch percentileClient.js doesn't do yet, so its
// toggle stays hidden rather than shown-but-inert. Adj. Shooting's TS%/eFG%/3PAr/FTr are ratios of
// fields already in the percentile system, so they ride the existing 'perGame' bucket (ratios are
// scale-invariant across PerGame/Totals/Per36 -- see percentileClient.js's withRatioStats).
const PERCENTILE_VIEW_MODE = { perGame: 'perGame', totals: 'totals', per36: 'per36', adjShooting: 'perGame' };
// Only these tabs get the Percentile toggle at all -- Per 100 Poss (no key here) has no coverage,
// and showing an inert toggle there was one of the three named table-inconsistency complaints
// ("percentile toggle doesn't work on some tabs").
const PERCENTILE_ELIGIBLE = new Set(Object.keys(PERCENTILE_VIEW_MODE));

const ALL_TABLE_TYPES = [
  { key: 'perGame',     label: 'Per Game' },
  { key: 'totals',      label: 'Totals' },
  { key: 'per36',       label: 'Per 36' },
  { key: 'per100',      label: 'Per 100 Poss' },
  { key: 'advanced',    label: 'Advanced' },
  { key: 'adjShooting', label: 'Adj. Shooting' },
  { key: 'gamelog',     label: 'Game Log' },
  { key: 'splits',      label: 'Splits' },
  { key: 'pbp',         label: 'Play-by-Play' },
  { key: 'shotchart',   label: 'Shot Chart' },
];
const COMING_SOON = [];

// 21 steps rather than a single 0/1 threshold -- fires often enough as the user scrolls to feel
// continuous, without a scroll-event listener of its own.
const SCROLL_THRESHOLDS = Array.from({ length: 21 }, (_, i) => i / 20);

const SOURCE_ACTIVE = {
  bdl:  new Set(['perGame', 'totals', 'per36']),
  wnba: new Set(['perGame', 'totals', 'per36', 'per100']),
  espn: new Set(['perGame', 'totals', 'per36', 'per100', 'advanced', 'adjShooting', 'gamelog', 'splits', 'pbp', 'shotchart']),
};

export default function DetailedStats({ playerId, playerName, onSaveDeck, initialTab, onTabChange }) {
  // initialTab seeds state once; subsequent changes come from handleTypeClick.
  // PlayerRoutePage keys <PlayerPage> on playerId so this re-runs on player switch.
  const [activeType, setActiveType] = useState(initialTab ?? 'perGame');
  const [activeSeason, setActiveSeason] = useState('regular');
  const [studyConfig, setStudyConfig] = useState(null);
  const [showPercentiles, setShowPercentiles] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [seasonIndicator, setSeasonIndicator] = useState(null); // 'regular' | 'playoffs' | null, from raw tabs
  const [seasonBarHidden, setSeasonBarHidden] = useState(false);
  const exportRef = useRef(null);
  const navRef = useRef(null);
  const seasonBarObserverRef = useRef(null);

  // Whichever raw tab is mounted reports its own season selection here via onSeasonChange (see
  // seasonIndicator above) -- this ref attaches to whatever tab's .stat-season-bar is currently in
  // the DOM (there's at most one at a time) so the sticky nav toggle knows when it's scrolled out
  // of view. A default-root IntersectionObserver tracks intersection with the VIEWPORT, not with
  // the sticky nav sitting on top of the bar -- the bar stays 100%-intersecting the viewport the
  // whole time it's merely covered by the nav, so the observer would never re-fire once scrolled
  // under it. rootMargin shrinks the effective top edge to the nav's own covered height (its sticky
  // `top` plus its own rendered height, read live off navRef rather than hardcoded -- the two
  // responsive.css breakpoints use 72px/112px and this adapts to either without duplicating either
  // number here) so "intersecting" and "hidden under the nav" become the same thing.
  const seasonBarRef = useCallback((node) => {
    seasonBarObserverRef.current?.disconnect();
    if (!node) { setSeasonBarHidden(false); return; }
    const navEl = navRef.current;
    const stickyTop = navEl ? parseFloat(getComputedStyle(navEl).top) || 0 : 0;
    const navCovered = navEl ? stickyTop + navEl.offsetHeight : 160; // 160 = safe fallback if navRef isn't set yet
    seasonBarObserverRef.current = new IntersectionObserver(
      ([entry]) => setSeasonBarHidden(!entry.isIntersecting),
      { rootMargin: `-${navCovered}px 0px 0px 0px`, threshold: SCROLL_THRESHOLDS }
    );
    seasonBarObserverRef.current.observe(node);
  }, []);
  const handleSeasonChange = useCallback((val) => setSeasonIndicator(val), []);

  const { data, loading, error, refetch: refetchCareer } = useLazyFetch(
    `/api/players/${playerId}/detailed-stats`,
    true
  );

  const { data: percData, loading: percLoading } = useLazyFetch(
    `/api/players/${playerId}/percentiles`,
    showPercentiles
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

  const availablePlayoffSeasons = useMemo(() => {
    const rows = data?.perGame?.playoffs?.rows ?? [];
    const seen = new Set();
    const seasons = [];
    for (const row of rows) {
      const s = String(row[0]);
      if (s && s !== 'undefined' && !seen.has(s)) { seen.add(s); seasons.push(s); }
    }
    return seasons.sort((a, b) => b.localeCompare(a));
  }, [data]);

  // Mobile-only "glance" strip (see .quick-stat-strip) -- the current season's PTS/REB/AST/FG%
  // right under the hero, zero extra taps/fetches (reuses the perGame data this component already
  // has). Matches on availableSeasons[0] rather than assuming row order, same as every other
  // "current season" lookup in this file/GameLogTab/etc.
  const quickStats = useMemo(() => {
    const cols = data?.perGame?.regular?.columns;
    const rows = data?.perGame?.regular?.rows;
    if (!cols?.length || !rows?.length || !availableSeasons.length) return null;
    const idx = key => cols.findIndex(c => c.key === key);
    const [ptsIdx, rebIdx, astIdx, fgPctIdx] = [idx('PTS'), idx('REB'), idx('AST'), idx('FG_PCT')];
    const season = availableSeasons[0];
    const row = rows.find(r => String(r[0]) === season);
    if (!row) return null;
    return { season, pts: row[ptsIdx], reb: row[rebIdx], ast: row[astIdx], fgPct: row[fgPctIdx] };
  }, [data, availableSeasons]);

  // Starts as soon as availableSeasons is known (not gated behind opening the PBP/Advanced tabs) --
  // see the hook for why it's fully sequential rather than firing everything at once. Gated to
  // source === 'espn': that's the only source with the pbp/advanced tabs enabled at all (see
  // SOURCE_ACTIVE below) -- a bulk-legacy BDL/WNBA player has nowhere to show this data, so there's
  // no reason to prefetch it.
  const bgSeasons        = data?.source === 'espn' ? availableSeasons : [];
  const bgPlayoffSeasons = data?.source === 'espn' ? availablePlayoffSeasons : [];
  const { pbp: pbpData, adv: advData, retry: retryBackgroundStats } = usePlayerBackgroundStats(
    playerId, bgSeasons, bgPlayoffSeasons
  );

  function handleTypeClick(key) {
    setActiveType(key);
    onTabChange?.(key);
    setMobileNavOpen(false);
    // React Router's navigate({replace:true}) (see PlayerRoutePage's onTabChange) doesn't reset
    // scroll position, and this component doesn't remount on a tab switch (only on player switch,
    // via PlayerRoutePage's key={id}) -- without this, picking a new tab from deep in a scrolled
    // table left you at that same scrollY against the NEW tab's (often much shorter) content, with
    // the sticky header/nav overlapping whatever was left mid-page. block:'start' respects the
    // sticky toggle's own top offset rather than jumping to the page's absolute top, so this is a
    // no-op on desktop (tabs live at the top there already, not sticky).
    navRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }

  // Shared by every tab (generic BrefTable tabs and all 5 raw-tab components) -- each tab builds
  // its own deck via studyData.js's buildStudyDeck and hands the finished {data, columns, deckName}
  // shape here, so there's exactly one StudyFlow overlay instance instead of one per tab.
  function openStudy(deck) {
    setStudyConfig(deck);
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
  const activeLabel = enabledTypes.find(t => t.key === safeType)?.label ?? safeType;

  const isGamelog   = safeType === 'gamelog';
  const isAdvanced  = safeType === 'advanced';
  const isSplits    = safeType === 'splits';
  const isPbp       = safeType === 'pbp';
  const isShotChart = safeType === 'shotchart';
  const isRawTab    = isGamelog || isAdvanced || isSplits || isPbp || isShotChart;
  const tableData  = isRawTab ? null : data[safeType];
  const hasPlayoffs = isRawTab ? false : !!tableData?.playoffs?.rows?.length;
  const curSeason = (!hasPlayoffs && activeSeason === 'playoffs') ? 'regular' : activeSeason;
  const regular = isRawTab ? null : (curSeason === 'regular' ? tableData?.regular : tableData?.playoffs);
  const career  = isRawTab ? null : (curSeason === 'regular' ? tableData?.regularCareer : tableData?.playoffCareer);

  // Raw tabs (Advanced/Game Log/Splits/PBP/Shot Chart) report their own season selection via
  // onSeasonChange/seasonIndicator (each owns its own state); the generic path already has
  // hasPlayoffs/curSeason in scope right here, so it doesn't need the round trip.
  const effectiveSeasonIndicator = isRawTab ? seasonIndicator : (hasPlayoffs ? curSeason : null);
  const seasonSuffix = (seasonBarHidden && effectiveSeasonIndicator)
    ? (effectiveSeasonIndicator === 'playoffs' ? 'Playoffs' : 'Season')
    : null;

  // percData is keyed by season -> viewMode using percentileClient.js's own mode keys (perGame/
  // totals/per36), which don't include 'adjShooting' -- remap that one view's lookup key so
  // BrefTable's own `percentiles?.[season]?.[viewMode]` (viewMode === safeType) still resolves,
  // without touching BrefTable itself or its unrelated hideLowPriority-by-viewMode logic.
  const percentileViewKey = PERCENTILE_VIEW_MODE[safeType];
  let percentilesForView = null;
  if (percData && percentileViewKey) {
    if (percentileViewKey === safeType) {
      percentilesForView = percData;
    } else {
      percentilesForView = {};
      for (const [season, byMode] of Object.entries(percData)) {
        percentilesForView[season] = { ...byMode, [safeType]: byMode[percentileViewKey] };
      }
    }
  }

  function openGenericStudy() {
    if (!regular) return;
    const typeLabel = ALL_TABLE_TYPES.find(t => t.key === safeType)?.label ?? safeType;
    const suffix = curSeason === 'playoffs' ? ' (Playoffs)' : '';
    const deck = buildStudyDeck({ columns: regular.columns, rows: regular.rows, careerRows: career?.rows ?? [] });
    openStudy({ ...deck, deckName: `${playerName} ${typeLabel}${suffix}` });
  }

  return (
    <>
      <div className="detailed-stats">
        {quickStats && (
          <div className="quick-stat-strip">
            <span className="quick-stat-season">{quickStats.season}</span>
            <span className="quick-stat-item"><strong>{fmt('num', quickStats.pts)}</strong> PTS</span>
            <span className="quick-stat-item"><strong>{fmt('num', quickStats.reb)}</strong> REB</span>
            <span className="quick-stat-item"><strong>{fmt('num', quickStats.ast)}</strong> AST</span>
            <span className="quick-stat-item"><strong>{fmt('pct', quickStats.fgPct)}</strong> FG%</span>
          </div>
        )}
        <div className="stat-type-nav" ref={navRef}>
          <button
            type="button"
            className="stat-type-nav-toggle"
            aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavOpen(v => !v)}
          >
            <span>
              {activeLabel}
              {seasonSuffix && <span className="stat-type-nav-season-suffix"> ({seasonSuffix})</span>}
            </span>
            <span className="stat-type-nav-caret" aria-hidden="true">▾</span>
          </button>
          {mobileNavOpen && <div className="stat-type-nav-backdrop" onClick={() => setMobileNavOpen(false)} />}
          <div className={`stat-type-tabs${mobileNavOpen ? ' open' : ''}`}>
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
        </div>

        {isAdvanced ? (
          <AdvancedTab data={advData} retry={retryBackgroundStats} playerName={playerName} onOpenStudy={openStudy} seasonBarRef={seasonBarRef} onSeasonChange={handleSeasonChange} />
        ) : isGamelog ? (
          <GameLogTab playerId={playerId} playerName={playerName} availableSeasons={availableSeasons} onOpenStudy={openStudy} seasonBarRef={seasonBarRef} onSeasonChange={handleSeasonChange} />
        ) : isSplits ? (
          <SplitsTab playerId={playerId} playerName={playerName} availableSeasons={availableSeasons} onOpenStudy={openStudy} seasonBarRef={seasonBarRef} onSeasonChange={handleSeasonChange} />
        ) : isPbp ? (
          <PlayByPlayTab data={pbpData} totalSeasons={availableSeasons.length} retry={retryBackgroundStats} playerName={playerName} onOpenStudy={openStudy} seasonBarRef={seasonBarRef} onSeasonChange={handleSeasonChange} />
        ) : isShotChart ? (
          <ShotChart playerId={playerId} playerName={playerName} availableSeasons={availableSeasons} availablePlayoffSeasons={availablePlayoffSeasons} onOpenStudy={openStudy} seasonBarRef={seasonBarRef} onSeasonChange={handleSeasonChange} />
        ) : (
          <>
            <TableToolbar
              leading={
                <div className="stat-season-bar" ref={seasonBarRef}>
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
              }
              showPercentile={!isEmpty && PERCENTILE_ELIGIBLE.has(safeType)}
              percentileChecked={showPercentiles}
              percentileLoading={percLoading}
              onPercentileToggle={() => setShowPercentiles(v => !v)}
              showStudy={!!regular}
              onStudy={openGenericStudy}
              showExport={!!regular}
              onExport={() => exportRef.current?.()}
            />
            <BrefTable
              regular={regular}
              career={career}
              percentiles={showPercentiles && !percLoading ? percentilesForView : null}
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
