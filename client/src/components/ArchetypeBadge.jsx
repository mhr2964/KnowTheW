import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import useLazyFetch from '../hooks/useLazyFetch';
import FingerprintRadar from './FingerprintRadar';

const CARD_MAX = 320;

// Archetype badge. The pill names the archetype; the card (radar + descriptor + expandable 13-bar
// detail) opens on hover/focus and can be PINNED open by click/tap.
//
// Open model uses two independent signals so they can't fight each other (the old single-`open`
// state had hover, focus, and click all writing it — a click after hovering closed the just-opened
// card): `hovered` (mouse/focus) OR `pinned` (click/tap) shows the card. Escape and outside-click
// clear both. No badge renders for a too-thin sample (server returns archetype:null).
//
// Two usage modes:
//  • Player hero (no `name` prop): eager-fetch on mount so the pill label appears immediately — one
//    badge per page, the fetch is cheap.
//  • Lists (Similar Players rows, rosters): pass `name` so the pill renders with no network up front;
//    the full card is fetched lazily on FIRST open (hover/focus/pin), so a 12-row roster doesn't fire
//    12 archetype requests on load. The label shown is identical to what /archetype returns.
// In a list the badge lives inside a clickable row, so it stops click/keydown propagation — opening
// the card never also triggers the row's expand/navigate.

const CONF_LABEL = { high: 'High confidence', medium: 'Medium confidence', low: 'Small sample' };

export default function ArchetypeBadge({ playerId, name = null, confidence = null }) {
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  // `armed` gates the fetch: eager when we have no name to show (player hero), otherwise deferred
  // until the card is first opened. Once armed it stays armed (useLazyFetch fetches once).
  const [armed, setArmed] = useState(!name);
  const [pos, setPos] = useState(null);
  const wrapRef = useRef(null);
  const cardRef = useRef(null);
  const { data } = useLazyFetch(`/api/players/${playerId}/archetype`, armed);

  const show = hovered || pinned;

  // First open arms the deferred fetch.
  useEffect(() => { if (show) setArmed(true); }, [show]);

  // Card is portal-rendered to <body> with position:fixed and JS-computed coordinates (same
  // approach as HeaderTooltip) so it isn't clipped by an ancestor's overflow, and isn't anchored
  // left:0 against a pill that the mobile hero centers — clamp within the viewport instead of
  // assuming the pill sits near the left edge.
  useEffect(() => {
    if (!show) return undefined;
    const reposition = () => {
      const r = wrapRef.current?.getBoundingClientRect();
      if (!r) return;
      const cardWidth = Math.min(CARD_MAX, window.innerWidth * 0.9);
      const left = Math.min(Math.max(r.left, 8), window.innerWidth - cardWidth - 8);
      setPos({ left, top: r.bottom + 8 });
    };
    reposition();
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [show]);

  // Escape and outside-click dismiss the card entirely (covers the pinned/keyboard cases that
  // mouseleave doesn't).
  useEffect(() => {
    if (!show) return undefined;
    const dismiss = () => { setPinned(false); setHovered(false); };
    const onKey = (e) => { if (e.key === 'Escape') dismiss(); };
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)
        && cardRef.current && !cardRef.current.contains(e.target)) dismiss();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [show]);

  // Pill label: the loaded archetype name, else the prop (lists render before the card loads). With
  // no name and no data yet, there's nothing to show — matches the "no badge for thin sample" rule.
  const loaded = data && data.archetype;
  const pillName = (loaded && data.archetype.name) || name;
  if (!pillName) return null;

  const { modifiers = [], runnerUp, axes = [], dimensions, descriptor } = data ?? {};
  const modKeys = new Set(modifiers.map(m => m.key));
  // Effective confidence: the loaded value once the hover fetch lands, else the prop (lists seed it so
  // the dot shows immediately). Player hero passes no prop → uses the eager-loaded value, as before.
  const conf = (data && data.confidence) || confidence;
  const confLabel = CONF_LABEL[conf] ?? '';

  return (
    <div
      className="archetype-badge"
      ref={wrapRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="archetype-pill"
        aria-expanded={show}
        aria-label={`Archetype: ${pillName}.${confLabel ? ` ${confLabel}.` : ''} Show fingerprint.`}
        onClick={() => setPinned(p => !p)}
        onFocus={() => setHovered(true)}
      >
        {conf && <span className={`archetype-conf-dot conf-${conf}`} aria-hidden="true" />}
        {pillName}
      </button>

      {show && pos && createPortal(
        <div
          ref={cardRef}
          className="archetype-card"
          role="dialog"
          aria-label={`${pillName} fingerprint`}
          style={{ left: pos.left, top: pos.top }}
        >
          {!loaded ? (
            <p className="archetype-descriptor">Loading fingerprint…</p>
          ) : (
            <>
              <div className="archetype-card-head">
                <span className="archetype-card-name">{pillName}</span>
                <span className={`archetype-card-conf conf-${conf}`}>{confLabel}</span>
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
            </>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}
