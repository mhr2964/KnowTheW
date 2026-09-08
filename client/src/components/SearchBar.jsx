import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';

const SUGGESTION_MIN_LEN = 2;
const SUGGESTION_DEBOUNCE_MS = 250;

// Basketball-Reference's header search shows live suggestions as you type (an "ac-dropdown" under
// the input); this site's search used to be submit-only, a full-page round trip just to find out
// whether a name matched anything. Reuses the existing /api/search endpoint (already backs the
// full /search results page) -- debounced so every keystroke doesn't fire a request, and an
// in-flight request is aborted the moment a newer keystroke supersedes it so a slow stale response
// can never overwrite a fresher one.
export default function SearchBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Mirror the URL q param when on /search; empty everywhere else.
  const urlQuery = location.pathname === '/search' ? (searchParams.get('q') ?? '') : '';
  const [value, setValue] = useState(urlQuery);
  const [suggestions, setSuggestions] = useState(null);
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const debounceRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    setValue(urlQuery);
    setOpen(false);
  }, [urlQuery]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    abortRef.current?.abort();
    const q = value.trim();
    if (q.length < SUGGESTION_MIN_LEN) {
      setSuggestions(null);
      return;
    }
    debounceRef.current = setTimeout(() => {
      const controller = new AbortController();
      abortRef.current = controller;
      fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        .then(r => { if (!r.ok) throw new Error(); return r.json(); })
        .then(data => { setSuggestions(data); setOpen(true); })
        .catch(err => { if (err.name !== 'AbortError') setSuggestions(null); });
    }, SUGGESTION_DEBOUNCE_MS);
    return () => clearTimeout(debounceRef.current);
  }, [value]);

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

  useEffect(() => () => abortRef.current?.abort(), []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (value.trim()) {
      navigate(`/search?q=${encodeURIComponent(value.trim())}`);
      setOpen(false);
    }
  };

  const goTo = (path) => {
    navigate(path);
    setOpen(false);
    // The urlQuery-reset effect above only clears `value` when urlQuery's computed value actually
    // changes -- navigating from Home to a suggestion's page never touches it (both are ''), so
    // without this, the search box was confirmed live to keep showing stale query text (and stale
    // suggestions data) after the user had already navigated away via a result.
    setValue('');
    setSuggestions(null);
  };

  const hasSuggestions = !!suggestions && (suggestions.teams.length > 0 || suggestions.players.length > 0);

  return (
    <div className="search-wrap" ref={containerRef}>
      <form className="search-form" onSubmit={handleSubmit}>
        <input
          className="search-input"
          type="text"
          placeholder="Search players or teams..."
          value={value}
          onChange={e => setValue(e.target.value)}
          onFocus={() => { if (hasSuggestions) setOpen(true); }}
          autoComplete="off"
        />
        <button type="submit" className="search-btn">Search</button>
      </form>
      {open && hasSuggestions && (
        <div className="search-suggestions">
          {suggestions.teams.length > 0 && (
            <>
              <div className="search-suggestion-heading">Teams</div>
              {suggestions.teams.slice(0, 6).map(t => (
                <button key={`team-${t.id}`} type="button" className="search-suggestion-item" onClick={() => goTo(`/team/${t.slug}`)}>
                  {t.logo && <img src={t.logo} alt="" className="standings-team-logo" />}
                  <span>{t.name}</span>
                  <span className="search-suggestion-meta">{t.abbreviation}</span>
                </button>
              ))}
            </>
          )}
          {suggestions.players.length > 0 && (
            <>
              <div className="search-suggestion-heading">Players</div>
              {suggestions.players.slice(0, 10).map(p => (
                <button key={`player-${p.id}`} type="button" className="search-suggestion-item" onClick={() => goTo(`/player/${p.id}`)}>
                  <span>{p.name}</span>
                  <span className="search-suggestion-meta">{p.retired ? 'Retired' : (p.teamName ?? p.position ?? '')}</span>
                </button>
              ))}
            </>
          )}
          <button
            type="button"
            className="search-suggestion-item search-suggestion-item--all"
            onClick={() => goTo(`/search?q=${encodeURIComponent(value.trim())}`)}
          >
            See all results for &quot;{value.trim()}&quot;
          </button>
        </div>
      )}
    </div>
  );
}
