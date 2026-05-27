import { useState } from 'react';
import StudyFlow from './StudyFlow';
import ArchetypeBadge from './ArchetypeBadge';
import { initialsOf } from '../lib/initials';

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
          Study this roster
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
          // Div-button (not <button>) so the hoverable ArchetypeBadge — itself a button — can nest
          // beside the name without invalid button-in-button markup; the badge stops its own clicks
          // from bubbling, so opening its card never navigates to the player.
          <div
            key={player.id}
            role="button"
            tabIndex={0}
            className="data-table-row data-table-row-btn"
            onClick={() => onPlayerClick && onPlayerClick(player.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPlayerClick && onPlayerClick(player.id); }
            }}
          >
            {player.headshot
              ? <img src={player.headshot} alt="" className="table-headshot" />
              : <div className="table-headshot placeholder" aria-hidden="true">{initialsOf(player.name)}</div>
            }
            <span className="roster-name-cell">
              {player.name}
              {player.archetypeName && <ArchetypeBadge playerId={player.id} name={player.archetypeName} confidence={player.archetypeConfidence} />}
            </span>
            <span className="muted">{player.jersey || '—'}</span>
            <span className="muted">{player.position || '—'}</span>
          </div>
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
