import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useLazyFetch from '../hooks/useLazyFetch';
import FingerprintRadar from './FingerprintRadar';

// Cross-Era Similarity surface on the player page: a ranked list of the most alike players by
// era-normalized fingerprint. Clicking a row pins an inline card (one open at a time) with the
// shared-trait summary and a radar that overlays this player's shape under the comparable's, so
// "how alike" reads as two superimposed shapes. The "View →" link navigates — kept explicit inside
// the card so a row click only ever expands, never the old hover/click conflict that closed cards.
//
// No section renders for a too-thin player (server returns similar: []), mirroring the badge.

export default function SimilarPlayersSection({ playerId, playerName }) {
  const navigate = useNavigate();
  const [pinnedId, setPinnedId] = useState(null);
  const wrapRef = useRef(null);
  const { data, loading, error, refetch } = useLazyFetch(`/api/players/${playerId}/similar`, true);

  // Collapse any open card when navigating to a different player.
  useEffect(() => { setPinnedId(null); }, [playerId]);

  // Escape / outside-click collapse the open card.
  useEffect(() => {
    if (pinnedId == null) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setPinnedId(null); };
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setPinnedId(null); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [pinnedId]);

  if (loading) {
    return (
      <section className="similar-players-section">
        <h2 className="section-title">Similar Players</h2>
        <p className="similar-status">Finding comparable players…</p>
      </section>
    );
  }
  if (error) {
    return (
      <section className="similar-players-section">
        <h2 className="section-title">Similar Players</h2>
        <button type="button" className="similar-retry" onClick={refetch}>
          Couldn’t load similar players — retry
        </button>
      </section>
    );
  }
  if (!data || !Array.isArray(data.similar) || !data.similar.length) return null;

  const targetDims = data.target?.dimensions ?? null;

  return (
    <section className="similar-players-section" ref={wrapRef}>
      <h2 className="section-title">Similar Players</h2>
      <p className="similar-subtitle">
        Closest career profiles, era-normalized. Position-aware, so comparisons stay within reach.
      </p>
      <ul className="similar-list">
        {data.similar.map(p => {
          const open = pinnedId === p.id;
          const traits = Array.isArray(p.sharedTraits) ? p.sharedTraits : [];
          const conf = p.confidence; // 'strong' | 'moderate' | 'loose'
          const confLabel = conf ? conf.charAt(0).toUpperCase() + conf.slice(1) : '';
          return (
            <li key={p.id} className="similar-row">
              <button
                type="button"
                className={`search-player-row-btn similar-row-btn${open ? ' is-open' : ''}${conf === 'loose' ? ' is-loose' : ''}`}
                aria-expanded={open}
                onClick={() => setPinnedId(open ? null : p.id)}
              >
                <span className="similar-row-name">{p.name ?? 'Unknown'}</span>
                <span className="similar-row-stat">
                  {p.pos ? `${p.pos} · ` : ''}{p.similarity}%
                  {confLabel && <span className={`similar-conf-tag conf-${conf}`}>{confLabel}</span>}
                </span>
              </button>

              {open && (
                <div className="similar-card" role="region" aria-label={`How ${p.name} compares`}>
                  {traits.length > 0 && (
                    <p className="similar-traits">
                      Most alike on: {traits.map(t => t.label.toLowerCase()).join(', ')}
                    </p>
                  )}

                  {targetDims && Array.isArray(p.dimensions) && (
                    <FingerprintRadar dimensions={p.dimensions} overlay={targetDims} />
                  )}

                  <div className="similar-legend">
                    <span className="similar-legend-item is-target">{playerName}</span>
                    <span className="similar-legend-item is-comp">{p.name}</span>
                  </div>

                  <button
                    type="button"
                    className="similar-view-link"
                    onClick={() => navigate(`/player/${p.id}`)}
                  >
                    View {p.name} →
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
