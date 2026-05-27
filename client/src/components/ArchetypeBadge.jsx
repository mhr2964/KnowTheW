import { useState, useRef, useEffect } from 'react';
import useLazyFetch from '../hooks/useLazyFetch';
import FingerprintRadar from './FingerprintRadar';

// Archetype badge for the player hero. The pill names the archetype; the card (radar + descriptor +
// expandable 13-bar detail) opens on hover/focus and can be PINNED open by click/tap.
//
// Open model uses two independent signals so they can't fight each other (the old single-`open`
// state had hover, focus, and click all writing it — a click after hovering closed the just-opened
// card): `hovered` (mouse/focus) OR `pinned` (click/tap) shows the card. Escape and outside-click
// clear both. No badge renders for a too-thin sample (server returns archetype:null).

const CONF_LABEL = { high: 'High confidence', medium: 'Medium confidence', low: 'Small sample' };

export default function ArchetypeBadge({ playerId }) {
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const wrapRef = useRef(null);
  // Eager fetch on mount; useLazyFetch guards res.ok and aborts on unmount/id change.
  const { data } = useLazyFetch(`/api/players/${playerId}/archetype`, true);

  const show = hovered || pinned;

  // Escape and outside-click dismiss the card entirely (covers the pinned/keyboard cases that
  // mouseleave doesn't).
  useEffect(() => {
    if (!show) return undefined;
    const dismiss = () => { setPinned(false); setHovered(false); };
    const onKey = (e) => { if (e.key === 'Escape') dismiss(); };
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) dismiss(); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [show]);

  if (!data || !data.archetype) return null;

  const { archetype, confidence, modifiers = [], runnerUp, axes = [], dimensions, descriptor } = data;
  const modKeys = new Set(modifiers.map(m => m.key));
  const confLabel = CONF_LABEL[confidence] ?? '';

  return (
    <div
      className="archetype-badge"
      ref={wrapRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        className="archetype-pill"
        aria-expanded={show}
        aria-label={`Archetype: ${archetype.name}. ${confLabel}. Show fingerprint.`}
        onClick={() => setPinned(p => !p)}
        onFocus={() => setHovered(true)}
      >
        <span className={`archetype-conf-dot conf-${confidence}`} aria-hidden="true" />
        {archetype.name}
      </button>

      {show && (
        <div className="archetype-card" role="dialog" aria-label={`${archetype.name} fingerprint`}>
          <div className="archetype-card-head">
            <span className="archetype-card-name">{archetype.name}</span>
            <span className={`archetype-card-conf conf-${confidence}`}>{confLabel}</span>
          </div>

          {descriptor && <p className="archetype-descriptor">{descriptor}</p>}

          {dimensions && <FingerprintRadar dimensions={dimensions} />}

          <button
            type="button"
            className="archetype-detail-toggle"
            aria-expanded={showDetail}
            onClick={() => setShowDetail(s => !s)}
          >
            {showDetail ? '▾ Hide stats' : '▸ All 13 stats'}
          </button>

          {showDetail && (
            <div className="archetype-axes">
              {axes.map(ax => {
                const v = typeof ax.value === 'number' ? ax.value : null;
                const elite = modKeys.has(ax.key);
                return (
                  <div key={ax.key} className={`archetype-axis${elite ? ' is-elite' : ''}`}>
                    <span className="archetype-axis-label">{ax.label}</span>
                    <span className="archetype-axis-track" aria-hidden="true">
                      <span className="archetype-axis-fill" style={{ width: `${v ?? 0}%` }} />
                    </span>
                    <span className="archetype-axis-val">{v ?? '—'}</span>
                  </div>
                );
              })}
            </div>
          )}

          {runnerUp && (
            <div className="archetype-foot">Closest alternative: {runnerUp.name}</div>
          )}
        </div>
      )}
    </div>
  );
}
