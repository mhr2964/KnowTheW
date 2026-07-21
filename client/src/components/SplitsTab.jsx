import { useState, useEffect, useRef } from 'react';
import BrefTable from './BrefTable';

const SPLIT_TYPES = [
  { key: 'homeaway', label: 'Home/Away' },
  { key: 'month', label: 'Monthly' },
  { key: 'opponent', label: 'By Opponent' },
];

export default function SplitsTab({ playerId, playerName, availableSeasons }) {
  const [season, setSeason] = useState(null);
  const [splitType, setSplitType] = useState('homeaway');
  const [cache, setCache] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const abortRef = useRef(null);
  const fetchedRef = useRef(new Set());
  const exportRef = useRef(null);

  useEffect(() => {
    if (!season && availableSeasons.length > 0) setSeason(availableSeasons[0]);
  }, [season, availableSeasons]);

  const cacheKey = season ? `${season}:${splitType}` : null;

  useEffect(() => {
    if (!cacheKey) return;
    if (fetchedRef.current.has(cacheKey)) return;
    fetchedRef.current.add(cacheKey);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(false);

    fetch(`/api/players/${playerId}/splits?season=${season}&type=${splitType}`, { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(d => {
        setCache(prev => ({ ...prev, [cacheKey]: d }));
        setLoading(false);
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          fetchedRef.current.delete(cacheKey);
          setError(true);
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [cacheKey, playerId, season, splitType, retryCount]);

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  const current = cacheKey ? cache[cacheKey] ?? null : null;
  const splitLabel = SPLIT_TYPES.find(t => t.key === splitType)?.label ?? splitType;

  return (
    <>
      <div className="gl-controls">
        {availableSeasons.length > 1 && (
          <select className="gl-select" value={season ?? ''} onChange={e => setSeason(e.target.value)}>
            {availableSeasons.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
        <select className="gl-select" value={splitType} onChange={e => setSplitType(e.target.value)}>
          {SPLIT_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
        {current && (
          <button type="button" className="btn-ghost bref-export-btn" onClick={() => exportRef.current?.()}>
            Export CSV
          </button>
        )}
      </div>
      {loading && <p className="status-msg" style={{ padding: '1rem 0' }}>Loading splits…</p>}
      {error && (
        <p className="status-msg error" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          Could not load splits.
          <button type="button" className="btn-ghost compare-verdict-retry" onClick={() => setRetryCount(c => c + 1)}>Try again</button>
        </p>
      )}
      {!loading && !error && (
        <BrefTable
          regular={current}
          emptyMessage="No split data available."
          filename={`${playerName}-splits-${splitLabel.toLowerCase().replace(/\W+/g, '-')}-${season}.csv`}
          exportRef={exportRef}
        />
      )}
    </>
  );
}
