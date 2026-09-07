import { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';

// Basketball-Reference doesn't try to fit its mega-menu nav bar at every width -- below their own
// 1020px breakpoint, the whole bar is replaced by a single "MENU" button opening a full accordion
// index. This does the same: NavDropdown's click-toggle bar (site-nav) handles >1020px, this
// handles everything narrower. A horizontally-scrolling row of dropdown triggers was a reasonable
// stretch of the desktop shape, but a real hamburger + accordion is the shape actually meant for
// touch-width screens, not an approximation of it.
function NavGroupSection({ label, items, onNavigate }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mobile-nav-section">
      <button
        type="button"
        className="mobile-nav-section-trigger"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        {label}
        <span className="nav-dropdown-caret" aria-hidden="true">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div className="mobile-nav-section-panel">
          {items.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={({ isActive }) => `nav-dropdown-item${item.strong ? ' nav-dropdown-item--strong' : ''}${isActive ? ' active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MobileNav({ entries }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div className="mobile-nav" ref={containerRef}>
      <button type="button" className="mobile-nav-trigger" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span aria-hidden="true">☰</span> Menu
      </button>
      {open && (
        <div className="mobile-nav-panel">
          {entries.map(entry => entry.type === 'link' ? (
            <NavLink
              key={entry.to}
              to={entry.to}
              end={entry.end}
              onClick={close}
              className={({ isActive }) => `mobile-nav-flat-link${isActive ? ' active' : ''}`}
            >
              {entry.label}
            </NavLink>
          ) : (
            <NavGroupSection key={entry.label} label={entry.label} items={entry.items} onNavigate={close} />
          ))}
        </div>
      )}
    </div>
  );
}
