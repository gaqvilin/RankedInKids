import { useCallback, useEffect, useRef, useState } from 'react';

export type AsyncState<T> = { data: T | undefined; error: Error | null; loading: boolean; reload: (fresh?: boolean) => void };

/** Runs fn on mount and when deps change. reload(true) asks fn to bypass caches. */
export function useAsync<T>(fn: (fresh: boolean) => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);

  const run = useCallback((fresh: boolean) => {
    const id = ++seq.current;
    setLoading(true);
    fn(fresh)
      .then((d) => {
        if (id !== seq.current) return;
        setData(d);
        setError(null);
      })
      .catch((e: Error) => {
        if (id === seq.current) setError(e);
      })
      .finally(() => {
        if (id === seq.current) setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    run(false);
  }, [run]);

  return { data, error, loading, reload: (fresh = true) => run(fresh) };
}
