import { useState, useEffect, useRef, useCallback } from 'react';

// Fetches `url` once when `enabled` becomes true. Aborts on unmount or url change.
// Re-fetches if a previous attempt errored. Does not re-fetch on re-enables after success.
// Returns `refetch` to manually retry after an error.
export default function useLazyFetch(url, enabled) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const abortRef    = useRef(null);
  const fetchedRef  = useRef(false);

  useEffect(() => {
    fetchedRef.current = false;
    setData(null);
    setRetryCount(0);
  }, [url]);

  useEffect(() => {
    if (!enabled) return;
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    let resolved = false;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(false);

    fetch(url, { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(d => { resolved = true; setData(d); setLoading(false); })
      .catch(err => {
        if (err.name !== 'AbortError') {
          resolved = true;
          fetchedRef.current = false;
          setError(true);
          setLoading(false);
        }
      });

    return () => {
      controller.abort();
      if (!resolved) fetchedRef.current = false;
    };
  // retryCount included so bumping it re-runs the effect after an error reset
  }, [enabled, url, retryCount]);

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  const refetch = useCallback(() => {
    fetchedRef.current = false;
    setError(false);
    setRetryCount(c => c + 1);
  }, []);

  return { data, loading, error, refetch };
}
