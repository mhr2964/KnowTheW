import { useState } from 'react';
import StudyFlow from './StudyFlow';

const ROSTER_COLUMNS = [
  { key: 'headshot', label: 'Photo', type: 'image' },
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'jersey', label: 'Jersey #', type: 'text' },
  { key: 'position', label: 'Position', type: 'text' },
];

export default function RosterTable({ players, teamName, onSaveDeck, onPlayerClick }) {
  const [studying, setStudying] = useState(false);

  return (
    <>
      <div className="table-toolbar">
        <h3 className="section-title">Roster</h3>
        <button type="button" className="study-trigger-btn" onClick={() => setStudying(true)}>
          Study this table
        </button>
      </div>

      <div className="data-table">
        <div className="data-table-head">
          <span />
          <span>Name</span>
          <span>#</span>
          <span>Pos</span>
        </div>
        {players.map(player => (
          <button
            key={player.id}
            type="button"
            className="data-table-row data-table-row-btn"
            onClick={() => onPlayerClick && onPlayerClick(player.id)}
          >
            {player.headshot
              ? <img src={player.headshot} alt={player.name} className="table-headshot" />
              : <div className="table-headshot placeholder" />
            }
            <span>{player.name}</span>
            <span className="muted">{player.jersey || '—'}</span>
            <span className="muted">{player.position || '—'}</span>
          </button>
        ))}
      </div>

      {studying && (
        <StudyFlow
          data={players}
          columns={ROSTER_COLUMNS}
          deckName={`${teamName} Roster`}
          onClose={() => setStudying(false)}
          onSave={onSaveDeck}
        />
      )}
    </>
  );
}
