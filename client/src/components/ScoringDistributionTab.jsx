import { useState, useEffect } from 'react';
import TableToolbar from './TableToolbar';
import useSeasonScopedFetch from '../hooks/useSeasonScopedFetch';

// A 404 means "no scoring-distribution data this player-season, either side" -- a legitimate empty
// result (the underlying tracking-data floor is 2022, narrower than career-stats coverage), not an
// error -- same posture as ClutchTab's parseClutch / ShotChart's parseShotChart.
async function parseScoringDistribution(r) {
  if (r.status === 404) return null;
  if (!r.ok) throw new Error();
  return r.json();
}

function pct(v) { return v == null ? '—' : `${Math.round(v * 100)}%`; }

// Percentage groups, not BrefTable numeric columns -- see server/providers/balldontlie/
// scoringDistribution.js's header comment for why these are shaped as three separate groups rather
// than one flat table (pointsBreakdown sums to 100%, whereItHappens is overlapping subsets, and
// assistedVsUnassisted is three independent 100%-summing pairs).
function StackedBar({ segments }) {
  return (
    <div className="scoring-dist-stack">
      {segments.filter(s => s.value != null && s.value > 0).map(s => (
        <div
          key={s.key}
          className="scoring-dist-stack-seg"
          style={{ width: `${(s.value * 100).toFixed(2)}%`, background: s.color }}
          title={`${s.label}: ${pct(s.value)}`}
        />
      ))}
    </div>
  );
}

function StackedLegend({ segments }) {
  return (
    <div className="scoring-dist-legend">
      {segments.map(s => (
        <span key={s.key} className="scoring-dist-legend-item">
          <span className="scoring-dist-swatch" style={{ background: s.color }} />
          {s.label} <strong>{pct(s.value)}</strong>
        </span>
      ))}
    </div>
  );
}

function BarRow({ label, value }) {
  return (
    <div className="scoring-dist-row">
      <span className="scoring-dist-row-label">{label}</span>
      <div className="scoring-dist-row-track">
        <div className="scoring-dist-row-fill" style={{ width: `${value == null ? 0 : value * 100}%` }} />
      </div>
      <span className="scoring-dist-row-value">{pct(value)}</span>
    </div>
  );
}

function ScoringDistributionSide({ dist }) {
  const points = [
    { key: 'twoPt', label: '2PT', color: 'var(--accent)', value: dist.pointsBreakdown.twoPt },
    { key: 'threePt', label: '3PT', color: 'var(--compare-b)', value: dist.pointsBreakdown.threePt },
    { key: 'ft', label: 'FT', color: '#e0b03c', value: dist.pointsBreakdown.ft },
  ];
  const where = [
    { key: 'paint', label: 'Paint', value: dist.whereItHappens.paint },
    { key: 'midRange', label: 'Mid-Range', value: dist.whereItHappens.midRange },
    { key: 'fastbreak', label: 'Fastbreak', value: dist.whereItHappens.fastbreak },
    { key: 'offTurnovers', label: 'Off Turnovers', value: dist.whereItHappens.offTurnovers },
  ];
  const assistGroups = [
    { key: 'overall', label: 'Overall FGM' },
    { key: 'twoPm', label: '2PM' },
    { key: 'threePm', label: '3PM' },
  ];

  return (
    <div className="scoring-dist">
      <section className="scoring-dist-section">
        <h4 className="scoring-dist-heading">Points Breakdown</h4>
        <StackedBar segments={points} />
        <StackedLegend segments={points} />
      </section>

      <section className="scoring-dist-section">
        <h4 className="scoring-dist-heading">Where It Happens</h4>
        {where.map(w => <BarRow key={w.key} label={w.label} value={w.value} />)}
      </section>

      <section className="scoring-dist-section">
        <h4 className="scoring-dist-heading">Assisted vs. Unassisted</h4>
        {assistGroups.map(g => {
          const pair = dist.assistedVsUnassisted[g.key];
          const segs = [
            { key: `${g.key}-a`, label: 'Assisted', color: 'var(--accent)', value: pair.assisted },
            { key: `${g.key}-u`, label: 'Unassisted', color: 'var(--text-muted)', value: pair.unassisted },
          ];
          return (
            <div key={g.key} className="scoring-dist-assist-group">
              <span className="scoring-dist-assist-label">{g.label}</span>
              <StackedBar segments={segs} />
              <StackedLegend segments={segs} />
            </div>
          );
        })}
      </section>
    </div>
  );
}

function flattenForExport(dist) {
  const rows = [
    ['Points', '2PT', dist.pointsBreakdown.twoPt],
    ['Points', '3PT', dist.pointsBreakdown.threePt],
    ['Points', 'FT', dist.pointsBreakdown.ft],
    ['Where It Happens', 'Paint', dist.whereItHappens.paint],
    ['Where It Happens', 'Mid-Range', dist.whereItHappens.midRange],
    ['Where It Happens', 'Fastbreak', dist.whereItHappens.fastbreak],
    ['Where It Happens', 'Off Turnovers', dist.whereItHappens.offTurnovers],
    ['Assisted/Unassisted', 'Overall FGM Assisted', dist.assistedVsUnassisted.overall.assisted],
    ['Assisted/Unassisted', 'Overall FGM Unassisted', dist.assistedVsUnassisted.overall.unassisted],
    ['Assisted/Unassisted', '2PM Assisted', dist.assistedVsUnassisted.twoPm.assisted],
    ['Assisted/Unassisted', '2PM Unassisted', dist.assistedVsUnassisted.twoPm.unassisted],
    ['Assisted/Unassisted', '3PM Assisted', dist.assistedVsUnassisted.threePm.assisted],
    ['Assisted/Unassisted', '3PM Unassisted', dist.assistedVsUnassisted.threePm.unassisted],
  ];
  return rows.map(([group, label, value]) => ({ group, label, value }));
}

function toCsvCell(val) {
  const s = val === null || val === undefined ? '' : String(val);
  return /["\n,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadDistCsv(filename, dist) {
  const lines = [['Category', 'Stat', '%'].map(toCsvCell).join(',')];
  for (const row of flattenForExport(dist)) {
    lines.push([row.group, row.label, row.value != null ? (row.value * 100).toFixed(1) : ''].map(toCsvCell).join(','));
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ScoringDistributionTab({ playerId, playerName, availableSeasons, onOpenStudy, seasonBarRef, onSeasonChange }) {
  const [season, setSeason] = useState(null);
  const [seasonType, setSeasonType] = useState('regular');

  useEffect(() => {
    if (!season && availableSeasons.length > 0) setSeason(availableSeasons[0]);
  }, [season, availableSeasons]);

  function handleSeasonChange(s) {
    setSeason(s);
    setSeasonType('regular');
  }

  // Both season sides come back in one response (server/routes/players.js) -- toggling below is a
  // local swap, not a refetch, same as ClutchTab.
  const distUrl = season ? `/api/players/${playerId}/scoring-distribution?season=${season}` : null;
  const { data: current, loading, error, retry } = useSeasonScopedFetch(distUrl, { parse: parseScoringDistribution });

  useEffect(() => {
    onSeasonChange?.(current?.hasPlayoffs ? seasonType : null);
  }, [current, seasonType, onSeasonChange]);

  const dist = seasonType === 'playoffs' ? current?.playoffs : current?.regular;

  // Groups are objects, not BrefTable's positional-array rows -- flattened into StudyFlow's own
  // {data, columns} shape directly, same reasoning as ShotChart.jsx's openStudy.
  function openStudy() {
    if (!dist) return;
    const columns = [
      { key: 'group', label: 'Category', type: 'text' },
      { key: 'label', label: 'Stat', type: 'text' },
      { key: 'value', label: '%', type: 'pct' },
    ];
    const data = flattenForExport(dist);
    const suffix = seasonType === 'playoffs' ? ' (Playoffs)' : '';
    onOpenStudy?.({ data, columns, deckName: `${playerName} Scoring Distribution ${season}${suffix}` });
  }

  return (
    <>
      <TableToolbar
        leading={
          <>
            {current?.hasPlayoffs && (
              <div className="stat-season-bar" ref={seasonBarRef}>
                <button
                  type="button"
                  className={`stat-season-tab${seasonType === 'regular' ? ' active' : ''}`}
                  onClick={() => setSeasonType('regular')}
                >
                  Regular Season
                </button>
                <button
                  type="button"
                  className={`stat-season-tab${seasonType === 'playoffs' ? ' active' : ''}`}
                  onClick={() => setSeasonType('playoffs')}
                >
                  Playoffs
                </button>
              </div>
            )}
            {availableSeasons.length > 1 && (
              <select className="gl-select" value={season ?? ''} onChange={e => handleSeasonChange(e.target.value)}>
                {availableSeasons.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
          </>
        }
        showStudy={!!dist}
        onStudy={openStudy}
        showExport={!!dist}
        onExport={() => downloadDistCsv(`${playerName}-scoring-distribution-${season}${seasonType === 'playoffs' ? '-playoffs' : ''}.csv`, dist)}
      />
      {loading && <p className="status-msg" style={{ padding: '1rem 0' }}>Loading scoring distribution…</p>}
      {error && (
        <p className="status-msg error" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          Could not load scoring distribution.
          <button type="button" className="btn-ghost compare-verdict-retry" onClick={retry}>Try again</button>
        </p>
      )}
      {!loading && !error && (
        dist
          ? <ScoringDistributionSide dist={dist} />
          : <p className="status-msg">No scoring distribution data for this season.</p>
      )}
    </>
  );
}
