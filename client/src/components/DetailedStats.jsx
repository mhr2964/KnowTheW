import { useState, useEffect } from 'react';
import StudyFlow from './StudyFlow';

const HIDDEN = new Set(['PLAYER_ID', 'LEAGUE_ID', 'TEAM_ID']);
const LABELS = {
  SEASON_ID: 'Season', TEAM_ABBREVIATION: 'Team', PLAYER_AGE: 'Age',
  GP: 'G', GS: 'GS', MIN: 'MP',
  FGM: 'FG', FGA: 'FGA', FG_PCT: 'FG%',
  FG3M: '3P', FG3A: '3PA', FG3_PCT: '3P%',
  FTM: 'FT', FTA: 'FTA', FT_PCT: 'FT%',
  OREB: 'ORB', DREB: 'DRB', REB: 'TRB',
  AST: 'AST', STL: 'STL', BLK: 'BLK', TOV: 'TOV', PF: 'PF', PTS: 'PTS',
};
const LEFT_COLS = new Set(['SEASON_ID', 'TEAM_ABBREVIATION']);
const PCT_COLS = new Set(['FG_PCT', 'FG3_PCT', 'FT_PCT']);

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
          <tr>
            {cols.map(c => <th key={c.key}>{c.label}</th>)}
          </tr>
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

const TABLE_TYPES = [
  { key: 'perGame', label: 'Per Game' },
  { key: 'totals', label: 'Totals' },
  { key: 'per36', label: 'Per 36' },
  { key: 'per100', label: 'Per 100 Poss' },
];

const COMING_SOON = ['Advanced', 'Shooting', 'Adj. Shooting', 'Play-by-Play'];

export default function DetailedStats({ playerId, playerName, onSaveDeck }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeType, setActiveType] = useState('perGame');
  const [activeSeason, setActiveSeason] = useState('regular');
  const [studyConfig, setStudyConfig] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/players/${playerId}/detailed-stats`)
      .then(r => {
        if (r.status === 404) { const e = new Error('not_found'); e.status = 404; throw e; }
        if (!r.ok) throw new Error('error');
        return r.json();
      })
      .then(d => { setData(d); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, [playerId]);

  if (loading) return <p className="status-msg" style={{ padding: '2rem 0' }}>Loading career stats…</p>;
  if (error === 'not_found') return <p className="status-msg">No career stats found in WNBA Stats database for this player.</p>;
  if (error) return <p className="status-msg error">Could not load career stats.</p>;
  if (!data) return null;

  const tableData = data[activeType];
  const hasPlayoffs = !!tableData?.playoffs?.rows?.length;
  const curSeason = (!hasPlayoffs && activeSeason === 'playoffs') ? 'regular' : activeSeason;

  const regular = curSeason === 'regular' ? tableData?.regular : tableData?.playoffs;
  const career = curSeason === 'regular' ? tableData?.regularCareer : tableData?.playoffCareer;

  function openStudy() {
    if (!regular) return;
    const { headers, rows } = regular;
    const careerRows = career?.rows ?? [];
    const studyData = [...rows, ...careerRows].map(row =>
      Object.fromEntries(headers.map((h, i) => [h, row[i]]))
    );
    const studyCols = headers
      .filter(h => !HIDDEN.has(h))
      .map(h => ({ key: h, label: LABELS[h] ?? h, type: 'text' }));
    const typeLabel = TABLE_TYPES.find(t => t.key === activeType)?.label ?? activeType;
    const suffix = curSeason === 'playoffs' ? ' (Playoffs)' : '';
    setStudyConfig({ data: studyData, columns: studyCols, deckName: `${playerName} ${typeLabel}${suffix}` });
  }

  return (
    <>
      <div className="detailed-stats">
        <div className="stat-type-tabs">
          {TABLE_TYPES.map(t => (
            <button
              key={t.key}
              type="button"
              className={`stat-type-tab${activeType === t.key ? ' active' : ''}`}
              onClick={() => setActiveType(t.key)}
            >
              {t.label}
            </button>
          ))}
          {COMING_SOON.map(label => (
            <button key={label} type="button" className="stat-type-tab soon" disabled>
              {label}
            </button>
          ))}
        </div>

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
