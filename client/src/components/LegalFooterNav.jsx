import { Link } from 'react-router-dom';

export default function LegalFooterNav({ current }) {
  const links = [
    { to: '/about', label: 'About' },
    { to: '/data-sources', label: 'Data Sources' },
    { to: '/privacy', label: 'Privacy Policy' },
    { to: '/terms', label: 'Terms of Use' },
  ];

  return (
    <nav className="legal-nav">
      <Link to="/">← Home</Link>
      {links.filter(l => l.to !== current).map(l => (
        <Link key={l.to} to={l.to}>{l.label}</Link>
      ))}
    </nav>
  );
}
