import { useState, useEffect } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import PlayerPage from '../components/PlayerPage';

const VALID_TABS = new Set(['totals', 'per36', 'per100', 'advanced', 'gamelog']);

export default function PlayerRoutePage({ onSaveDeck }) {
  const { id, tab } = useParams();
  const navigate = useNavigate();

  const [playerData, setPlayerData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setPlayerData(null);
    setLoading(true);
    fetch(`/api/players/${id}`, { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => { setPlayerData(data); setLoading(false); })
      .catch(err => { if (err.name !== 'AbortError') setLoading(false); });
    return () => controller.abort();
  }, [id]);

  useEffect(() => {
    if (playerData?.player?.name) document.title = `${playerData.player.name} — KnowTheW`;
    return () => { document.title = 'KnowTheW'; };
  }, [playerData]);

  // Redirect invalid :tab so URL and UI stay in sync — hooks must come first
  if (tab && !VALID_TABS.has(tab)) {
    return <Navigate to={`/player/${id}`} replace />;
  }

  const initialTab = (tab && VALID_TABS.has(tab)) ? tab : 'perGame';

  if (loading) return <p className="status-msg">Loading player...</p>;
  if (!playerData) return <p className="status-msg">Could not load player data.</p>;

  function handleBack() {
    // react-router-dom v6 stores its navigation index on history.state.idx
    if (window.history.state?.idx > 0) navigate(-1);
    else navigate('/');
  }

  return (
    // key={id} forces a remount when switching between players, preventing stale
    // state (gameLogCache, gameLogFetchedRef, useLazyFetch fetchedRef) from leaking.
    <PlayerPage
      key={id}
      player={playerData.player}
      onBack={handleBack}
      onSaveDeck={onSaveDeck}
      initialTab={initialTab}
      onTabChange={(tabKey) => {
        if (tabKey === 'perGame') navigate(`/player/${id}`, { replace: true });
        else navigate(`/player/${id}/${tabKey}`, { replace: true });
      }}
    />
  );
}
