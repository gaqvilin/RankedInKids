// Thin client for our own /api functions.

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}

const cache = new Map<string, { at: number; data: unknown }>();
const CACHE_MS = 15_000;

/** GET a Rankedin read path (e.g. "Tournament/GetHeaderAsync?id=1") through /api/rin. */
export async function rin<T>(path: string, opts: { fresh?: boolean } = {}): Promise<T> {
  const hit = cache.get(path);
  if (!opts.fresh && hit && Date.now() - hit.at < CACHE_MS) return hit.data as T;
  const res = await fetch(`/api/rin?p=${encodeURIComponent(path)}`, { credentials: 'same-origin' });
  if (!res.ok) throw new ApiError(`Rankedin svarade ${res.status}`, res.status);
  const data = (await res.json()) as T;
  cache.set(path, { at: Date.now(), data });
  return data;
}

export function clearCache() {
  cache.clear();
}

export type SessionUser = { loggedIn: true; playerId: number; rankedinId: string; name: string } | { loggedIn: false };

export async function getSession(): Promise<SessionUser> {
  try {
    const res = await fetch('/api/session', { credentials: 'same-origin' });
    if (!res.ok) return { loggedIn: false };
    return (await res.json()) as SessionUser;
  } catch {
    return { loggedIn: false };
  }
}

export async function login(userName: string, password: string): Promise<SessionUser> {
  const res = await fetch('/api/login', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(
      data.error === 'invalid_credentials' ? 'Fel e-post eller lösenord.' : 'Kunde inte logga in just nu.',
      res.status,
      data.error,
    );
  }
  clearCache();
  return data as SessionUser;
}

export async function logout(): Promise<void> {
  await fetch('/api/session', { method: 'POST', credentials: 'same-origin' });
  clearCache();
}

export async function submitResult(challengeId: number, sets: [number, number][]): Promise<void> {
  const res = await fetch('/api/submit-result', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ challengeId, sets }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const messages: Record<string, string> = {
      not_logged_in: 'Du behöver logga in först.',
      not_allowed: 'Rankedin tillåter inte att du rapporterar den här matchen.',
      invalid_score: data.message || 'Ogiltigt resultat.',
      rejected: 'Rankedin tog inte emot resultatet.',
    };
    throw new ApiError(messages[data.error] || 'Något gick fel.', res.status, data.error);
  }
  clearCache();
}
