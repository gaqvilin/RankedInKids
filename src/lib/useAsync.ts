import { useCallback, useEffect, useRef, useState } from 'react';

/** at: when data was last fetched successfully in this visit (ms), null before that. */
export type AsyncState<T> = { data: T | undefined; error: Error | null; loading: boolean; at: number | null; reload: (fresh?: boolean) => void };

const STORE_PREFIX = 'padeladmin.cache.';
const STORE_MAX_AGE = 24 * 60 * 60 * 1000;

function readStore<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(STORE_PREFIX + key);
    if (!raw) return undefined;
    const { at, data } = JSON.parse(raw) as { at: number; data: T };
    return Date.now() - at < STORE_MAX_AGE ? data : undefined;
  } catch {
    return undefined;
  }
}

function writeStore(key: string, data: unknown) {
  try {
    localStorage.setItem(STORE_PREFIX + key, JSON.stringify({ at: Date.now(), data }));
  } catch {
    /* storage full or unavailable: the in-memory result is still used */
  }
}

/** Drops everything remembered on this device (e.g. after switching account). */
export function clearStoredCache() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith(STORE_PREFIX)) localStorage.removeItem(k);
    }
  } catch {
    /* storage unavailable */
  }
}

/**
 * Runs fn on mount and when deps change. reload(true) asks fn to bypass caches.
 *
 * With storeKey, the last result is remembered on the device: it is shown
 * immediately on the next visit while fresh data loads in the background
 * (loading stays true until then, but data is already there).
 */
export function useAsync<T>(fn: (fresh: boolean) => Promise<T>, deps: unknown[], storeKey?: string): AsyncState<T> {
  const [data, setData] = useState<T | undefined>(() => (storeKey ? readStore<T>(storeKey) : undefined));
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const [at, setAt] = useState<number | null>(null);
  const seq = useRef(0);
  const latest = useRef(data);
  latest.current = data;

  // reset: the deps changed (another player, team…) – never show the previous one's data.
  const run = useCallback((fresh: boolean, reset = false) => {
    const id = ++seq.current;
    setLoading(true);
    const stored = storeKey ? readStore<T>(storeKey) : undefined;
    if (reset) {
      setData(stored);
      setError(null);
    } else if (stored !== undefined) setData(stored);
    fn(fresh)
      .then((d) => {
        if (id !== seq.current) return;
        setData(d);
        setError(null);
        setAt(Date.now());
        if (storeKey) writeStore(storeKey, d);
      })
      .catch((e: Error) => {
        if (id !== seq.current) return;
        // No connection but something to show: keep showing it (the offline bar says it may be old).
        const offline = e instanceof TypeError || (typeof navigator !== 'undefined' && navigator.onLine === false);
        if (offline && (latest.current !== undefined || stored !== undefined)) return;
        setError(e);
      })
      .finally(() => {
        if (id === seq.current) setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, storeKey]);

  useEffect(() => {
    run(false, true);
  }, [run]);

  return { data, error, loading, at, reload: (fresh = true) => run(fresh) };
}
