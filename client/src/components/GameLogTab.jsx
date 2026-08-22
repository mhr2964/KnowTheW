import { useState, useEffect, useRef } from 'react';
import BrefTable from './BrefTable';
import TableToolbar from './TableToolbar';
import { buildStudyDeck } from '../lib/studyData';
import useSeasonScopedFetch from '../hooks/useSeasonScopedFetch';

// The gamelog API returns every stat as a string (even plain numbers, e.g. "20"), and 'pct'
// values as 0-100 percentages rather than BrefTable's shared 0-1-fraction convention. Parse
// numeric-looking strings into real numbers here (so column sorting compares numerically
// instead of lexicographically) and normalize 'pct' to match detailed-stats. Combined
// make-attempt strings like "3-6" aren't valid numbers and are left as display strings.
function toBrefShape(log, games) {
  if (!log?.columns?.length || !games?.length) return null;
  const columns = [
    { key: 'date', label: 'Date', kind: 'date' },
    { key: 'opp', label: 'Opp' },
    { key: 'result', label: 'Result' },
    ...log.columns,
  ];
  const rows = games.map(g => [
    g.date,
    `${g.atVs} ${g.opponent}`,
    `${g.result} ${g.teamScore}-${g.oppScore}`,
    ...log.columns.map(col => {
      const raw = g.stats[col.key];
      if (col.kind === 'pct') {
        const n = parseFloat(raw);
        return Number.isNaN(n) ? null : n / 100;
      }
      const n = Number(raw);
      return Number.isNaN(n) ? raw : n;
    }),
  ]);
  return { columns, rows };
}

function GameLogTable({ log, games, filename, exportRef, paginationResetKey }) {
  const regular = toBrefShape(log, games);
  return (
    <BrefTable
      regular={regular}
      emptyMessage="No games logged yet."
      cellClassName={(row, col) => col.key === 'result' ? (row[col.idx]?.startsWith('W') ? 'gl-win' : 'gl-loss') : undefined}
      filename={filename}
      exportRef={exportRef}
      paginate
      paginationResetKey={paginationResetKey}
    />
  );
}

export default function GameLogTab({ playerId, playerName, availableSeasons, onOpenStudy, seasonBarRef, onSeasonChange }) {
  const [gameLogSeason, setGameLogSeason] = useState(null);
  const [glSeasonType, setGlSeasonType] = useState('regular');
  const exportRef = useRef(null);

  useEffect(() => {
    if (!gameLogSeason && availableSeasons.length > 0) {
      setGameLogSeason(availableSeasons[0]);
    }
  }, [gameLogSeason, availableSeasons]);

  const gameLogUrl = gameLogSeason ? `/api/players/${playerId}/gamelog?season=${gameLogSeason}` : null;
  const { data: currentLog, loading: gameLogLoading, error: gameLogError, retry: retryGameLog } = useSeasonScopedFetch(gameLogUrl);

  function handleSeasonChange(season) {
    setGameLogSeason(season);
    setGlSeasonType('regular');
  }

  function handleSeasonTypeChange(type) {
    setGlSeasonType(type);
  }

  // Both providers tag every game postseason:boolean (BDL from /games, ESPN from the seasonType's
  // displayName -- see espn/gamelog.js's normalizeGameLog) -- a combined season log intentionally
  // mixes regular + playoff games (matches ESPN's own gamelog behavior), so this is the one place
  // that splits them back apart for display. The toggle only renders when the selected season
  // actually has playoff games logged; otherwise every game is already "regular" and there's
  // nothing to switch between.
  const rawGames = currentLog?.games ?? [];
  const hasPlayoffGames = rawGames.some(g => g.postseason);
  const allGames = rawGames.filter(g => !!g.postseason === (glSeasonType === 'playoffs'));

  // Reports up to DetailedStats' sticky-nav season indicator (see AdvancedTab for the same pattern).
  useEffect(() => {
    onSeasonChange?.(hasPlayoffGames ? glSeasonType : null);
  }, [hasPlayoffGames, glSeasonType, onSeasonChange]);

  // Study deck covers the whole season, not just the current page -- BrefTable's own pagination
  // (paginate prop below) only slices what it renders, not the rows/CSV export/exportRef it's
  // handed, so allGames here and GameLogTable's own allGames prop are already the same full set.
  function openStudy() {
    const full = toBrefShape(currentLog, allGames);
    if (!full) return;
    const suffix = glSeasonType === 'playoffs' ? ' (Playoffs)' : '';
    const deck = buildStudyDeck({ columns: full.columns, rows: full.rows });
    onOpenStudy?.({ ...deck, deckName: `${playerName} Game Log ${gameLogSeason}${suffix}` });
  }

  return (
    <>
      <TableToolbar
        leading={
          <>
            {hasPlayoffGames && (
              <div className="stat-season-bar" ref={seasonBarRef}>
                <button
                  type="button"
                  className={`stat-season-tab${glSeasonType === 'regular' ? ' active' : ''}`}
                  onClick={() => handleSeasonTypeChange('regular')}
                >
                  Regular Season
                </button>
                <button
                  type="button"
                  className={`stat-season-tab${glSeasonType === 'playoffs' ? ' active' : ''}`}
                  onClick={() => handleSeasonTypeChange('playoffs')}
                >
                  Playoffs
                </button>
              </div>
            )}
            {availableSeasons.length > 1 && (
              <select
                className="gl-select"
                value={gameLogSeason ?? ''}
                onChange={e => handleSeasonChange(e.target.value)}
              >
                {availableSeasons.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            )}
            {allGames.length > 0 && <span className="gl-game-count">{allGames.length} games</span>}
          </>
        }
        showStudy={allGames.length > 0}
        onStudy={openStudy}
        showExport={allGames.length > 0}
        onExport={() => exportRef.current?.()}
      />
      {gameLogLoading && <p className="status-msg" style={{ padding: '1rem 0' }}>Loading game log…</p>}
      {gameLogError && (
        <p className="status-msg error" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          Could not load game log.
          <button type="button" className="btn-ghost compare-verdict-retry" onClick={retryGameLog}>Try again</button>
        </p>
      )}
      {!gameLogLoading && !gameLogError && (
        <GameLogTable
          log={currentLog}
          games={allGames}
          filename={`${playerName}-gamelog-${gameLogSeason}${glSeasonType === 'playoffs' ? '-playoffs' : ''}.csv`}
          exportRef={exportRef}
          paginationResetKey={`${gameLogSeason}-${glSeasonType}`}
        />
      )}
    </>
  );
}
