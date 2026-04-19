import { useState } from 'react';
import StudyFlow from './StudyFlow';

function StatTable({ stats, onStudy }) {
  const cols = stats.names.map((name, i) => ({ key: name, label: stats.labels[i] }));
  return (
    <>
      <div className="table-toolbar">
        <h3 className="section-title">Season Stats</h3>
        <button type="button" className="study-trigger-btn" onClick={onStudy}>
          Study this table
        </button>
      </div>
      <div className="stats-table">
        <div className="stats-table-head">
          <span className="stats-season-col">Season</span>
          {cols.map(c => <span key={c.key}>{c.label}</span>)}
        </div>
        {stats.splits.map(split => (
          <div key={split.displayName} className="stats-table-row">
            <span className="stats-season-col">{split.displayName}</span>
            {split.stats.map((val, i) => (
              <span key={cols[i].key} className={split.displayName === 'Career' ? 'stats-career' : ''}>
                {val}
              </span>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

export default function PlayerPage({ player, stats, onBack }) {
  const [studying, setStudying] = useState(false);

  const bioItems = [
    player.positionName && { label: 'Position', value: player.positionName },
    player.height && { label: 'Height', value: player.height },
    player.weight && { label: 'Weight', value: player.weight },
    player.age && { label: 'Age', value: player.age },
    player.experience !== null && player.experience !== undefined && { label: 'Experience', value: `${player.experience} yr${player.experience !== 1 ? 's' : ''}` },
    player.college && { label: 'College', value: player.college },
    player.birthPlace && { label: 'Hometown', value: player.birthPlace },
  ].filter(Boolean);

  const studyData = stats ? stats.splits.map(split => ({
    season: split.displayName,
    ...Object.fromEntries(stats.names.map((name, i) => [name, split.stats[i]])),
  })) : [];

  const studyColumns = stats ? [
    { key: 'season', label: 'Season', type: 'text' },
    ...stats.names.map((name, i) => ({ key: name, label: stats.labels[i], type: 'text' })),
  ] : [];

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

      {stats
        ? <StatTable stats={stats} onStudy={() => setStudying(true)} />
        : <p className="status-msg">No stats available for this player yet.</p>
      }

      {studying && stats && (
        <StudyFlow
          data={studyData}
          columns={studyColumns}
          deckName={`${player.name} Stats`}
          onClose={() => setStudying(false)}
        />
      )}
    </>
  );
}
