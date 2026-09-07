import { useState, useEffect, useMemo, useRef } from 'react';
import { Routes, Route, Navigate, NavLink, useNavigate, useLocation, useSearchParams, useParams } from 'react-router-dom';
import { useRecentDecks } from './hooks/useRecentDecks';
import { useAuth } from './hooks/useAuth';
import StudyFlow from './components/StudyFlow';
import AdSlot from './components/AdSlot';
import HomePage from './pages/HomePage';
import TeamsPage from './pages/TeamsPage';
import StandingsPage from './pages/StandingsPage';
import ShotZoneLeadersPage from './pages/ShotZoneLeadersPage';
import LeagueLeadersPage from './pages/LeagueLeadersPage';
import AwardsHistoryPage from './pages/AwardsHistoryPage';
import InjuryReportPage from './pages/InjuryReportPage';
import OddsHubPage from './pages/OddsHubPage';
import GameBoxScorePage from './pages/GameBoxScorePage';
import NotableGamesPage from './pages/NotableGamesPage';
import CareerLeadersPage from './pages/CareerLeadersPage';
import PlayersDirectoryPage from './pages/PlayersDirectoryPage';
import ScheduleHubPage from './pages/ScheduleHubPage';
import PlayoffsHubPage from './pages/PlayoffsHubPage';
import SeasonStatsPage from './pages/SeasonStatsPage';
import TeamPage from './pages/TeamPage';
import TeamDashboard from './pages/TeamDashboard';
import TeamRosterPage from './pages/TeamRosterPage';
import TeamStatsPage from './pages/TeamStatsPage';
import TeamHistoryPage from './pages/TeamHistoryPage';
import TeamSchedulePage from './pages/TeamSchedulePage';
import PlayerRoutePage from './pages/PlayerRoutePage';
import SearchPage from './pages/SearchPage';
import ComparePage from './pages/ComparePage';
import SimilarPlayersPage from './pages/SimilarPlayersPage';
import NotFoundPage from './pages/NotFoundPage';
import AboutPage from './pages/AboutPage';
import DataSourcesPage from './pages/DataSourcesPage';
import PrivacyPage from './pages/PrivacyPage';
import TermsPage from './pages/TermsPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import AccountPage from './pages/AccountPage';
import NotificationBell from './components/NotificationBell';
import NavDropdown from './components/NavDropdown';
import MobileNav from './components/MobileNav';
import { buildNavEntries, buildTeamsNavItems } from './lib/navEntries';
import './styles/global.css';
import './styles/layout.css';
import './styles/shared.css';
import './styles/player.css';
import './styles/compare.css';
import './styles/team.css';
import './styles/legal.css';
import './styles/auth.css';
import './styles/notifications.css';
import './styles/standings.css';
import './styles/responsive.css';

function RedirectToPlayer() {
  const { idA } = useParams();
  return <Navigate to={`/player/${idA}`} replace />;
}

const SUGGESTION_MIN_LEN = 2;
const SUGGESTION_DEBOUNCE_MS = 250;

// Basketball-Reference's header search shows live suggestions as you type (an "ac-dropdown" under
// the input); this site's search used to be submit-only, a full-page round trip just to find out
// whether a name matched anything. Reuses the existing /api/search endpoint (already backs the
// full /search results page) -- debounced so every keystroke doesn't fire a request, and an
// in-flight request is aborted the moment a newer keystroke supersedes it so a slow stale response
// can never overwrite a fresher one.
function SearchBar() {
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
          {suggestions.teams.slice(0, 4).map(t => (
            <button key={`team-${t.id}`} type="button" className="search-suggestion-item" onClick={() => goTo(`/team/${t.slug}`)}>
              {t.logo && <img src={t.logo} alt="" className="standings-team-logo" />}
              <span>{t.name}</span>
              <span className="search-suggestion-meta">{t.abbreviation}</span>
            </button>
          ))}
          {suggestions.players.slice(0, 6).map(p => (
            <button key={`player-${p.id}`} type="button" className="search-suggestion-item" onClick={() => goTo(`/player/${p.id}`)}>
              <span>{p.name}</span>
              <span className="search-suggestion-meta">{p.teamName ?? p.position ?? ''}</span>
            </button>
          ))}
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

export default function App() {
  const [teams, setTeams] = useState([]);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [teamsError, setTeamsError] = useState(null);
  const [activeStudy, setActiveStudy] = useState(null);

  const navigate = useNavigate();
  const { decks, saveDeck } = useRecentDecks();
  const { user } = useAuth();

  const navEntries = useMemo(() => buildNavEntries(buildTeamsNavItems(teams)), [teams]);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch('/api/teams', { signal: controller.signal })
        .then(r => { if (!r.ok) throw new Error(); return r.json(); }),
      fetch('/api/teams/legacy', { signal: controller.signal })
        .then(r => { if (!r.ok) throw new Error(); return r.json(); }),
    ])
      .then(([active, legacyRes]) => {
        const legacy = (legacyRes.teams ?? []).map(t => ({
          ...t,
          slug: t.id,
          color: '888888',
          logo: null,
        }));
        setTeams([...active, ...legacy]);
        setTeamsLoading(false);
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          setTeamsError('Could not load teams — is the server running?');
          setTeamsLoading(false);
        }
      });
    return () => controller.abort();
  }, []);

  const handleRestudy = (deck) => {
    setActiveStudy({
      data: deck.data,
      columns: deck.columns,
      deckName: deck.name,
      initialFrontFields: deck.frontFields,
      initialBackFields: deck.backFields,
    });
  };

  return (
    <div className="app">
      <header className="header">
        <button type="button" className="logo-btn" onClick={() => navigate('/')}>
          <span className="logo-text">KnowTheW</span>
          <span className="logo-sub">WNBA</span>
        </button>
        <SearchBar />
        <NotificationBell teamRepId={user?.teamRepId ?? null} />
        {user
          ? <button type="button" className="auth-header-link" onClick={() => navigate('/account')}>{user.username}</button>
          : <button type="button" className="auth-header-link" onClick={() => navigate('/login')}>Log in</button>}
      </header>

      <nav className="site-nav">
        {navEntries.map(entry => entry.type === 'link' ? (
          <NavLink
            key={entry.to}
            to={entry.to}
            end={entry.end}
            className={({ isActive }) => `site-nav-link${isActive ? ' active' : ''}`}
          >
            {entry.label}
          </NavLink>
        ) : (
          <NavDropdown key={entry.label} label={entry.label} align={entry.align}>
            {entry.items.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `nav-dropdown-item${item.strong ? ' nav-dropdown-item--strong' : ''}${isActive ? ' active' : ''}`}
              >
                {item.label}
              </NavLink>
            ))}
          </NavDropdown>
        ))}
      </nav>
      <MobileNav entries={navEntries} />

      <AdSlot slotId={import.meta.env.VITE_AD_SLOT_TOP} className="ad-slot--top" />
      <AdSlot slotId={import.meta.env.VITE_AD_SLOT_SIDEBAR} className="ad-slot--sidebar" />

      <main className="main">
        <Routes>
          <Route
            path="/"
            element={
              <HomePage
                decks={decks}
                onRestudy={handleRestudy}
              />
            }
          />
          <Route
            path="/teams"
            element={<TeamsPage teams={teams} loading={teamsLoading} error={teamsError} />}
          />
          <Route path="/standings" element={<StandingsPage teams={teams} />} />
          <Route path="/leaders" element={<ShotZoneLeadersPage />} />
          <Route path="/league-leaders" element={<LeagueLeadersPage teams={teams} />} />
          <Route path="/awards" element={<AwardsHistoryPage />} />
          <Route path="/injuries" element={<InjuryReportPage teams={teams} />} />
          <Route path="/odds" element={<OddsHubPage teams={teams} />} />
          <Route path="/game/:id" element={<GameBoxScorePage teams={teams} />} />
          <Route path="/notable-games" element={<NotableGamesPage teams={teams} />} />
          <Route path="/all-time-leaders" element={<CareerLeadersPage teams={teams} />} />
          <Route path="/players" element={<PlayersDirectoryPage />} />
          <Route path="/schedule" element={<ScheduleHubPage teams={teams} />} />
          <Route path="/playoffs" element={<PlayoffsHubPage teams={teams} />} />
          <Route path="/season-stats" element={<SeasonStatsPage teams={teams} />} />
          <Route
            path="/team/:slug"
            element={
              <TeamPage
                teams={teams}
                teamsLoading={teamsLoading}
                teamsError={teamsError}
                onSaveDeck={saveDeck}
              />
            }
          >
            <Route index element={<TeamDashboard />} />
            <Route path="roster" element={<TeamRosterPage />} />
            <Route path="stats" element={<TeamStatsPage />} />
            <Route path="history" element={<TeamHistoryPage />} />
            <Route path="schedule" element={<TeamSchedulePage />} />
            <Route path="*" element={<Navigate to=".." replace />} />
          </Route>
          <Route
            path="/player/:id"
            element={<PlayerRoutePage onSaveDeck={saveDeck} />}
          />
          <Route
            path="/player/:id/:tab"
            element={<PlayerRoutePage onSaveDeck={saveDeck} />}
          />
          <Route
            path="/search"
            element={<SearchPage />}
          />
          <Route
            path="/compare/:idA/:idB"
            element={<ComparePage />}
          />
          <Route
            path="/compare/:idA"
            element={<RedirectToPlayer />}
          />
          <Route
            path="/similar/:id"
            element={<SimilarPlayersPage />}
          />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/data-sources" element={<DataSourcesPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route
            path="/account"
            element={<AccountPage teams={teams} teamsLoading={teamsLoading} teamsError={teamsError} />}
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>

      <footer className="footer">
        <p>Stats and data sourced from ESPN. KnowTheW is not affiliated with the WNBA.</p>
        <AdSlot slotId={import.meta.env.VITE_AD_SLOT_FOOTER} className="ad-slot--footer" />
        <nav className="footer-links">
          <button type="button" className="footer-link-btn" onClick={() => navigate('/about')}>About</button>
          <button type="button" className="footer-link-btn" onClick={() => navigate('/data-sources')}>Data Sources</button>
          <button type="button" className="footer-link-btn" onClick={() => navigate('/privacy')}>Privacy</button>
          <button type="button" className="footer-link-btn" onClick={() => navigate('/terms')}>Terms</button>
        </nav>
      </footer>

      {activeStudy && (
        <StudyFlow
          {...activeStudy}
          onClose={() => setActiveStudy(null)}
          onSave={saveDeck}
        />
      )}
    </div>
  );
}
