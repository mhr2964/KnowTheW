import { Link } from 'react-router-dom';

// "You are here" trail (bbref shows this on every page: "Home > WNBA > Seasons > 2025 Standings").
// This site's pages are mostly one level deep already (reflected in the top nav itself), so a
// site-wide breadcrumb would mostly just repeat the page title -- added where it actually adds
// orientation a NavLink can't: team sub-pages, which nest Team -> tab and carry a season context
// that isn't visible in the nav at all.
export default function Breadcrumbs({ items }) {
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      {items.map((item, i) => (
        <span key={i} className="breadcrumb-item">
          {i > 0 && <span className="breadcrumb-sep" aria-hidden="true">/</span>}
          {item.to ? <Link to={item.to}>{item.label}</Link> : <span>{item.label}</span>}
        </span>
      ))}
    </nav>
  );
}
