import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DetailedStats from './DetailedStats';
import ComparePickerModal from './ComparePickerModal';
import ArchetypeBadge from './ArchetypeBadge';
import { initialsOf } from '../lib/initials';

export default function PlayerPage({ player, onBack, onSaveDeck, initialTab, onTabChange }) {
  const navigate = useNavigate();
  const [pickerOpen, setPickerOpen] = useState(false);
  const bioItems = [
    player.positionName && { label: 'Position', value: player.positionName },
    player.height && { label: 'Height', value: player.height },
    player.weight && { label: 'Weight', value: player.weight },
    player.age && { label: 'Age', value: player.age },
    player.experience != null && {
      label: 'Experience',
      value: `${player.experience} yr${player.experience !== 1 ? 's' : ''}`,
    },
    // College/Hometown are the longest values and the least likely to matter at a quick mobile
    // glance (a courtside "who is this, what are they averaging" check) -- hidden at the
    // narrowest tier via .bio-low-priority, same pattern BrefTable already uses for GS/OREB/DREB/PF.
    player.college && { label: 'College', value: player.college, lowPriority: true },
    player.birthPlace && { label: 'Hometown', value: player.birthPlace, lowPriority: true },
  ].filter(Boolean);

  return (
    <>
      <button type="button" className="back-btn" onClick={onBack}>← Back</button>

      <div className="player-hero">
        {player.headshot
          ? <img src={player.headshot} alt={player.name} className="player-hero-img" />
          : <div className="player-hero-img placeholder">{initialsOf(player.name)}</div>
        }
        <div className="player-hero-info">
          <div className="player-hero-meta">
            {player.jersey && <span className="player-hero-jersey">#{player.jersey}</span>}
            {player.teamName && <span className="player-hero-team">{player.teamName}</span>}
          </div>
          <h1 className="player-hero-name">{player.name}</h1>
          <ArchetypeBadge playerId={player.id} />
          {bioItems.length > 0 && (
            <div className="player-bio-grid">
              {bioItems.map(item => (
                <div key={item.label} className={`player-bio-item${item.lowPriority ? ' bio-low-priority' : ''}`}>
                  <span className="player-bio-label">{item.label}</span>
                  <span className="player-bio-value">{item.value}</span>
                </div>
              ))}
            </div>
          )}
          <div className="player-hero-actions">
            <button
              type="button"
              className="compare-trigger-btn"
              onClick={() => setPickerOpen(true)}
            >
              Compare with...
            </button>
            <button
              type="button"
              className="compare-trigger-btn"
              onClick={() => navigate(`/similar/${player.id}`)}
            >
              Similar players →
            </button>
          </div>
        </div>
      </div>

      <DetailedStats
        playerId={player.id}
        playerName={player.name}
        onSaveDeck={onSaveDeck}
        initialTab={initialTab}
        onTabChange={onTabChange}
      />

      {pickerOpen && (
        <ComparePickerModal
          currentPlayerId={player.id}
          onPick={(otherId) => {
            setPickerOpen(false);
            navigate(`/compare/${player.id}/${otherId}`);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </>
  );
}
