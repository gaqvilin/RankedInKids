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
/** Identical requests in flight share one fetch. */
const pending = new Map<string, Promise<unknown>>();

/**
 * The account this page shows. Sent with every logged-in call so the server
 * acts as that account, even if another tab switched account meanwhile.
 */
let activeAccountId = 0;
/** Bumped on every account change; answers from an older generation are dropped. */
let generation = 0;
export function setActiveAccount(playerId: number) {
  if (playerId === activeAccountId) return;
  activeAccountId = playerId;
  generation++;
  cache.clear();
  pending.clear();
}
export const accountHeaders = (): Record<string, string> => (activeAccountId ? { 'x-rk-account': String(activeAccountId) } : {});

/** At most this many Rankedin requests at once; Rankedin rate limits bursts. */
const MAX_PARALLEL = 6;
let running = 0;
const waiting: (() => void)[] = [];
async function slot<T>(fn: () => Promise<T>): Promise<T> {
  if (running >= MAX_PARALLEL) await new Promise<void>((r) => waiting.push(r));
  running++;
  try {
    return await fn();
  } finally {
    running--;
    waiting.shift()?.();
  }
}

/** Number of Rankedin requests in flight; the shell shows a thin progress bar while > 0. */
let inFlight = 0;
const listeners = new Set<(n: number) => void>();
export function onLoadingChange(fn: (n: number) => void): () => void {
  listeners.add(fn);
  fn(inFlight);
  return () => listeners.delete(fn);
}
function setInFlight(delta: number) {
  inFlight = Math.max(0, inFlight + delta);
  listeners.forEach((l) => l(inFlight));
}
const CACHE_MS = 30_000;

/**
 * GET a Rankedin read path (e.g. "Tournament/GetHeaderAsync?id=1") through /api/rin.
 * Public by default: no login is sent, so answers are shared and cached at the edge.
 * Pass auth: true only where the answer depends on who is logged in
 * (enter-result buttons, captain rights, admin lists).
 */
export async function rin<T>(path: string, opts: { fresh?: boolean; auth?: boolean } = {}): Promise<T> {
  const key = opts.auth ? `auth:${activeAccountId}:${path}` : path;
  const hit = cache.get(key);
  if (!opts.fresh && hit && Date.now() - hit.at < CACHE_MS) return hit.data as T;
  const shared = pending.get(key);
  if (shared) return shared as Promise<T>;
  const gen = generation;
  const request = slot(async () => {
    setInFlight(1);
    try {
      const res = await fetch(`/api/rin?p=${encodeURIComponent(path)}${opts.auth ? '' : '&anon=1'}`, {
        credentials: 'same-origin',
        headers: opts.auth ? accountHeaders() : {},
      });
      if (!res.ok) throw new ApiError(`Rankedin svarade ${res.status}`, res.status);
      return (await res.json()) as T;
    } finally {
      setInFlight(-1);
    }
  });
  pending.set(key, request);
  try {
    const data = await request;
    if (gen === generation) cache.set(key, { at: Date.now(), data });
    return data;
  } finally {
    if (pending.get(key) === request) pending.delete(key);
  }
}

export function clearCache() {
  generation++;
  cache.clear();
  pending.clear();
}

export type Account = { playerId: number; rankedinId: string; name: string };

/** The active account (if any) plus every Rankedin account logged in on this device. */
export type SessionUser =
  | ({ loggedIn: true; accounts: Account[] } & Account)
  | { loggedIn: false; accounts: Account[] };

const LOGGED_OUT: SessionUser = { loggedIn: false, accounts: [] };

/** null = Rankedin couldn't answer right now; keep what we had. */
export async function getSession(): Promise<SessionUser | null> {
  try {
    const res = await fetch('/api/session', { credentials: 'same-origin' });
    if (res.status === 503 || res.status >= 500) return null;
    if (!res.ok) return LOGGED_OUT;
    const data = (await res.json()) as SessionUser;
    return { ...data, accounts: data.accounts ?? [] } as SessionUser;
  } catch {
    return null;
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
      data.error === 'invalid_credentials' ? 'Fel e-post eller lösenord.' : data.error === 'rate_limited' ? data.message : 'Kunde inte logga in just nu.',
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
    headers: { 'Content-Type': 'application/json', ...accountHeaders() },
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

export const accountId = () => activeAccountId;

/**
 * Sends a result to Rankedin; `null` clears the match's result (Rankedin's "Reset result").
 * opts.expected (sets the phone saw, [] = unplayed) makes the server refuse to overwrite a different result (409 conflict).
 * opts.account sends as that account (results queued offline go out as the account that entered them).
 */
export async function submitResult(
  challengeId: number,
  sets: [number, number][] | null,
  opts: { expected?: [number, number][]; account?: number } = {},
): Promise<void> {
  const account = opts.account ?? activeAccountId;
  const res = await fetch('/api/submit-result', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(account ? { 'x-rk-account': String(account) } : {}) },
    body: JSON.stringify({ challengeId, ...(sets ? { sets } : { reset: true }), ...(opts.expected ? { expected: opts.expected } : {}) }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const messages: Record<string, string> = {
      not_logged_in: 'Du behöver logga in först.',
      not_allowed: 'Rankedin tillåter inte att du rapporterar den här matchen.',
      invalid_score: data.message || 'Ogiltigt resultat.',
      rejected: 'Rankedin tog inte emot resultatet.',
      conflict: 'Rankedin har redan ett annat resultat för matchen.',
    };
    const err = new ApiError(messages[data.error] || 'Något gick fel.', res.status, data.error);
    (err as ApiError & { current?: unknown }).current = data.current;
    throw err;
  }
  clearCache();
}
