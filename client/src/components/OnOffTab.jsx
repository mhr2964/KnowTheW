import { useState, useEffect } from 'react';
import useLazyFetch from '../hooks/useLazyFetch';

function fmt1(v) {
  if (v == null) return '—';
  const s = (v > 0 ? '+' : '') + v.toFixed(1);
  return s;
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

export default function OnOffTab({ playerId, availableSeasons }) {
  const [season, setSeason] = useState(null);

  useEffect(() => {
    if (!season && availableSeasons.length > 0) {
      setSeason(availableSeasons[0]);
    }
  }, [season, availableSeasons]);

  const { data, loading, error, refetch } = useLazyFetch(
    `/api/players/${playerId}/onoff?season=${season}`,
    !!season
  );

  if (!availableSeasons.length) {
    return <p className="stats-na">No season data available.</p>;
  }

  return (
    <div className="onoff-tab">
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

      {loading && <p className="status-msg" style={{ padding: '1rem 0' }}>Loading on/off stats…</p>}

      {error && (
        <p className="status-msg error" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          Could not load on/off stats.
          <button type="button" className="btn-ghost compare-verdict-retry" onClick={refetch}>Try again</button>
        </p>
      )}

      {!loading && !error && data && (
        data.result == null ? (
          <p className="stats-na onoff-empty">
            Not enough play-by-play data for {data.season} (need 5+ games).
          </p>
        ) : (
          <div className="onoff-content">
            <div className="onoff-panels">
              <OnOffPanel label="On Court"  data={data.result.on}  />
              <OnOffPanel label="Off Court" data={data.result.off} />
            </div>
            <p className="onoff-meta">
              Net impact:{' '}
              <strong className={data.result.delta == null ? '' : data.result.delta >= 0 ? 'onoff-pos' : 'onoff-neg'}>
                {fmt1(data.result.delta)}
              </strong>
              {' '}across {data.result.games} games · Net Rating per 100 possessions
            </p>
          </div>
        )
      )}
    </div>
  );
}
