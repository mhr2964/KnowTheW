import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const POP_MAX = 220;

export default function HeaderTooltip({ label, definition }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const wrapRef = useRef(null);
  const popRef = useRef(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (!wrapRef.current?.contains(e.target) && !popRef.current?.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [open]);

  if (!definition) return label;

  const reposition = () => {
    const r = wrapRef.current?.getBoundingClientRect();
    if (!r) return;
    // Anchor below the header; flip to right-align if the popover would clip the viewport edge.
    const flipRight = r.left + POP_MAX > window.innerWidth - 8;
    setPos({
      left: flipRight ? null : r.left,
      right: flipRight ? Math.max(8, window.innerWidth - r.right) : null,
      top: r.bottom + 6,
    });
  };

  const show = () => { reposition(); setOpen(true); };
  const hide = () => setOpen(false);

  return (
    <span ref={wrapRef} className="stat-help" onMouseEnter={show} onMouseLeave={hide}>
      {label}
      <button
        type="button"
        className="stat-help-mark"
        aria-label={`What is ${label}?`}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={(e) => { e.stopPropagation(); if (open) hide(); else show(); }}
        onFocus={show}
        onBlur={hide}
      >
        ?
      </button>
      {open && pos && createPortal(
        <span
          ref={popRef}
          id={id}
          role="tooltip"
          className="stat-help-pop"
          style={{ left: pos.left ?? undefined, right: pos.right ?? undefined, top: pos.top }}
        >
          {definition}
        </span>,
        document.body,
      )}
    </span>
  );
}
