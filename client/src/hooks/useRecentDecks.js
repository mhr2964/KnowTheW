import { useState, useCallback } from 'react';

const STORAGE_KEY = 'knowthew_recent_decks';
const MAX_RECENT = 5;

function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
}

export function useRecentDecks() {
  const [decks, setDecks] = useState(load);

  const saveDeck = useCallback((deck) => {
    setDecks(prev => {
      const filtered = prev.filter(d => d.id !== deck.id);
      const updated = [deck, ...filtered].slice(0, MAX_RECENT);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  return { decks, saveDeck };
}
