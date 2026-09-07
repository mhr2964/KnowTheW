import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { setPageMeta, resetPageMeta } from '../lib/pageMeta';

// Grouping key is the first letter of the LAST name (a reference-site directory is alphabetized by
// last name, not first) -- a simple last-whitespace-token split, good enough for every current WNBA
// roster name and consistent with how little name-parsing the rest of this codebase does elsewhere.
function lastNameInitial(name) {
  const parts = name.trim().split(/\s+/);
  const last = parts[parts.length - 1] || name;
  const letter = last.replace(/[^A-Za-z]/g, '')[0];
  return letter ? letter.toUpperCase() : '#';
}

// The "Players" hub Basketball-Reference's own nav treats as its single most important bucket --
// KnowTheW had no browsable equivalent before this page, only the header search box (which isn't a
// destination you can land on or link to). Active players only for v1 (getActivePlayers() is a free
// in-memory read); a retired-player browse would need a much larger historical index and isn't
// what closed the actual gap the nav comparison surfaced.
export default function PlayersDirectoryPage() {
  const [players, setPlayers] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setPageMeta('Players — KnowTheW', 'Browse every active WNBA player by name.');
    const controller = new AbortController();
    fetch('/api/league/players', { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => setPlayers(data.players))
      .catch(err => {
        if (err.name !== 'AbortError') setError('Could not load the player directory.');
      });
    return () => {
      controller.abort();
      resetPageMeta();
    };
  }, []);

  if (error) return <p className="status-msg error">{error}</p>;
  if (!players) return <p className="status-msg">Loading players...</p>;

  const groups = new Map();
  for (const p of players) {
    const key = lastNameInitial(p.name);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }
  const letters = [...groups.keys()].sort();

  return (
    <>
      <h1>Players</h1>
      <p className="status-msg">{players.length} active players, A–Z by last name.</p>
      <nav className="player-directory-jump" aria-label="Jump to letter">
        {letters.map(l => <a key={l} href={`#letter-${l}`}>{l}</a>)}
      </nav>
      {letters.map(l => (
        <section key={l} id={`letter-${l}`} className="player-directory-group">
          <h2 className="section-title">{l}</h2>
          <div className="player-directory-grid">
            {groups.get(l).map(p => (
              <NavLink
                key={p.id}
                to={`/player/${p.id}`}
                className={({ isActive }) => `player-directory-link${isActive ? ' active' : ''}`}
              >
                {p.name}
                {p.teamAbbr && <span className="player-directory-team"> · {p.teamAbbr}</span>}
              </NavLink>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
