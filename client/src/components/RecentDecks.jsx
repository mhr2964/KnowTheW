import { Link } from 'react-router-dom';

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function fieldLabels(fields, columns) {
  return fields.map(k => columns.find(c => c.key === k)?.label || k).join(', ');
}

// The home page shows only the most recent deck (limit=1) with a link to /decks for the rest; the
// Recent Decks page shows them all. Decks are stored newest-first, so slicing keeps the latest.
export default function RecentDecks({ decks, onRestudy, title = 'Recent Decks', limit, showAllLink = false }) {
  if (!decks.length) return null;
  const shown = limit ? decks.slice(0, limit) : decks;
  const hiddenCount = decks.length - shown.length;
  return (
    <section className="recent-section">
      {title && <h2 className="section-title">{title}</h2>}
      <div className="recent-list">
        {shown.map(deck => (
          <button key={deck.id} type="button" className="recent-card" onClick={() => onRestudy(deck)}>
            <div className="recent-card-info">
              <span className="recent-card-name">{deck.name}</span>
              <span className="recent-card-config">
                {fieldLabels(deck.frontFields, deck.columns)} → {fieldLabels(deck.backFields, deck.columns)}
              </span>
              <span className="recent-card-meta">{deck.totalCards} cards · {timeAgo(deck.studiedAt)}</span>
            </div>
            <span className="recent-card-cta">Study →</span>
          </button>
        ))}
      </div>
      {showAllLink && hiddenCount > 0 && (
        <Link to="/decks" className="recent-all-link">
          View all recent decks ({decks.length}) →
        </Link>
      )}
    </section>
  );
}
