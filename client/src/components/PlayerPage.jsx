import DetailedStats from './DetailedStats';

export default function PlayerPage({ player, onBack, onSaveDeck }) {
  const bioItems = [
    player.positionName && { label: 'Position', value: player.positionName },
    player.height && { label: 'Height', value: player.height },
    player.weight && { label: 'Weight', value: player.weight },
    player.age && { label: 'Age', value: player.age },
    player.experience != null && {
      label: 'Experience',
      value: `${player.experience} yr${player.experience !== 1 ? 's' : ''}`,
    },
    player.college && { label: 'College', value: player.college },
    player.birthPlace && { label: 'Hometown', value: player.birthPlace },
  ].filter(Boolean);

  return (
    <>
      <button type="button" className="back-btn" onClick={onBack}>← Back</button>

      <div className="player-hero">
        {player.headshot
          ? <img src={player.headshot} alt={player.name} className="player-hero-img" />
          : <div className="player-hero-img placeholder" />
        }
        <div className="player-hero-info">
          <div className="player-hero-meta">
            {player.jersey && <span className="player-hero-jersey">#{player.jersey}</span>}
            {player.teamName && <span className="player-hero-team">{player.teamName}</span>}
          </div>
          <h1 className="player-hero-name">{player.name}</h1>
          {bioItems.length > 0 && (
            <div className="player-bio-grid">
              {bioItems.map(item => (
                <div key={item.label} className="player-bio-item">
                  <span className="player-bio-label">{item.label}</span>
                  <span className="player-bio-value">{item.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <DetailedStats
        playerId={player.id}
        playerName={player.name}
        onSaveDeck={onSaveDeck}
      />
    </>
  );
}
