import { useState, useEffect, useCallback, useRef } from 'react';
import { useRecentDecks } from './hooks/useRecentDecks';
import RosterTable from './components/RosterTable';
import RecentDecks from './components/RecentDecks';
import StudyFlow from './components/StudyFlow';
import PlayerPage from './components/PlayerPage';
import './App.css';

function SearchBar({ onSearch }) {
  const [input, setInput] = useState('');
  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim()) onSearch(input.trim());
  };
  return (
    <form className="search-form" onSubmit={handleSubmit}>
      <input
        className="search-input"
        type="text"
        placeholder="Search players or teams..."
        value={input}
        onChange={e => setInput(e.target.value)}
      />
      <button type="submit" className="search-btn">Search</button>
    </form>
  );
}

function TeamCard({ team, onClick }) {
  return (
    <button
      type="button"
      className="team-card"
      style={{ '--team-color': `#${team.color}` }}
      onClick={() => onClick(team)}
    >
      {team.logo && <img src={team.logo} alt={team.name} className="team-logo" />}
      <span className="team-name">{team.name}</span>
      <span className="team-abbr">{team.abbreviation}</span>
    </button>
  );
}

function PremiumBanner() {
  const [showModal, setShowModal] = useState(false);
  return (
    <>
      <div className="premium-banner">
        <div className="premium-text">
          <span className="premium-label">PREMIUM</span>
          <h3>Advanced stats, historical data &amp; draft rankings</h3>
          <p>Everything you need to go deeper on WNBA analytics.</p>
        </div>
        <div className="premium-cta">
          <span className="premium-price">$4.99 / mo</span>
          <button type="button" className="premium-btn" onClick={() => setShowModal(true)}>
            Get Premium
          </button>
        </div>
      </div>
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>KnowTheW Premium</h3>
            <p>Stripe checkout — test mode</p>
            <div className="modal-stripe-placeholder">
              <span>Stripe payment form loads here</span>
              <span className="modal-note">VITE_STRIPE_PUBLISHABLE_KEY not yet configured</span>
            </div>
            <button type="button" className="modal-close" onClick={() => setShowModal(false)}>Close</button>
          </div>
        </div>
      )}
    </>
  );
}

export default function App() {
  const [teams, setTeams] = useState([]);
  const [view, setView] = useState('home');
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [roster, setRoster] = useState([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [searchResults, setSearchResults] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeStudy, setActiveStudy] = useState(null);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [playerLoading, setPlayerLoading] = useState(false);
  const [prevView, setPrevView] = useState('home');

  const rosterAbortRef = useRef(null);
  const searchAbortRef = useRef(null);
  const playerAbortRef = useRef(null);

  const { decks, saveDeck } = useRecentDecks();

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/teams', { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => { setTeams(data); setLoading(false); })
      .catch(err => {
        if (err.name !== 'AbortError') {
          setError('Could not load teams — is the server running?');
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, []);

  const handleTeamClick = useCallback((team) => {
    if (rosterAbortRef.current) rosterAbortRef.current.abort();
    const controller = new AbortController();
    rosterAbortRef.current = controller;

    setSelectedTeam(team);
    setView('team');
    setRoster([]);
    setRosterLoading(true);
    fetch(`/api/teams/${team.id}/roster`, { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => { setRoster(data.players); setRosterLoading(false); })
      .catch(err => { if (err.name !== 'AbortError') { setRoster([]); setRosterLoading(false); } });
  }, []);

  const handleSearch = useCallback((q) => {
    if (searchAbortRef.current) searchAbortRef.current.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;

    setView('search');
    setSearchResults(null);
    setSearchLoading(true);
    fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => { setSearchResults(data); setSearchLoading(false); })
      .catch(err => { if (err.name !== 'AbortError') { setSearchResults({ teams: [], players: [] }); setSearchLoading(false); } });
  }, []);

  const handlePlayerClick = useCallback((playerId) => {
    if (playerAbortRef.current) playerAbortRef.current.abort();
    const controller = new AbortController();
    playerAbortRef.current = controller;

    setView(current => { setPrevView(current); return 'player'; });
    setSelectedPlayer(null);
    setPlayerLoading(true);
    fetch(`/api/players/${playerId}`, { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => { setSelectedPlayer(data); setPlayerLoading(false); })
      .catch(err => { if (err.name !== 'AbortError') setPlayerLoading(false); });
  }, []);

  const handleRestudy = useCallback((deck) => {
    setActiveStudy({
      data: deck.data,
      columns: deck.columns,
      deckName: deck.name,
      initialFrontFields: deck.frontFields,
      initialBackFields: deck.backFields,
    });
  }, []);

  const goHome = () => { setView('home'); setSelectedTeam(null); setSearchResults(null); setSelectedPlayer(null); };
  const goBack = () => { setView(prevView); setSelectedPlayer(null); };

  return (
    <div className="app">
      <header className="header">
        <button type="button" className="logo-btn" onClick={goHome}>
          <span className="logo-text">KnowTheW</span>
          <span className="logo-sub">WNBA</span>
        </button>
        <SearchBar onSearch={handleSearch} />
      </header>

      <main className="main">
        {loading && <p className="status-msg">Loading teams...</p>}
        {error && <p className="status-msg error">{error}</p>}

        {!loading && !error && view === 'home' && (
          <>
            <RecentDecks decks={decks} onRestudy={handleRestudy} />
            <h2 className="section-title">All Teams</h2>
            <div className="team-grid">
              {teams.map(team => (
                <TeamCard key={team.id} team={team} onClick={handleTeamClick} />
              ))}
            </div>
            <PremiumBanner />
          </>
        )}

        {view === 'team' && selectedTeam && (
          <>
            <button type="button" className="back-btn" onClick={goHome}>← All Teams</button>
            <div className="team-header" style={{ '--team-color': `#${selectedTeam.color}` }}>
              {selectedTeam.logo && (
                <img src={selectedTeam.logo} alt={selectedTeam.name} className="team-header-logo" />
              )}
              <h2 className="team-header-name">{selectedTeam.name}</h2>
            </div>
            {rosterLoading && <p className="status-msg">Loading roster...</p>}
            {!rosterLoading && roster.length > 0 && (
              <RosterTable
                players={roster}
                teamName={selectedTeam.name}
                onSaveDeck={saveDeck}
                onPlayerClick={handlePlayerClick}
              />
            )}
            {!rosterLoading && roster.length === 0 && (
              <p className="status-msg">No roster data available.</p>
            )}
          </>
        )}

        {view === 'search' && (
          <>
            <button type="button" className="back-btn" onClick={goHome}>← All Teams</button>
            {searchLoading && <p className="status-msg">Searching...</p>}
            {!searchLoading && searchResults && (
              <>
                {searchResults.teams.length > 0 && (
                  <>
                    <h3 className="section-title">Teams</h3>
                    <div className="team-grid">
                      {searchResults.teams.map(team => (
                        <TeamCard key={team.id} team={team} onClick={handleTeamClick} />
                      ))}
                    </div>
                  </>
                )}
                {searchResults.players.length > 0 && (
                  <>
                    <h3 className="section-title">Players</h3>
                    <div className="search-player-list">
                      {searchResults.players.map(player => (
                        <button
                          key={player.id}
                          type="button"
                          className="search-player-row search-player-row-btn"
                          onClick={() => handlePlayerClick(player.id)}
                        >
                          {player.headshot
                            ? <img src={player.headshot} alt={player.name} className="player-headshot" />
                            : <div className="player-headshot placeholder" />
                          }
                          <div className="player-info">
                            <span className="player-name">{player.name}</span>
                            <span className="player-meta">
                              {player.jersey ? `#${player.jersey}` : ''}
                              {player.jersey && player.position ? ' · ' : ''}
                              {player.position}
                              {player.teamName ? ` · ${player.teamName}` : ''}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {searchResults.teams.length === 0 && searchResults.players.length === 0 && (
                  <p className="status-msg">No results found.</p>
                )}
              </>
            )}
          </>
        )}
        {view === 'player' && (
          <>
            {playerLoading && <p className="status-msg">Loading player...</p>}
            {!playerLoading && selectedPlayer && (
              <PlayerPage
                player={selectedPlayer.player}
                stats={selectedPlayer.stats}
                onBack={goBack}
                onSaveDeck={saveDeck}
              />
            )}
            {!playerLoading && !selectedPlayer && (
              <p className="status-msg">Could not load player data.</p>
            )}
          </>
        )}
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
