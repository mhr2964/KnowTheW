import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import RecentDecks from '../components/RecentDecks';
import { setPageMeta, resetPageMeta } from '../lib/pageMeta';

// Decks live in this browser's localStorage (useRecentDecks), so this page is per-visitor and
// needs no fetch. Studying a deck opens the same study modal App.jsx owns for the home page.
export default function RecentDecksPage({ decks, onRestudy }) {
  useEffect(() => {
    setPageMeta('Recent Decks — KnowTheW', 'Flashcard decks you have studied recently on KnowTheW.');
    return resetPageMeta;
  }, []);

  return (
    <div className="recent-decks-page">
      <h1>Recent Decks</h1>
      {decks.length ? (
        <RecentDecks decks={decks} onRestudy={onRestudy} title={null} />
      ) : (
        <p className="status-msg">
          No decks yet. Open any stat table and hit <strong>Study this table</strong> to make one.{' '}
          <Link to="/">Back home</Link>
        </p>
      )}
    </div>
  );
}
