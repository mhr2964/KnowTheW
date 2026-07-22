import { useEffect } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import PlayerPage from '../components/PlayerPage';
import useLazyFetch from '../hooks/useLazyFetch';
import { setPageMeta, resetPageMeta } from '../lib/pageMeta';
import { setStructuredData, clearStructuredData } from '../lib/structuredData';

const VALID_TABS = new Set(['totals', 'per36', 'per100', 'advanced', 'gamelog', 'splits', 'pbp']);

export default function PlayerRoutePage({ onSaveDeck }) {
  const { id, tab } = useParams();
  const navigate = useNavigate();

  const { data: playerData, loading, error: loadError, refetch } = useLazyFetch(
    `/api/players/${id}`,
    true
  );

  useEffect(() => {
    const player = playerData?.player;
    if (player?.name) {
      const teamBit = player.teamName ? ` (${player.teamName})` : '';
      setPageMeta(
        `${player.name} — KnowTheW`,
        `${player.name}${teamBit} career stats, game log, advanced metrics, and playstyle analysis on KnowTheW.`
      );
      setStructuredData({
        '@context': 'https://schema.org',
        '@type': 'Person',
        name: player.name,
        url: `${window.location.origin}/player/${id}`,
        ...(player.headshot && { image: player.headshot }),
        ...(player.positionName && { jobTitle: player.positionName }),
        ...(player.teamName && { affiliation: { '@type': 'SportsTeam', name: player.teamName } }),
        ...(player.birthPlace && { birthPlace: { '@type': 'Place', name: player.birthPlace } }),
      });
    }
    return () => { resetPageMeta(); clearStructuredData(); };
  }, [playerData, id]);

  // Redirect invalid :tab so URL and UI stay in sync — hooks must come first
  if (tab && !VALID_TABS.has(tab)) {
    return <Navigate to={`/player/${id}`} replace />;
  }

  const initialTab = (tab && VALID_TABS.has(tab)) ? tab : 'perGame';

  if (loading) return <p className="status-msg">Loading player...</p>;
  if (loadError || !playerData) return (
    <p className="status-msg error status-msg--retry">
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
