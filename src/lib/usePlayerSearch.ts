import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { appPathFromRankedinUrl, searchPlayers, type PlayerHit } from './rankedin';

/** Debounced player search; a pasted Rankedin link or R-number opens the page directly. */
export function usePlayerSearch(fromLabel: string, fromPath: string) {
  const [term, setTerm] = useState('');
  const [hits, setHits] = useState<PlayerHit[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const q = term.trim();
    if (q.length < 3) {
      setHits(null);
      setLoading(false);
      return;
    }
    const direct = appPathFromRankedinUrl(q);
    if (direct) {
      navigate(direct, { state: { from: { label: fromLabel, to: fromPath } } });
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      setLoading(true);
      searchPlayers(q)
        .then((h) => {
          if (cancelled) return;
          setHits(h);
          setError(null);
        })
        .catch((e) => !cancelled && setError(e))
        .finally(() => !cancelled && setLoading(false));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [term, navigate, fromLabel, fromPath]);

  return { term, setTerm, hits, error, loading };
}
