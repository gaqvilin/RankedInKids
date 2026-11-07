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

export type Account = { playerId: number; rankedinId: string; name: string };

/** The active account (if any) plus every Rankedin account logged in on this device. */
export type SessionUser =
  | ({ loggedIn: true; accounts: Account[] } & Account)
  | { loggedIn: false; accounts: Account[] };

const LOGGED_OUT: SessionUser = { loggedIn: false, accounts: [] };

export async function getSession(): Promise<SessionUser> {
  try {
    const res = await fetch('/api/session', { credentials: 'same-origin' });
    if (!res.ok) return LOGGED_OUT;
    const data = (await res.json()) as SessionUser;
    return { ...data, accounts: data.accounts ?? [] } as SessionUser;
  } catch {
    return LOGGED_OUT;
  }
}

/** Logs in one more account (others stay logged in) and makes it active. */
export async function login(userName: string, password: string): Promise<void> {
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
}

async function sessionAction(body: { action: string; playerId?: number }): Promise<void> {
  const res = await fetch('/api/session', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new ApiError('Kunde inte byta konto.', res.status);
  clearCache();
}

export const switchAccount = (playerId: number) => sessionAction({ action: 'switch', playerId });
export const logout = (playerId?: number) => sessionAction({ action: 'logout', playerId });
export const logoutAll = () => sessionAction({ action: 'logout-all' });

export async function saveLineup(
  teamMatchId: number,
  side: 'first' | 'second',
  lineups: { challengeId: number; playerIds: number[] }[],
): Promise<void> {
  const res = await fetch('/api/lineup', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ teamMatchId, side, lineups }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const messages: Record<string, string> = {
      not_logged_in: 'Du behöver logga in först.',
      not_allowed: 'Du kan inte sätta uppställning för det här laget (bara lagkapten).',
      invalid_lineup: data.message || 'Uppställningen är inte giltig.',
      rejected: 'Rankedin tog inte emot uppställningen.',
    };
    throw new ApiError(messages[data.error] || 'Något gick fel.', res.status, data.error);
  }
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
