import { useState, useEffect, useRef } from 'react';
import BrefTable from './BrefTable';
import TableToolbar from './TableToolbar';
import { buildStudyDeck } from '../lib/studyData';
import useSeasonScopedFetch from '../hooks/useSeasonScopedFetch';

const GL_PAGE_SIZES = [10, 25, 50];

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

function GameLogTable({ log, games, filename, exportRef }) {
  const regular = toBrefShape(log, games);
  return (
    <BrefTable
      regular={regular}
      emptyMessage="No games logged yet."
      cellClassName={(row, col) => col.key === 'result' ? (row[col.idx]?.startsWith('W') ? 'gl-win' : 'gl-loss') : undefined}
      filename={filename}
      exportRef={exportRef}
    />
  );
}

export default function GameLogTab({ playerId, playerName, availableSeasons, onOpenStudy }) {
  const [gameLogSeason, setGameLogSeason] = useState(null);
  const [glPage, setGlPage] = useState(1);
  const [glPageSize, setGlPageSize] = useState(25);
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
    setGlPage(1);
  }

  function handlePageSizeChange(size) {
    setGlPageSize(size);
    setGlPage(1);
  }

  const allGames = currentLog?.games ?? [];
  const totalPages = Math.max(1, Math.ceil(allGames.length / glPageSize));
  const safePage = Math.min(glPage, totalPages);
  const pagedGames = allGames.slice((safePage - 1) * glPageSize, safePage * glPageSize);

  // Study deck covers the whole season, not just the current page -- toBrefShape is cheap (pure
  // reshape, no fetch) so re-deriving it here from allGames alongside GameLogTable's own paged
  // call is fine.
  function openStudy() {
    const full = toBrefShape(currentLog, allGames);
    if (!full) return;
    const deck = buildStudyDeck({ columns: full.columns, rows: full.rows });
    onOpenStudy?.({ ...deck, deckName: `${playerName} Game Log ${gameLogSeason}` });
  }

  return (
    <>
      <TableToolbar
        leading={
          <>
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
            <select
              className="gl-select"
              value={glPageSize}
              onChange={e => handlePageSizeChange(Number(e.target.value))}
            >
              {GL_PAGE_SIZES.map(n => (
                <option key={n} value={n}>{n} per page</option>
              ))}
            </select>
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
        <>
          <GameLogTable log={currentLog} games={pagedGames} filename={`${playerName}-gamelog-${gameLogSeason}.csv`} exportRef={exportRef} />
          {totalPages > 1 && (
            <div className="gl-pagination">
              <button
                type="button"
                className="gl-page-btn"
                onClick={() => setGlPage(p => Math.max(1, p - 1))}
                disabled={safePage <= 1}
              >
                ‹ Prev
              </button>
              <span className="gl-page-info">Page {safePage} of {totalPages}</span>
              <button
                type="button"
                className="gl-page-btn"
                onClick={() => setGlPage(p => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
              >
                Next ›
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}
