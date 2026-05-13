import { useEffect } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import PlayerPage from '../components/PlayerPage';
import useLazyFetch from '../hooks/useLazyFetch';

const VALID_TABS = new Set(['totals', 'per36', 'per100', 'advanced', 'gamelog']);

export default function PlayerRoutePage({ onSaveDeck }) {
  const { id, tab } = useParams();
  const navigate = useNavigate();

  const { data: playerData, loading, error: loadError, refetch } = useLazyFetch(
    `/api/players/${id}`,
    true
  );

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
  if (loadError || !playerData) return (
    <p className="status-msg error" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '2rem 0' }}>
      Could not load player data.
      {loadError && <button type="button" className="btn-ghost compare-verdict-retry" onClick={refetch}>Try again</button>}
    </p>
  );

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
