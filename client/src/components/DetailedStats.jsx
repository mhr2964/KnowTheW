import { useState, useEffect, useRef, useMemo } from 'react';
import StudyFlow from './StudyFlow';
import useLazyFetch from '../hooks/useLazyFetch';
import { HIDDEN, LABELS, PCT_COLS, PCT100_COLS, deriveColumns } from '../lib/statsColumns';

const LEFT_COLS = new Set(['SEASON_ID', 'TEAM_ABBREVIATION']);

function fmt(key, val) {
  if (val === null || val === undefined || val === '') return '—';
  if (PCT_COLS.has(key)) {
    if (typeof val !== 'number') return '—';
    return val.toFixed(3).replace(/^0\./, '.');
  }
  if (PCT100_COLS.has(key)) {
    if (typeof val !== 'number') return '—';
    return (val * 100).toFixed(1);
  }
  if (typeof val === 'number' && !Number.isInteger(val)) return val.toFixed(1);
  return String(val);
}

function ordinal(n) {
  if (n === null || n === undefined) return null;
  const v = n % 100;
  const suffix = (v >= 11 && v <= 13) ? 'th' : (['th','st','nd','rd'][n % 10] || 'th');
  return `${n}${suffix}`;
}

function percColor(p) {
  if (p === null || p === undefined) return undefined;
  const alpha = (Math.abs(p - 50) / 50) * 0.5;
  if (p > 50) return `rgba(34,197,94,${alpha.toFixed(3)})`;
  if (p < 50) return `rgba(239,68,68,${alpha.toFixed(3)})`;
  return undefined;
}

function BrefTable({ regular, career, percentiles, viewMode = 'perGame' }) {
  if (!regular) return <p className="stats-na">No data available.</p>;
  const { headers, rows } = regular;
  const cols = headers
    .map((h, i) => ({ key: h, idx: i, label: LABELS[h] ?? h }))
    .filter(c => !HIDDEN.has(c.key));
  const careerRow = career?.rows?.[0];

  return (
    <div className="bref-wrap">
      <table className="bref-table">
        <thead>
          <tr>{cols.map(c => <th key={c.key}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => {
            const seasonPerc = percentiles?.[String(row[0])]?.[viewMode];
            return (
              <tr key={ri}>
                {cols.map(c => {
                  const raw  = row[c.idx];
                  const perc = seasonPerc?.[c.key];
                  return (
                    <td
                      key={c.key}
                      className={LEFT_COLS.has(c.key) ? 'td-l' : ''}
                      style={{ backgroundColor: percColor(perc) }}
                      title={perc !== null && perc !== undefined ? `${ordinal(perc)} percentile` : undefined}
                    >
                      {fmt(c.key, raw)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
          {careerRow && (
            <tr className="career-row">
              {cols.map(c => (
                <td key={c.key} className={LEFT_COLS.has(c.key) ? 'td-l' : ''}>
                  {c.key === 'SEASON_ID' ? 'Career'
                    : c.key === 'TEAM_ABBREVIATION' ? ''
                    : fmt(c.key, careerRow[c.idx])}
                </td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

const GAMELOG_LABELS = {
  minutes: 'MP', points: 'PTS', totalRebounds: 'REB',
  assists: 'AST', steals: 'STL', blocks: 'BLK', turnovers: 'TOV',
  'fieldGoalsMade-fieldGoalsAttempted': 'FG',
  fieldGoalPct: 'FG%',
  'threePointFieldGoalsMade-threePointFieldGoalsAttempted': '3P',
  threePointPct: '3P%',
  'freeThrowsMade-freeThrowsAttempted': 'FT',
  freeThrowPct: 'FT%',
  fouls: 'PF',
};
const GAMELOG_PCT = new Set(['fieldGoalPct', 'threePointPct', 'freeThrowPct']);

function fmtGame(name, val) {
  if (val === null || val === undefined || val === '') return '—';
  if (GAMELOG_PCT.has(name)) {
    const n = parseFloat(val);
    if (isNaN(n)) return '—';
    return (n / 100).toFixed(3).replace(/^0\./, '.');
  }
  return String(val);
}

function GameLogTable({ log, games }) {
  if (!log?.names?.length || !games?.length) return <p className="stats-na">No games logged yet.</p>;
  const { names } = log;
  return (
    <div className="bref-wrap">
      <table className="bref-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Opp</th>
            <th>Result</th>
            {names.map(n => <th key={n}>{GAMELOG_LABELS[n] ?? n}</th>)}
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
                {g.stats.map((val, si) => (
                  <td key={si}>{fmtGame(names[si], val)}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}


const ALL_TABLE_TYPES = [
  { key: 'perGame',  label: 'Per Game' },
  { key: 'totals',   label: 'Totals' },
  { key: 'per36',    label: 'Per 36' },
  { key: 'per100',   label: 'Per 100 Poss' },
  { key: 'advanced', label: 'Advanced' },
  { key: 'gamelog',  label: 'Game Log' },
];
const COMING_SOON = ['Shooting', 'Adj. Shooting', 'Play-by-Play'];

const SOURCE_ACTIVE = {
  bdl:  new Set(['perGame', 'totals', 'per36']),
  wnba: new Set(['perGame', 'totals', 'per36', 'per100']),
  espn: new Set(['perGame', 'totals', 'per36', 'advanced', 'gamelog']),
};

const GL_PAGE_SIZES = [10, 25, 50];

export default function DetailedStats({ playerId, playerName, onSaveDeck }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeType, setActiveType] = useState('perGame');
  const [activeSeason, setActiveSeason] = useState('regular');
  const [advSeason, setAdvSeason] = useState('regular');
  const [studyConfig, setStudyConfig] = useState(null);

  const [gameLogSeason, setGameLogSeason] = useState(null);
  const [gameLogCache, setGameLogCache] = useState({});
  const [gameLogLoading, setGameLogLoading] = useState(false);
  const [gameLogError, setGameLogError] = useState(false);
  const [glPage, setGlPage] = useState(1);
  const [glPageSize, setGlPageSize] = useState(25);
  const gameLogAbortRef = useRef(null);
  const gameLogFetchedRef = useRef(new Set());

  const [showPercentiles, setShowPercentiles] = useState(false);
  const [percData, setPercData] = useState(null);
  const [percLoading, setPercLoading] = useState(false);
  const percAbortRef = useRef(null);
  const percFetchedRef = useRef(false);

  const { data: pbpAllData, loading: pbpAllLoading, error: pbpAllError } = useLazyFetch(
    `/api/players/${playerId}/advanced-pbp-all`,
    activeType === 'advanced'
  );

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetch(`/api/players/${playerId}/detailed-stats`, { signal: controller.signal })
      .then(r => {
        if (r.status === 404) { const e = new Error('not_found'); e.status = 404; throw e; }
        if (!r.ok) throw new Error('error');
        return r.json();
      })
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(err => { if (err.name !== 'AbortError') { setError(err.message); setLoading(false); } });
    return () => controller.abort();
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

  useEffect(() => {
    if (activeType !== 'gamelog' || !gameLogSeason) return;
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
  }, [activeType, gameLogSeason, playerId]);

  useEffect(() => () => { gameLogAbortRef.current?.abort(); }, []);

  useEffect(() => {
    setShowPercentiles(false);
    setPercData(null);
    setPercLoading(false);
    percFetchedRef.current = false;
    percAbortRef.current?.abort();
  }, [playerId]);

  useEffect(() => {
    if (!showPercentiles || percFetchedRef.current) return;
    percFetchedRef.current = true;

    percAbortRef.current?.abort();
    const controller = new AbortController();
    percAbortRef.current = controller;
    setPercLoading(true);

    fetch(`/api/players/${playerId}/percentiles`, { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(d => { setPercData(d); setPercLoading(false); })
      .catch(err => { if (err.name !== 'AbortError') setPercLoading(false); });

    return () => controller.abort();
  }, [showPercentiles, playerId]);

  useEffect(() => () => { percAbortRef.current?.abort(); }, []);

  function handleTypeClick(key) {
    setActiveType(key);
    if (key === 'gamelog' && !gameLogSeason && availableSeasons.length > 0) {
      setGameLogSeason(availableSeasons[0]);
    }
  }

  function handleSeasonChange(season) {
    setGameLogSeason(season);
    setGlPage(1);
    setGameLogError(false);
  }

  function handlePageSizeChange(size) {
    setGlPageSize(size);
    setGlPage(1);
  }

  if (loading) return <p className="status-msg" style={{ padding: '2rem 0' }}>Loading career stats…</p>;
  if (error === 'not_found') return <p className="status-msg">No career stats found for this player.</p>;
  if (error) return <p className="status-msg error">Could not load career stats.</p>;
  if (!data) return null;

  const activeKeys = SOURCE_ACTIVE[data.source] ?? new Set(['perGame']);
  const enabledTypes = ALL_TABLE_TYPES.filter(t => activeKeys.has(t.key));
  const disabledTypes = ALL_TABLE_TYPES.filter(t => !activeKeys.has(t.key));
  const safeType = activeKeys.has(activeType) ? activeType : 'perGame';

  const isGamelog  = safeType === 'gamelog';
  const isAdvanced = safeType === 'advanced';
  const tableData  = (isGamelog || isAdvanced) ? null : data[safeType];
  const hasPlayoffs = (isGamelog || isAdvanced) ? false : !!tableData?.playoffs?.rows?.length;
  const curSeason = (!hasPlayoffs && activeSeason === 'playoffs') ? 'regular' : activeSeason;
  const regular = (isGamelog || isAdvanced) ? null : (curSeason === 'regular' ? tableData?.regular : tableData?.playoffs);
  const career  = (isGamelog || isAdvanced) ? null : (curSeason === 'regular' ? tableData?.regularCareer : tableData?.playoffCareer);

  const currentLog = gameLogCache[gameLogSeason] ?? null;
  const allGames = currentLog?.games ?? [];
  const totalPages = Math.max(1, Math.ceil(allGames.length / glPageSize));
  const safePage = Math.min(glPage, totalPages);
  const pagedGames = allGames.slice((safePage - 1) * glPageSize, safePage * glPageSize);

  function openStudy() {
    if (!regular) return;
    const { headers, rows } = regular;
    const careerRows = career?.rows ?? [];
    const studyData = [...rows, ...careerRows].map(row =>
      Object.fromEntries(headers.map((h, i) => [h, row[i]]))
    );
    const studyCols = deriveColumns(studyData);
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
          <>
            {pbpAllLoading && <p className="status-msg" style={{ padding: '1rem 0' }}>Loading advanced stats… (fetching play-by-play for all seasons)</p>}
            {pbpAllError && <p className="status-msg error">Could not load advanced stats.</p>}
            {!pbpAllLoading && !pbpAllError && pbpAllData && (() => {
              const advHasPlayoffs = !!pbpAllData.playoffs;
              const advSplit = (advSeason === 'playoffs' && advHasPlayoffs)
                ? pbpAllData.playoffs
                : pbpAllData.regular;
              return (
                <>
                  <div className="stat-table-header">
                    <div className="stat-season-bar">
                      <button type="button" className={`stat-season-tab${advSeason === 'regular' ? ' active' : ''}`} onClick={() => setAdvSeason('regular')}>Regular Season</button>
                      {advHasPlayoffs && (
                        <button type="button" className={`stat-season-tab${advSeason === 'playoffs' ? ' active' : ''}`} onClick={() => setAdvSeason('playoffs')}>Playoffs</button>
                      )}
                    </div>
                  </div>
                  <BrefTable
                    regular={{ headers: pbpAllData.headers, rows: advSplit?.rows ?? [] }}
                    career={advSplit?.careerRow ? { headers: pbpAllData.headers, rows: [advSplit.careerRow] } : null}
                  />
                </>
              );
            })()}
          </>
        ) : isGamelog ? (
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
            {gameLogError && <p className="status-msg error">Could not load game log.</p>}
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
              <label className="perc-toggle">
                <input
                  type="checkbox"
                  checked={showPercentiles}
                  onChange={() => setShowPercentiles(v => !v)}
                />
                <span className="perc-toggle-track"><span className="perc-toggle-thumb" /></span>
                <span className="perc-toggle-label">{percLoading ? 'Loading…' : 'Percentiles'}</span>
              </label>
              {regular && (
                <button type="button" className="study-trigger-btn" onClick={openStudy}>
                  Study this table
                </button>
              )}
            </div>
            <BrefTable
              regular={regular}
              career={career}
              percentiles={showPercentiles && !percLoading ? percData : null}
              viewMode={safeType}
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
