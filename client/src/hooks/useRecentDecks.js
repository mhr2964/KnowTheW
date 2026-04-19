import { useState, useCallback } from 'react';

const STORAGE_KEY = 'knowthew_recent_decks';
const MAX_RECENT = 5;
const PCT_KEYS = new Set(['FG_PCT', 'FG3_PCT', 'FT_PCT']);

function migrateDeck(deck) {
  if (!deck.columns) return deck;
  return {
    ...deck,
    columns: deck.columns.map(c =>
      PCT_KEYS.has(c.key) ? { ...c, type: 'pct' } : c
    ),
  };
}

function load() {
  try { return (JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')).map(migrateDeck); }
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
