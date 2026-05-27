import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useLazyFetch from '../hooks/useLazyFetch';
import FingerprintRadar from './FingerprintRadar';
import { initialsOf } from '../lib/initials';

// Cross-Era Similarity surface: a ranked list of the most alike players by era-normalized, absolute
// playstyle. Each row shows a headshot + archetype; clicking it pins an inline card (one open at a
// time) that puts both players side by side — headshots, archetype, career per-game stats — flanking
// a radar that overlays this player's shape under the comparable's. The "View →" link navigates
// (explicit, so a row click only ever expands). No section renders for a too-thin player (similar: []).

// Headshot from the real ESPN URL the payload carries; initials fallback when there's no URL (so we
// never request an image we know doesn't exist) or if it fails to load.
function PlayerImg({ src, name, className }) {
  const [err, setErr] = useState(false);
  if (err || !src) return <div className={`${className} placeholder`}>{initialsOf(name)}</div>;
  return <img src={src} alt={name ?? ''} className={className} onError={() => setErr(true)} />;
}

function StatLine({ stats }) {
  if (!stats) return null;
  return (
    <div className="similar-statline">
      <span>{stats.ppg}<em>PPG</em></span>
      <span>{stats.rpg}<em>RPG</em></span>
      <span>{stats.apg}<em>APG</em></span>
    </div>
  );
}

// One side of the comparison card: headshot + name + archetype + career per-game line.
function ComparePlayer({ headshot, name, archetype, stats, sideClass }) {
  return (
    <div className={`similar-cmp-side ${sideClass}`}>
      <PlayerImg src={headshot} name={name} className="similar-cmp-img" />
      <span className="similar-cmp-name">{name}</span>
      {archetype && <span className="similar-pill">{archetype}</span>}
      <StatLine stats={stats} />
    </div>
  );
}

export default function SimilarPlayersSection({ playerId, playerName }) {
  const navigate = useNavigate();
  const [pinnedId, setPinnedId] = useState(null);
  const wrapRef = useRef(null);
  const { data, loading, error, refetch } = useLazyFetch(`/api/players/${playerId}/similar`, true);

  // Collapse any open card when navigating to a different player.
  useEffect(() => { setPinnedId(null); }, [playerId]);

  // Escape / outside-click collapse the open card.
  useEffect(() => {
    if (pinnedId == null) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setPinnedId(null); };
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setPinnedId(null); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [pinnedId]);

  if (loading) {
    return (
      <section className="similar-players-section">
        <h2 className="section-title">Similar Players</h2>
        <p className="similar-status">Finding comparable players…</p>
      </section>
    );
  }
  if (error) {
    return (
      <section className="similar-players-section">
        <h2 className="section-title">Similar Players</h2>
        <button type="button" className="similar-retry" onClick={refetch}>
          Couldn’t load similar players — retry
        </button>
      </section>
    );
  }
  if (!data || !Array.isArray(data.similar) || !data.similar.length) return null;

  const target = data.target ?? {};
  const targetDims = target.dimensions ?? null;

  return (
    <section className="similar-players-section" ref={wrapRef}>
      <h2 className="section-title">Similar Players</h2>
      <p className="similar-subtitle">Closest career profiles, era-normalized.</p>
      <ul className="similar-list">
        {data.similar.map(p => {
          const open = pinnedId === p.id;
          const traits = Array.isArray(p.sharedTraits) ? p.sharedTraits : [];
          const conf = p.confidence; // 'strong' | 'moderate' | 'loose'
          const confLabel = conf ? conf.charAt(0).toUpperCase() + conf.slice(1) : '';
          return (
            <li key={p.id} className="similar-row">
              <button
                type="button"
                className={`search-player-row-btn similar-row-btn${open ? ' is-open' : ''}${conf === 'loose' ? ' is-loose' : ''}`}
                aria-expanded={open}
                onClick={() => setPinnedId(open ? null : p.id)}
              >
                <PlayerImg src={p.headshot} name={p.name} className="similar-row-img" />
                <span className="similar-row-main">
                  <span className="similar-row-name">{p.name ?? 'Unknown'}</span>
                  {p.archetype && <span className="similar-pill similar-row-pill">{p.archetype}</span>}
                </span>
                <span className="similar-row-stat">
                  {p.pos ? `${p.pos} · ` : ''}{p.similarity}%
                  {confLabel && <span className={`similar-conf-tag conf-${conf}`}>{confLabel}</span>}
                </span>
              </button>

              {open && (
                <div className="similar-card" role="region" aria-label={`How ${p.name} compares`}>
                  {traits.length > 0 && (
                    <p className="similar-traits">
                      Most alike on: {traits.map(t => t.label.toLowerCase()).join(', ')}
                    </p>
                  )}

                  <div className="similar-compare">
                    <ComparePlayer
                      headshot={target.headshot} name={playerName}
                      archetype={target.archetype} stats={target.stats} sideClass="is-target"
                    />
                    <div className="similar-cmp-center">
                      {targetDims && Array.isArray(p.dimensions) && (
                        <FingerprintRadar dimensions={p.dimensions} overlay={targetDims} />
                      )}
                      <div className="similar-legend">
                        <span className="similar-legend-item is-target">{playerName}</span>
                        <span className="similar-legend-item is-comp">{p.name}</span>
                      </div>
                    </div>
                    <ComparePlayer
                      headshot={p.headshot} name={p.name}
                      archetype={p.archetype} stats={p.stats} sideClass="is-comp"
                    />
                  </div>

                  <button
                    type="button"
                    className="similar-view-link"
                    onClick={() => navigate(`/player/${p.id}`)}
                  >
                    View {p.name} →
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
