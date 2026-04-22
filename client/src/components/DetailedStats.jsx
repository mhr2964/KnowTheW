import { useState, useEffect, useRef } from 'react';
import StudyFlow from './StudyFlow';
import { HIDDEN, LABELS, PCT_COLS, deriveColumns } from '../lib/statsColumns';

const LEFT_COLS = new Set(['SEASON_ID', 'TEAM_ABBREVIATION']);

function fmt(key, val) {
  if (val === null || val === undefined || val === '') return '—';
  if (PCT_COLS.has(key)) {
    if (typeof val !== 'number') return '—';
    return val.toFixed(3).replace(/^0\./, '.');
  }
  if (typeof val === 'number' && !Number.isInteger(val)) return val.toFixed(1);
  return String(val);
}

function BrefTable({ regular, career }) {
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
          {rows.map((row, ri) => (
            <tr key={ri}>
              {cols.map(c => (
                <td key={c.key} className={LEFT_COLS.has(c.key) ? 'td-l' : ''}>
                  {fmt(c.key, row[c.idx])}
                </td>
              ))}
            </tr>
          ))}
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

function GameLogTable({ log }) {
  if (!log?.games?.length) return <p className="stats-na">No games logged yet.</p>;
  const { names, games } = log;
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

const ADV_HEADERS = ['SEASON_ID', 'TEAM_ABBREVIATION', 'GP', 'TS_PCT', 'EFG_PCT', 'TPAr', 'FTr'];

function computeAdvanced(pgSource) {
  if (!pgSource?.regular?.headers) return null;
  const { headers } = pgSource.regular;
  const I = Object.fromEntries(headers.map((h, i) => [h, i]));

  function advRow(row) {
    const fga  = row[I.FGA]  ?? 0;
    const fgm  = row[I.FGM]  ?? 0;
    const fg3m = row[I.FG3M] ?? 0;
    const fg3a = row[I.FG3A] ?? 0;
    const fta  = row[I.FTA]  ?? 0;
    const pts  = row[I.PTS]  ?? 0;
    const ts   = (fga + 0.44 * fta) > 0 ? pts / (2 * (fga + 0.44 * fta)) : null;
    const efg  = fga > 0 ? (fgm + 0.5 * fg3m) / fga : null;
    const tpar = fga > 0 ? fg3a / fga : null;
    const ftr  = fga > 0 ? fta / fga : null;
    return [row[I.SEASON_ID], row[I.TEAM_ABBREVIATION], row[I.GP], ts, efg, tpar, ftr];
  }

  function toSplit(src) {
    if (!src?.rows) return null;
    return { headers: ADV_HEADERS, rows: src.rows.map(advRow) };
  }

  function toCareer(src) {
    if (!src?.rows?.[0]) return null;
    return { headers: ADV_HEADERS, rows: [advRow(src.rows[0])] };
  }

  return {
    regular:       toSplit(pgSource.regular),
    regularCareer: toCareer(pgSource.regularCareer),
    playoffs:      toSplit(pgSource.playoffs),
    playoffCareer: toCareer(pgSource.playoffCareer),
  };
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

export default function DetailedStats({ playerId, playerName, onSaveDeck }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeType, setActiveType] = useState('perGame');
  const [activeSeason, setActiveSeason] = useState('regular');
  const [studyConfig, setStudyConfig] = useState(null);

  const [gameLog, setGameLog] = useState(null);
  const [gameLogLoading, setGameLogLoading] = useState(false);
  const [gameLogError, setGameLogError] = useState(false);
  const gameLogAbortRef = useRef(null);

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
        d.advanced = computeAdvanced(d.perGame);
        setData(d);
        setLoading(false);
      })
      .catch(err => { if (err.name !== 'AbortError') { setError(err.message); setLoading(false); } });
    return () => controller.abort();
  }, [playerId]);

  useEffect(() => () => { gameLogAbortRef.current?.abort(); }, []);

  function handleTypeClick(key) {
    setActiveType(key);
    if (key === 'gamelog' && !gameLog && !gameLogLoading) {
      if (gameLogAbortRef.current) gameLogAbortRef.current.abort();
      const controller = new AbortController();
      gameLogAbortRef.current = controller;
      setGameLogLoading(true);
      setGameLogError(false);
      fetch(`/api/players/${playerId}/gamelog`, { signal: controller.signal })
        .then(r => { if (!r.ok) throw new Error(); return r.json(); })
        .then(d => { setGameLog(d); setGameLogLoading(false); })
        .catch(err => { if (err.name !== 'AbortError') { setGameLogError(true); setGameLogLoading(false); } });
    }
  }

  if (loading) return <p className="status-msg" style={{ padding: '2rem 0' }}>Loading career stats…</p>;
  if (error === 'not_found') return <p className="status-msg">No career stats found for this player.</p>;
  if (error) return <p className="status-msg error">Could not load career stats.</p>;
  if (!data) return null;

  const activeKeys = SOURCE_ACTIVE[data.source] ?? new Set(['perGame']);
  const enabledTypes = ALL_TABLE_TYPES.filter(t => activeKeys.has(t.key));
  const disabledTypes = ALL_TABLE_TYPES.filter(t => !activeKeys.has(t.key));
  const safeType = activeKeys.has(activeType) ? activeType : 'perGame';

  const isGamelog = safeType === 'gamelog';
  const tableData = isGamelog ? null : data[safeType];
  const hasPlayoffs = isGamelog ? false : !!tableData?.playoffs?.rows?.length;
  const curSeason = (!hasPlayoffs && activeSeason === 'playoffs') ? 'regular' : activeSeason;
  const regular = isGamelog ? null : (curSeason === 'regular' ? tableData?.regular : tableData?.playoffs);
  const career  = isGamelog ? null : (curSeason === 'regular' ? tableData?.regularCareer : tableData?.playoffCareer);

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

        {isGamelog ? (
          <>
            {gameLogLoading && <p className="status-msg" style={{ padding: '1rem 0' }}>Loading game log…</p>}
            {gameLogError && <p className="status-msg error">Could not load game log.</p>}
            {!gameLogLoading && !gameLogError && <GameLogTable log={gameLog} />}
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
              {regular && (
                <button type="button" className="study-trigger-btn" onClick={openStudy}>
                  Study this table
                </button>
              )}
            </div>
            <BrefTable regular={regular} career={career} />
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
