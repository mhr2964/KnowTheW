import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { NavLink } from 'react-router-dom';

// Click/tap-to-toggle mega-menu for grouped site-nav sections (Teams/Players/Leaders/Scores).
// Basketball-Reference's own nav reveals these on hover, but hover has no clean equivalent on a
// touch screen (the first tap both "hovers" and fires the click) -- this site uses one interaction
// that behaves identically at every screen width instead of branching hover-for-desktop /
// tap-for-mobile into two behaviors to build and test.
//
// The label and the caret are two separate elements, not one combined button: the label is a real
// NavLink to the group's own "main page" (`to`) so clicking the visible text navigates there just
// like Home/Standings/Injury Report, while the caret is a small standalone button that only opens
// the panel of every item in the section. Splitting them also fixed a real visual bug this was
// bundled with -- the old single <button> carried .site-nav-link AND its own `border: none` reset,
// which silently stripped .site-nav-link's reserved 2px bottom-border slot (the active-state
// underline every plain link gets), so a dropdown trigger's "active" state only ever showed as
// a color change, never the underline its neighbors get. Making the label a genuine NavLink means
// it gets .site-nav-link's styling exactly like every other link, no special-casing needed.
//
// The panel is rendered through a portal into document.body, positioned with fixed coordinates
// computed from the container's own on-screen rect, rather than living in normal flow under the
// trigger. `.site-nav` needs `overflow-x: auto` for when the row of nav items doesn't fit its
// width -- per the CSS overflow spec, setting only one axis forces the OTHER axis to `auto` too,
// which clips any child that visually extends below the nav bar, `position: absolute` or not
// (confirmed live: a plain absolutely-positioned panel measured a correct bounding rect via
// getBoundingClientRect but rendered nothing, silently clipped by its own scrollable ancestor). A
// portal escapes that clipping instead of fighting it with more CSS.
export default function NavDropdown({ label, to, align = 'left', isActive = false, children }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState(null);
  const containerRef = useRef(null);
  const panelRef = useRef(null);

  const updateCoords = useCallback(() => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setCoords(
      align === 'right'
        ? { top: rect.bottom + 8, right: window.innerWidth - rect.right }
        : { top: rect.bottom + 8, left: rect.left }
    );
  }, [align]);

  useLayoutEffect(() => {
    if (open) updateCoords();
  }, [open, updateCoords]);

  useEffect(() => {
    if (!open) return;
    const onOutside = (e) => {
      if (containerRef.current?.contains(e.target)) return;
      if (panelRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onOutside);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', updateCoords);
    // capture: true so this also fires for .site-nav's own horizontal scroll, not just window scroll
    window.addEventListener('scroll', updateCoords, true);
    return () => {
      document.removeEventListener('pointerdown', onOutside);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', updateCoords);
      window.removeEventListener('scroll', updateCoords, true);
    };
  }, [open, updateCoords]);

  // isActive (whether the current route is one of this group's own pages -- computed by the
  // caller from the group's item paths) covers sub-routes the label's own NavLink match wouldn't
  // catch (e.g. /team/las-vegas-aces/roster when `to` is just /teams); ORed with the NavLink's own
  // isActive so the exact main-page match still works standalone.
  const activeClass = (navActive) => `site-nav-link${(navActive || isActive) ? ' active' : ''}`;

  return (
    <div className="nav-dropdown" ref={containerRef}>
      <NavLink to={to} className={({ isActive: navActive }) => activeClass(navActive)}>
        {label}
      </NavLink>
      <button
        type="button"
        className={`site-nav-link nav-dropdown-caret-btn${(open || isActive) ? ' active' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-label={`${label} menu`}
      >
        <span className="nav-dropdown-caret" aria-hidden="true">▾</span>
      </button>
      {open && coords && createPortal(
        <div ref={panelRef} className="nav-dropdown-panel" style={coords} onClick={() => setOpen(false)}>
          {children}
        </div>,
        document.body
      )}
    </div>
  );
}
