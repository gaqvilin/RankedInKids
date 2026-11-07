// Shared helpers for the Vercel functions that talk to api.rankedin.com.
// Files in api/_lib are not exposed as routes.

export const RIN_API = 'https://api.rankedin.com/v1';
/** Legacy single-account cookie (still read so earlier logins keep working). */
export const SESSION_COOKIE = 'rk_rin';
/** One cookie per Rankedin account: rk_rin_<playerId>. */
export const ACCOUNT_COOKIE_PREFIX = 'rk_rin_';
/** Which account is active: rk_active=<playerId>. */
export const ACTIVE_COOKIE = 'rk_active';
/** Lets a request pick one of the user's own accounts explicitly. */
export const ACCOUNT_HEADER = 'x-rk-account';
const THIRTY_DAYS = 60 * 60 * 24 * 30;
const COOKIE_ATTRS = `Path=/; HttpOnly; Secure; SameSite=Lax`;

/** Read paths the proxy may forward. Everything else is rejected. */
const READ_PREFIXES = [
  'player/',
  'tournament/',
  'teamleague/',
  'clubleague/',
  'search/',
  'calendar/',
  'ranking/',
  'organization/getorganizationinfoasync',
  'organization/getorganisationteamleaguesasync',
  'organization/getmembersasync',
  'rating/',
  'match/getchallengeresultasync',
  'match/getheadtoheadasync',
];

export function isAllowedReadPath(path: string): boolean {
  const p = path.replace(/^\/+/, '').toLowerCase();
  if (p.includes('..') || p.includes('://')) return false;
  return READ_PREFIXES.some((prefix) => p.startsWith(prefix));
}

function parseCookies(request: Request): Map<string, string> {
  const out = new Map<string, string>();
  for (const part of (request.headers.get('cookie') || '').split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (!name) continue;
    try {
      out.set(name, decodeURIComponent(rest.join('=')));
    } catch {
      /* ignore malformed cookie */
    }
  }
  return out;
}

export type StoredAccount = { playerId: number; cookie: string };

/** All Rankedin sessions this browser holds (playerId 0 = legacy cookie, id unknown). */
export function getAccounts(request: Request): StoredAccount[] {
  const accounts: StoredAccount[] = [];
  for (const [name, value] of parseCookies(request)) {
    if (!value) continue;
    if (name.startsWith(ACCOUNT_COOKIE_PREFIX)) {
      const playerId = Number(name.slice(ACCOUNT_COOKIE_PREFIX.length));
      if (Number.isInteger(playerId) && playerId > 0) accounts.push({ playerId, cookie: value });
    } else if (name === SESSION_COOKIE) {
      accounts.push({ playerId: 0, cookie: value });
    }
  }
  return accounts;
}

/** The account a request should act as: explicit header, then the active cookie, then any. */
export function getActiveAccount(request: Request): StoredAccount | null {
  const accounts = getAccounts(request);
  if (accounts.length === 0) return null;
  const byId = (id: number) => (id > 0 ? accounts.find((a) => a.playerId === id) : undefined);
  return (
    byId(Number(request.headers.get(ACCOUNT_HEADER))) ??
    byId(Number(parseCookies(request).get(ACTIVE_COOKIE))) ??
    accounts.find((a) => a.playerId > 0) ??
    accounts[0]
  );
}

/** Rankedin Cookie header for the account this request acts as. */
export function getSessionCookie(request: Request): string | null {
  return getActiveAccount(request)?.cookie ?? null;
}

export function accountCookieHeader(playerId: number, rinCookie: string): string {
  return `${ACCOUNT_COOKIE_PREFIX}${playerId}=${encodeURIComponent(rinCookie)}; ${COOKIE_ATTRS}; Max-Age=${THIRTY_DAYS}`;
}

export function clearAccountCookieHeader(playerId: number): string {
  return playerId > 0 ? `${ACCOUNT_COOKIE_PREFIX}${playerId}=; ${COOKIE_ATTRS}; Max-Age=0` : clearSessionCookieHeader();
}

export function activeCookieHeader(playerId: number | null): string {
  return playerId ? `${ACTIVE_COOKIE}=${playerId}; ${COOKIE_ATTRS}; Max-Age=${THIRTY_DAYS}` : `${ACTIVE_COOKIE}=; ${COOKIE_ATTRS}; Max-Age=0`;
}

export function clearSessionCookieHeader(): string {
  return `${SESSION_COOKIE}=; ${COOKIE_ATTRS}; Max-Age=0`;
}

export function rinHeaders(rinCookie: string | null, json = false): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    Origin: 'https://www.rankedin.com',
    Referer: 'https://www.rankedin.com/',
  };
  if (json) headers['Content-Type'] = 'application/json';
  if (rinCookie) headers.Cookie = rinCookie;
  return headers;
}

/** Collapse Set-Cookie headers into a "name=value; name2=value2" Cookie header. */
export function cookiesFromResponse(res: Response): string {
  const list = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  const raw = list.length > 0 ? list : (res.headers.get('set-cookie') || '').split(/,(?=\s*[^;=\s]+=)/);
  return raw
    .map((c) => c.split(';')[0].trim())
    .filter((c) => c && !c.endsWith('='))
    .join('; ');
}

export type LayoutInfo = {
  IsAuthenticated: boolean;
  CurrentPlayerId: number | null;
  RankedinId: string | null;
  FirstName: string | null;
  LastName: string | null;
};

export async function fetchLayout(rinCookie: string): Promise<LayoutInfo | null> {
  const res = await fetch(`${RIN_API}/Player/GetLayoutInfoAsync`, { headers: rinHeaders(rinCookie) });
  if (!res.ok) return null;
  return (await res.json()) as LayoutInfo;
}

export function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}, cookies: string[] = []): Response {
  const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extraHeaders });
  for (const c of cookies) headers.append('Set-Cookie', c);
  return new Response(JSON.stringify(body), { status, headers });
}

export function publicUser(layout: LayoutInfo) {
  return {
    loggedIn: true,
    playerId: layout.CurrentPlayerId,
    rankedinId: layout.RankedinId,
    name: [layout.FirstName, layout.LastName].filter(Boolean).join(' '),
  };
}
