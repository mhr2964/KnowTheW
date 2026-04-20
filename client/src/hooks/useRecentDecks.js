import { useState, useCallback } from 'react';
import { deriveColumns } from '../lib/statsColumns';

const STORAGE_KEY = 'knowthew_recent_decks';
const MAX_RECENT = 5;

function migrateDeck(deck) {
  if (!deck.data?.length) return deck;
  const columns = deriveColumns(deck.data);
  const validKeys = new Set(columns.map(c => c.key));
  return {
    ...deck,
    columns,
    frontFields: (deck.frontFields ?? []).filter(k => validKeys.has(k)),
    backFields: (deck.backFields ?? []).filter(k => validKeys.has(k)),
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
