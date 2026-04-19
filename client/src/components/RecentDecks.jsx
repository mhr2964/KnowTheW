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

export default function RecentDecks({ decks, onRestudy }) {
  if (!decks.length) return null;
  return (
    <section className="recent-section">
      <h2 className="section-title">Recent Decks</h2>
      <div className="recent-list">
        {decks.map(deck => (
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
    </section>
  );
}
