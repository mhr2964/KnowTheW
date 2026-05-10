import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { initialsOf } from '../lib/initials';

export default function SearchPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const q = searchParams.get('q') ?? '';

  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!q.trim()) { setResults(null); return; }
    const controller = new AbortController();
    setResults(null);
    setLoading(true);
    fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => { setResults(data); setLoading(false); })
      .catch(err => { if (err.name !== 'AbortError') { setResults({ teams: [], players: [] }); setLoading(false); } });
    return () => controller.abort();
  }, [q]);

  const handleTeamClick = (team) => navigate(`/team/${team.slug}`);
  const handlePlayerClick = (id) => navigate(`/player/${id}`);

  return (
    <>
      <button type="button" className="back-btn" onClick={() => navigate('/')}>← All Teams</button>
      {loading && <p className="status-msg">Searching...</p>}
      {!loading && results && (
        <>
          {results.teams.length > 0 && (
            <>
              <h3 className="section-title">Teams</h3>
              <div className="team-grid">
                {results.teams.map(team => (
                  <button
                    key={team.id}
                    type="button"
                    className="team-card"
                    style={{ '--team-color': `#${team.color}` }}
                    onClick={() => handleTeamClick(team)}
                  >
                    {team.logo && <img src={team.logo} alt={team.name} className="team-logo" />}
                    <span className="team-name">{team.name}</span>
                    <span className="team-abbr">{team.abbreviation}</span>
                  </button>
                ))}
              </div>
            </>
          )}
          {results.players.length > 0 && (
            <>
              <h3 className="section-title">Players</h3>
              <div className="search-player-list">
                {results.players.map(player => (
                  <button
                    key={player.id}
                    type="button"
                    className="search-player-row search-player-row-btn"
                    onClick={() => handlePlayerClick(player.id)}
                  >
                    {player.headshot
                      ? <img src={player.headshot} alt={player.name} className="player-headshot" />
                      : <div className="player-headshot placeholder">{initialsOf(player.name)}</div>
                    }
                    <div className="player-info">
                      <span className="player-name">{player.name}</span>
                      <span className="player-meta">
                        {player.jersey ? `#${player.jersey}` : ''}
                        {player.jersey && player.position ? ' · ' : ''}
                        {player.position}
                        {player.teamName ? ` · ${player.teamName}` : ''}
                        {player.retired ? ' · Retired' : ''}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
          {results.teams.length === 0 && results.players.length === 0 && (
            <p className="status-msg">No results found.</p>
          )}
        </>
      )}
    </>
  );
}
