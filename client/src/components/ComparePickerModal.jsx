import { useState, useEffect, useRef } from 'react';
import { initialsOf } from '../lib/initials';

export default function ComparePickerModal({ currentPlayerId, onPick, onClose, title = 'Compare with...' }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selfError, setSelfError] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (!q) { setResults(null); return undefined; }

    // The controller is created here (not inside the timeout) so effect cleanup can abort an
    // in-flight fetch even after the debounce has already fired. Previously `controller.abort()`
    // was returned from inside the setTimeout callback, which does nothing — setTimeout ignores
    // callback return values — so a superseded fetch could resolve after a newer one and
    // clobber its results with stale data.
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        .then(r => { if (!r.ok) throw new Error(); return r.json(); })
        .then(d => { setResults(d.players ?? []); setLoading(false); })
        .catch(err => { if (err.name !== 'AbortError') { setResults([]); setLoading(false); } });
    }, 200);

    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  function handlePick(playerId) {
    if (String(playerId) === String(currentPlayerId)) {
      setSelfError(true);
      inputRef.current?.focus();
      return;
    }
    onPick(playerId);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="compare-picker-modal"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="compare-picker-header">
          <h3>{title}</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="compare-picker-body">
          <input
            ref={inputRef}
            className="search-input compare-picker-input"
            type="text"
            placeholder="Search players..."
            value={query}
            onChange={e => { setQuery(e.target.value); setSelfError(false); }}
          />

          {selfError && (
            <p className="compare-picker-self-error">{"That's the same player — pick someone else."}</p>
          )}

          {loading && <p className="status-msg" style={{ padding: '1rem 0' }}>Searching...</p>}

          {!loading && results !== null && results.length === 0 && (
            <p className="status-msg" style={{ padding: '1rem 0' }}>No players found.</p>
          )}

          {!loading && results && results.length > 0 && (
            <div className="search-player-list compare-picker-results">
              {results.map(player => (
                <button
                  key={player.id}
                  type="button"
                  className="search-player-row search-player-row-btn"
                  onClick={() => handlePick(player.id)}
                >
                  {player.headshot
                    ? <img src={player.headshot} alt={player.name} className="player-headshot" />
                    : <div className="player-headshot placeholder">{initialsOf(player.name)}</div>
                  }
                  <div className="player-info">
                    <span className="player-name">{player.name}</span>
                    <span className="player-meta">
                      {player.jersey ? `#${player.jersey}` : ''}
                      {player.jersey && player.position ? ' · ' : ''}
                      {player.position}
                      {player.teamName ? ` · ${player.teamName}` : ''}
                      {player.retired ? ' · Retired' : ''}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="compare-picker-footer">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
