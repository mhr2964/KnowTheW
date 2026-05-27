import { useState, useRef, useEffect } from 'react';
import useLazyFetch from '../hooks/useLazyFetch';
import FingerprintRadar from './FingerprintRadar';

// Archetype badge for the player hero. The pill names the archetype; hovering/focusing/tapping it
// opens a card that reads playstyle at a glance: a one-line descriptor + a radar SHAPE over 6 play
// dimensions, with the full 13-axis breakdown one click away. No badge for a too-thin sample
// (server returns archetype:null) — we don't assert an identity we can't support.

const CONF_LABEL = { high: 'High confidence', medium: 'Medium confidence', low: 'Small sample' };

export default function ArchetypeBadge({ playerId }) {
  const [open, setOpen] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const wrapRef = useRef(null);
  // Eager fetch on mount; useLazyFetch guards res.ok and aborts on unmount/id change.
  const { data } = useLazyFetch(`/api/players/${playerId}/archetype`, true);

  // Escape and outside-click close a tap-pinned card (mouseleave handles the hover case).
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open]);

  if (!data || !data.archetype) return null;

  const { archetype, confidence, modifiers = [], runnerUp, axes = [], dimensions, descriptor } = data;
  const modKeys = new Set(modifiers.map(m => m.key));
  const confLabel = CONF_LABEL[confidence] ?? '';

  return (
    <div
      className="archetype-badge"
      ref={wrapRef}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="archetype-pill"
        aria-expanded={open}
        aria-label={`Archetype: ${archetype.name}. ${confLabel}. Show fingerprint.`}
        onClick={() => setOpen(o => !o)}
        onFocus={() => setOpen(true)}
      >
        <span className={`archetype-conf-dot conf-${confidence}`} aria-hidden="true" />
        {archetype.name}
      </button>

      {open && (
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
