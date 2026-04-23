import { useState, useEffect, useRef } from 'react';

// Fetches `url` once when `enabled` becomes true. Aborts on unmount or url change.
// Re-fetches if a previous attempt errored. Does not re-fetch on re-enables after success.
export default function useLazyFetch(url, enabled) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(false);
  const abortRef    = useRef(null);
  const fetchedRef  = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(false);

    fetch(url, { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(d => { setData(d); setLoading(false); })
      .catch(err => {
        if (err.name !== 'AbortError') {
          fetchedRef.current = false;
          setError(true);
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [enabled, url]);

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  return { data, loading, error };
}
