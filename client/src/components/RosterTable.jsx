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

      <div className="roster-table-wrap">
        <table className="roster-table">
          <thead>
            <tr>
              <th className="roster-cell roster-cell--head roster-cell--photo" aria-hidden="true" />
              <th className="roster-cell roster-cell--head">Name</th>
              <th className="roster-cell roster-cell--head">#</th>
              <th className="roster-cell roster-cell--head">Pos</th>
            </tr>
          </thead>
          <tbody>
            {players.map(player => (
              // Row click navigates for mouse users; the name button gives keyboard/screen-reader
              // users a real focusable control instead of overriding the <tr>'s row semantics.
              // The badge is its own nested button and stops its own clicks from bubbling, so
              // opening its card never navigates to the player.
              <tr
                key={player.id}
                className="roster-row"
                onClick={() => onPlayerClick && onPlayerClick(player.id)}
              >
                <td className="roster-cell roster-cell--photo">
                  {player.headshot
                    ? <img src={player.headshot} alt="" className="table-headshot" />
                    : <div className="table-headshot placeholder" aria-hidden="true">{initialsOf(player.name)}</div>
                  }
                </td>
                <td className="roster-cell">
                  <span className="roster-name-cell">
                    <button
                      type="button"
                      className="roster-name-btn"
                      onClick={(e) => { e.stopPropagation(); onPlayerClick && onPlayerClick(player.id); }}
                    >
                      {player.name}
                    </button>
                    {player.archetypeName && <ArchetypeBadge playerId={player.id} name={player.archetypeName} confidence={player.archetypeConfidence} />}
                  </span>
                </td>
                <td className="roster-cell muted">{player.jersey || '—'}</td>
                <td className="roster-cell muted">{player.position || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
