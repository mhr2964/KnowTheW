import { Link } from 'react-router-dom';

// Static across every render/instance — hoisted so it isn't rebuilt on every render.
const LEGAL_LINKS = [
  { to: '/about', label: 'About' },
  { to: '/data-sources', label: 'Data Sources' },
  { to: '/privacy', label: 'Privacy Policy' },
  { to: '/terms', label: 'Terms of Use' },
];

export default function LegalFooterNav({ current }) {
  return (
    <nav className="legal-nav">
      <Link to="/">← Home</Link>
      {LEGAL_LINKS.filter(l => l.to !== current).map(l => (
        <Link key={l.to} to={l.to}>{l.label}</Link>
      ))}
    </nav>
  );
}
