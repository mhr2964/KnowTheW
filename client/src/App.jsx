import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation, useSearchParams, useParams } from 'react-router-dom';
import { useRecentDecks } from './hooks/useRecentDecks';
import StudyFlow from './components/StudyFlow';
import HomePage from './pages/HomePage';
import TeamPage from './pages/TeamPage';
import TeamDashboard from './pages/TeamDashboard';
import TeamRosterPage from './pages/TeamRosterPage';
import TeamStatsPage from './pages/TeamStatsPage';
import TeamHistoryPage from './pages/TeamHistoryPage';
import TeamSchedulePage from './pages/TeamSchedulePage';
import PlayerRoutePage from './pages/PlayerRoutePage';
import SearchPage from './pages/SearchPage';
import ComparePage from './pages/ComparePage';
import NotFoundPage from './pages/NotFoundPage';
import './App.css';

function RedirectToPlayer() {
  const { idA } = useParams();
  return <Navigate to={`/player/${idA}`} replace />;
}

function SearchBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Mirror the URL q param when on /search; empty everywhere else.
  const urlQuery = location.pathname === '/search' ? (searchParams.get('q') ?? '') : '';
  const [value, setValue] = useState(urlQuery);

  useEffect(() => {
    setValue(urlQuery);
  }, [urlQuery]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (value.trim()) navigate(`/search?q=${encodeURIComponent(value.trim())}`);
  };

  return (
    <form className="search-form" onSubmit={handleSubmit}>
      <input
        className="search-input"
        type="text"
        placeholder="Search players or teams..."
        value={value}
        onChange={e => setValue(e.target.value)}
      />
      <button type="submit" className="search-btn">Search</button>
    </form>
  );
}

export default function App() {
  const [teams, setTeams] = useState([]);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [teamsError, setTeamsError] = useState(null);
  const [activeStudy, setActiveStudy] = useState(null);

  const navigate = useNavigate();
  const { decks, saveDeck } = useRecentDecks();

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
      </header>

      <main className="main">
        <Routes>
          <Route
            path="/"
            element={
              <HomePage
                teams={teams}
                loading={teamsLoading}
                error={teamsError}
                decks={decks}
                onRestudy={handleRestudy}
              />
            }
          />
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
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>

      <footer className="footer">
        Stats and data sourced from ESPN. KnowTheW is not affiliated with the WNBA.
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
