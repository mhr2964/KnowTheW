import { useState, useEffect, useRef, useCallback } from 'react';

// GameLogTab, SplitsTab, and ShotChart each hand-rolled a near-identical block: fetch-per-season,
// abort on season change, a local cache object keyed by season (or a compound key like
// SplitsTab's `season:splitType`), retry/error state. This is that block, generalized.
//
// `url` doubles as the cache key -- it already uniquely encodes every dimension a caller varies
// (season alone, or season+splitType for SplitsTab's compound case), so there's no need for a
// separate key param. Pass `null`/`undefined` for `url` when nothing is ready to fetch yet (e.g.
// season not chosen). Revisiting a `url` already fetched this component's lifetime serves instantly
// from cache -- no loading flicker, no re-fetch.
const defaultParse = async (r) => {
  if (!r.ok) throw new Error();
  return r.json();
};

/**
 * @param {string|null|undefined} url
 * @param {{parse?: (r: Response) => Promise<any>}} [options] `parse` lets a caller customize
 *   response handling -- e.g. ShotChart treats a 404 as a legitimate "no tracking data" result, not
 *   an error. Defaults to "any non-ok status is an error, otherwise parse JSON".
 */
export default function useSeasonScopedFetch(url, { parse = defaultParse } = {}) {
  const [cache, setCache] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const abortRef = useRef(null);
  const fetchedRef = useRef(new Set());
  // Read via ref, not a dependency -- callers that pass an inline (non-memoized) `parse` shouldn't
  // trigger a re-fetch just because that function's reference changed on re-render.
  const parseRef = useRef(parse);
  parseRef.current = parse;

  useEffect(() => {
    if (!url || fetchedRef.current.has(url)) {
      setLoading(false);
      setError(false);
      return undefined;
    }
    fetchedRef.current.add(url);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(false);

    fetch(url, { signal: controller.signal })
      .then(r => parseRef.current(r))
      .then(d => {
        setCache(prev => ({ ...prev, [url]: d }));
        setLoading(false);
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          fetchedRef.current.delete(url);
          setError(true);
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [url, retryCount]);

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  const retry = useCallback(() => {
    if (url) fetchedRef.current.delete(url);
    setError(false);
    setRetryCount(c => c + 1);
  }, [url]);

  return { data: url ? cache[url] ?? null : null, loading, error, retry };
}
