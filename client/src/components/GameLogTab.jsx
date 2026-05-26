import { useState, useEffect, useRef } from 'react';
import HeaderTooltip from './HeaderTooltip';
import { STAT_DEFINITIONS } from '../lib/statDefinitions';

const GL_PAGE_SIZES = [10, 25, 50];

// Server supplies column metadata ({key,label,kind}); the client just formats by kind.
// 'pct' values are 0-100 and render as a 3-dp fraction (60.0 -> ".600").
function fmtGame(kind, val) {
  if (val === null || val === undefined || val === '') return '—';
  if (kind === 'pct') {
    const n = parseFloat(val);
    if (isNaN(n)) return '—';
    return (n / 100).toFixed(3).replace(/^0\./, '.');
  }
  return String(val);
}

function GameLogTable({ log, games }) {
  if (!log?.columns?.length || !games?.length) return <p className="stats-na">No games logged yet.</p>;
  const { columns } = log;
  return (
    <div className="bref-wrap">
      <table className="bref-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Opp</th>
            <th>Result</th>
            {columns.map(col => (
              <th key={col.key}>
                <HeaderTooltip label={col.label} definition={STAT_DEFINITIONS[col.key]} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {games.map((g, i) => {
            const date = new Date(g.date);
            const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const oppStr = `${g.atVs} ${g.opponent}`;
            const resultStr = `${g.result} ${g.teamScore}-${g.oppScore}`;
            return (
              <tr key={i}>
                <td className="td-l">{dateStr}</td>
                <td className="td-l">{oppStr}</td>
                <td className={`td-l gl-${g.result === 'W' ? 'win' : 'loss'}`}>{resultStr}</td>
                {columns.map(col => (
                  <td key={col.key}>{fmtGame(col.kind, g.stats[col.key])}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function GameLogTab({ playerId, availableSeasons }) {
  const [gameLogSeason, setGameLogSeason] = useState(null);
  const [gameLogCache, setGameLogCache] = useState({});
  const [gameLogLoading, setGameLogLoading] = useState(false);
  const [gameLogError, setGameLogError] = useState(false);
  const [gameLogRetryCount, setGameLogRetryCount] = useState(0);
  const [glPage, setGlPage] = useState(1);
  const [glPageSize, setGlPageSize] = useState(25);
  const gameLogAbortRef = useRef(null);
  const gameLogFetchedRef = useRef(new Set());

  useEffect(() => {
    if (!gameLogSeason && availableSeasons.length > 0) {
      setGameLogSeason(availableSeasons[0]);
    }
  }, [gameLogSeason, availableSeasons]);

  useEffect(() => {
    if (!gameLogSeason) return;
    if (gameLogFetchedRef.current.has(gameLogSeason)) return;
    gameLogFetchedRef.current.add(gameLogSeason);

    gameLogAbortRef.current?.abort();
    const controller = new AbortController();
    gameLogAbortRef.current = controller;
    setGameLogLoading(true);
    setGameLogError(false);

    fetch(`/api/players/${playerId}/gamelog?season=${gameLogSeason}`, { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(d => {
        setGameLogCache(prev => ({ ...prev, [gameLogSeason]: d }));
        setGameLogLoading(false);
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          gameLogFetchedRef.current.delete(gameLogSeason);
          setGameLogError(true);
          setGameLogLoading(false);
        }
      });

    return () => controller.abort();
  }, [gameLogSeason, playerId, gameLogRetryCount]);

  useEffect(() => () => { gameLogAbortRef.current?.abort(); }, []);

  function handleSeasonChange(season) {
    setGameLogSeason(season);
    setGlPage(1);
    setGameLogError(false);
  }

  function handlePageSizeChange(size) {
    setGlPageSize(size);
    setGlPage(1);
  }

  const currentLog = gameLogCache[gameLogSeason] ?? null;
  const allGames = currentLog?.games ?? [];
  const totalPages = Math.max(1, Math.ceil(allGames.length / glPageSize));
  const safePage = Math.min(glPage, totalPages);
  const pagedGames = allGames.slice((safePage - 1) * glPageSize, safePage * glPageSize);

  return (
    <>
      <div className="gl-controls">
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
        {allGames.length > 0 && (
          <span className="gl-game-count">{allGames.length} games</span>
        )}
      </div>
      {gameLogLoading && <p className="status-msg" style={{ padding: '1rem 0' }}>Loading game log…</p>}
      {gameLogError && (
        <p className="status-msg error" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          Could not load game log.
          <button type="button" className="btn-ghost compare-verdict-retry" onClick={() => { setGameLogError(false); setGameLogRetryCount(c => c + 1); }}>Try again</button>
        </p>
      )}
      {!gameLogLoading && !gameLogError && (
        <>
          <GameLogTable log={currentLog} games={pagedGames} />
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
