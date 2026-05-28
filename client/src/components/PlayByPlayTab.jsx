import { useState, useEffect } from 'react';
import useLazyFetch from '../hooks/useLazyFetch';

function fmt1(v) {
  if (v == null) return '—';
  return (v > 0 ? '+' : '') + v.toFixed(1);
}
function fmtPct(v) {
  if (v == null) return '—';
  return (v * 100).toFixed(1) + '%';
}
function fmtPg(v) {
  if (v == null) return '—';
  return v.toFixed(1);
}

function ShootingGrid({ s }) {
  const cells = [
    { label: 'FG%',   value: fmtPct(s.fgPct),    good: s.fgPct   != null && s.fgPct   > 0.46, bad: s.fgPct   != null && s.fgPct   < 0.38 },
    { label: '3P%',   value: fmtPct(s.fg3Pct),   good: s.fg3Pct  != null && s.fg3Pct  > 0.36, bad: s.fg3Pct  != null && s.fg3Pct  < 0.30 },
    { label: 'FT%',   value: fmtPct(s.ftPct),    good: s.ftPct   != null && s.ftPct   > 0.80, bad: s.ftPct   != null && s.ftPct   < 0.70 },
    { label: 'eFG%',  value: fmtPct(s.efgPct),   good: s.efgPct  != null && s.efgPct  > 0.51, bad: s.efgPct  != null && s.efgPct  < 0.44 },
    { label: 'TS%',   value: fmtPct(s.tsPct),    good: s.tsPct   != null && s.tsPct   > 0.55, bad: s.tsPct   != null && s.tsPct   < 0.48 },
    { label: '3PA%',  value: fmtPct(s.fg3aRate),  good: false,                                  bad: false },
    { label: 'FTr',   value: s.ftr  != null ? s.ftr.toFixed(3) : '—', good: false,              bad: false },
    { label: 'PTS/G', value: fmtPg(s.ptsPg),     good: false,                                  bad: false },
  ];

  return (
    <div className="pbp-stat-grid">
      {cells.map(({ label, value, good, bad }) => (
        <div key={label} className="pbp-stat-cell">
          <span className={`pbp-stat-value${good ? ' pbp-stat-value--good' : bad ? ' pbp-stat-value--bad' : ''}`}>
            {value}
          </span>
          <span className="pbp-stat-label">{label}</span>
        </div>
      ))}
    </div>
  );
}

function OnOffPanel({ label, data }) {
  const netClass = data.net == null ? '' : data.net > 0 ? ' onoff-panel--positive' : data.net < 0 ? ' onoff-panel--negative' : '';
  return (
    <div className={`onoff-panel${netClass}`}>
      <div className="onoff-panel-label">{label}</div>
      <div className="onoff-panel-net">{fmt1(data.net)}</div>
      <div className="onoff-panel-sub">
        <span>ORTG {data.ortg?.toFixed(1) ?? '—'}</span>
        <span>DRTG {data.drtg?.toFixed(1) ?? '—'}</span>
      </div>
    </div>
  );
}

export default function PlayByPlayTab({ playerId, availableSeasons }) {
  const [season, setSeason] = useState(null);

  useEffect(() => {
    if (!season && availableSeasons.length > 0) {
      setSeason(availableSeasons[0]);
    }
  }, [season, availableSeasons]);

  const { data, loading, error, refetch } = useLazyFetch(
    `/api/players/${playerId}/pbp-stats?season=${season}`,
    !!season
  );

  if (!availableSeasons.length) {
    return <p className="stats-na">No season data available.</p>;
  }

  return (
    <div className="pbp-tab">
      {availableSeasons.length > 1 && (
        <div className="gl-controls">
          <select
            className="gl-select"
            value={season ?? ''}
            onChange={e => setSeason(e.target.value)}
          >
            {availableSeasons.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      )}

      {loading && <p className="status-msg" style={{ padding: '1rem 0' }}>Loading play-by-play stats…</p>}

      {error && (
        <p className="status-msg error" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          Could not load play-by-play stats.
          <button type="button" className="btn-ghost compare-verdict-retry" onClick={refetch}>Try again</button>
        </p>
      )}

      {!loading && !error && data && (
        data.result == null ? (
          <p className="stats-na">
            Not enough play-by-play data for {data.season} (need 5+ games).
          </p>
        ) : (
          <>
            {data.result.shooting && (
              <section className="pbp-section">
                <h3 className="pbp-section-header">Shooting Splits · {data.result.shooting.games} games</h3>
                <ShootingGrid s={data.result.shooting} />
              </section>
            )}
            {data.result.onoff && (
              <section className="pbp-section">
                <h3 className="pbp-section-header">On/Off Net Rating</h3>
                <div className="onoff-panels">
                  <OnOffPanel label="On Court"  data={data.result.onoff.on}  />
                  <OnOffPanel label="Off Court" data={data.result.onoff.off} />
                </div>
                <p className="onoff-meta">
                  Net impact:{' '}
                  <strong className={data.result.onoff.delta == null ? '' : data.result.onoff.delta >= 0 ? 'onoff-pos' : 'onoff-neg'}>
                    {fmt1(data.result.onoff.delta)}
                  </strong>
                  {' '}across {data.result.onoff.games} games · Net Rating per 100 possessions
                </p>
              </section>
            )}
          </>
        )
      )}
    </div>
  );
}
