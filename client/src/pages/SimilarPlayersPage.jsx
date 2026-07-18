import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useLazyFetch from '../hooks/useLazyFetch';
import ComparePickerModal from '../components/ComparePickerModal';
import SimilarPlayersSection from '../components/SimilarPlayersSection';
import { initialsOf } from '../lib/initials';

// Dedicated "players like X" page (mirrors ComparePage): a target-player header with a "Change player"
// picker that swaps who you're looking at via the URL, and the ranked similar list below. Reached from
// the "Similar players" button on the player page.

// ESPN canonical headshot URL — fallback when the roster feed omits a headshot.
function espnHeadshotUrl(id) {
  return `https://a.espncdn.com/i/headshots/wnba/players/full/${id}.png`;
}

export default function SimilarPlayersPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [imgError, setImgError] = useState(false);

  const { data, loading, error, refetch } = useLazyFetch(`/api/players/${id}`, true);
  const player = data?.player ?? data ?? null;
  const name = player?.name ?? null;

  useEffect(() => {
    if (name) document.title = `Players like ${name} — KnowTheW`;
    return () => { document.title = 'KnowTheW'; };
  }, [name]);

  // Reset the headshot-fallback flag when the target changes (swap).
  useEffect(() => { setImgError(false); }, [id]);

  function handleBack() {
    if (window.history.state?.idx > 0) navigate(-1);
    else navigate('/');
  }

  return (
    <>
      <button type="button" className="back-btn" onClick={handleBack}>← Back</button>

      {loading && <p className="status-msg">Loading player...</p>}

      {(error || (!loading && !player)) && (
        <p className="status-msg error status-msg--retry">
          Could not load player.
          {error && <button type="button" className="btn-ghost compare-verdict-retry" onClick={refetch}>Try again</button>}
        </p>
      )}

      {player && (
        <>
          <div className="player-hero similar-target">
            {!imgError
              ? <img
                  src={player.headshot ?? espnHeadshotUrl(player.id)}
                  alt={name}
                  className="player-hero-img"
                  onError={() => setImgError(true)}
                />
              : <div className="player-hero-img placeholder">{initialsOf(name)}</div>
            }
            <div className="player-hero-info">
              <span className="similar-target-eyebrow">Players like</span>
              <h1 className="player-hero-name">{name}</h1>
              <div className="player-hero-meta">
                {player.teamName && <span className="player-hero-team">{player.teamName}</span>}
                {player.positionName && <span className="player-hero-team">{player.positionName}</span>}
              </div>
              <button
                type="button"
                className="compare-trigger-btn"
                onClick={() => setPickerOpen(true)}
              >
                Change player
              </button>
            </div>
          </div>

          <SimilarPlayersSection playerId={id} playerName={name} />
        </>
      )}

      {pickerOpen && (
        <ComparePickerModal
          title="Change player"
          currentPlayerId={id}
          onPick={(newId) => { setPickerOpen(false); navigate(`/similar/${newId}`); }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </>
  );
}
