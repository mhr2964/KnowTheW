import { useState, useRef, useEffect, useCallback } from 'react';
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

  const dismiss = useCallback(() => { setPinned(false); setHovered(false); }, []);
  // Hover only means anything with a real mouse. Setting it unconditionally caused a real bug on
  // mobile: dismissing removes the full-viewport backdrop while the (Playwright/emulated) cursor is
  // still sitting exactly where the pill is, and the browser re-hit-tests under a stationary cursor
  // when the DOM changes -- the now-exposed pill gets a synthetic mouseenter and immediately
  // reopens the card via `hovered`. Gating hover-driven opens to above the mobile breakpoint kills
  // the loop at its root instead of special-casing the backdrop.
  const setHoveredIfDesktop = useCallback(v => { if (window.innerWidth > 600) setHovered(v); }, []);

  // Card is portal-rendered to <body>. Above the 600px breakpoint it's position:fixed with
  // JS-computed coordinates anchored under the pill (same approach as HeaderTooltip), clamped
  // within the viewport so it isn't clipped by an ancestor's overflow or run off the right edge.
  // Below it, an anchored popover doesn't work at all -- wherever the pill sits on a phone screen,
  // an 8px-below-the-pill card can land anywhere from mostly-off-screen to requiring a scroll to
  // read, which was the actual "doesn't stay on screen" complaint. Render it as a fixed, centered
  // sheet instead (see .archetype-card--sheet) -- pos.mobile skips the anchored-coordinate math
  // entirely and lets CSS center it.
  useEffect(() => {
    if (!show) return undefined;
    const reposition = () => {
      if (window.innerWidth <= 600) { setPos({ mobile: true }); return; }
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
  // mouseleave doesn't). Listens on 'click', not 'mousedown': on the mobile sheet, the backdrop
  // sits over the pill's own coordinates (its usual dismiss target), so dismissing on mousedown
  // removed the backdrop mid-gesture and let the tap's mouseup/click resolve against the
  // newly-exposed pill underneath -- reopening the card via its own onClick in the same gesture
  // that was supposed to close it. Dismissing on 'click' instead means the whole gesture has
  // already resolved against the backdrop before anything unmounts, so there's nothing left to
  // leak through to the pill.
  useEffect(() => {
    if (!show) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') dismiss(); };
    const onOutsideClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)
        && cardRef.current && !cardRef.current.contains(e.target)) dismiss();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('click', onOutsideClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('click', onOutsideClick);
    };
  }, [show, dismiss]);

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
      onMouseEnter={() => setHoveredIfDesktop(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={(e) => e.stopPropagation()}
      // Escape needs to reach the document-level listener below (which closes the card) --
      // stopping propagation for every key, as before, silently ate it since the native event
      // never got that far, a pre-existing bug this pass surfaced by testing Escape directly.
      onKeyDown={(e) => { if (e.key !== 'Escape') e.stopPropagation(); }}
    >
      <button
        type="button"
        className="archetype-pill"
        aria-expanded={show}
        aria-label={`Archetype: ${pillName}.${confLabel ? ` ${confLabel}.` : ''} Show fingerprint.`}
        onClick={() => setPinned(p => !p)}
        onFocus={() => setHoveredIfDesktop(true)}
      >
        {conf && <span className={`archetype-conf-dot conf-${conf}`} aria-hidden="true" />}
        {pillName}
      </button>

      {show && pos && createPortal(
        <>
          {pos.mobile && <div className="archetype-card-backdrop" onClick={dismiss} />}
          <div
            ref={cardRef}
            className={`archetype-card${pos.mobile ? ' archetype-card--sheet' : ''}`}
            role="dialog"
            aria-label={`${pillName} fingerprint`}
            style={pos.mobile ? undefined : { left: pos.left, top: pos.top }}
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
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}
