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
  return readUrl(path) != null;
}

/**
 * The Rankedin URL for an allowed read path, or null. Checked after the URL is
 * normalised, so encoded tricks like "%2e%2e" cannot leave the allowlist.
 */
export function readUrl(path: string): string | null {
  const p = path.replace(/^\/+/, '');
  // The path part may only hold plain characters (no %-encoding, dots or backslashes,
  // so nothing can climb out of /v1). The query string is free: it can't change the path.
  const [pathPart] = p.split('?');
  if (!/^[A-Za-z0-9/_-]+$/.test(pathPart) || p.includes('#')) return null;
  let url: URL;
  try {
    url = new URL(`${RIN_API}/${p}`);
  } catch {
    return null;
  }
  if (url.origin !== new URL(RIN_API).origin) return null;
  const rest = url.pathname.toLowerCase();
  if (!rest.startsWith('/v1/')) return null;
  const tail = rest.slice(4);
  return READ_PREFIXES.some((prefix) => tail.startsWith(prefix)) ? url.toString() : null;
}

/**
 * Writes must come from our own pages: JSON body and a same-origin request.
 * Stops other sites from posting forms (e.g. logging the device into another account).
 */
export function isSameOriginJson(request: Request): boolean {
  if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) return false;
  const site = request.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') return false;
  const origin = request.headers.get('origin');
  if (!origin) return true;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }
  // Behind proxies request.url may not carry the public host; accept the forwarded one too.
  const hosts = [new URL(request.url).host, request.headers.get('x-forwarded-host'), request.headers.get('host')].filter(Boolean);
  return hosts.includes(originHost);
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

/**
 * The account a request should act as: the account the page says it shows
 * (header), else the active cookie, else any. A header naming an account this
 * device no longer holds gives null – never act as someone else than the page shows.
 */
export function getActiveAccount(request: Request): StoredAccount | null {
  const accounts = getAccounts(request);
  if (accounts.length === 0) return null;
  const byId = (id: number) => (id > 0 ? accounts.find((a) => a.playerId === id) : undefined);
  const wanted = Number(request.headers.get(ACCOUNT_HEADER));
  if (wanted > 0) return byId(wanted) ?? null;
  return (
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

export class UpstreamError extends Error {}

/**
 * Who a Rankedin session belongs to. null = not logged in (session expired).
 * Throws UpstreamError when Rankedin can't answer right now (rate limit, 5xx,
 * network) – then the session must be kept, not thrown away.
 */
export async function fetchLayout(rinCookie: string): Promise<LayoutInfo | null> {
  let res: Response;
  try {
    res = await fetch(`${RIN_API}/Player/GetLayoutInfoAsync`, { headers: rinHeaders(rinCookie) });
  } catch {
    throw new UpstreamError('unreachable');
  }
  if (res.status === 401 || res.status === 403) return null;
  if (!res.ok) throw new UpstreamError(String(res.status));
  const layout = (await res.json().catch(() => null)) as LayoutInfo | null;
  if (!layout) throw new UpstreamError('bad_json');
  return layout.IsAuthenticated ? layout : null;
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

/** Data that rarely changes (profiles, teams, leagues, clubs) can be cached longer. */
const STABLE_PATHS = [
  'player/playerprofileinfoasync',
  'player/participatedeventsasync',
  'teamleague/getteamleagueteamdetailsasync',
  'teamleague/getteamleagueteamhomepageasync',
  'teamleague/getheaderasync',
  'teamleague/getinfoasync',
  'teamleague/getpoolsinfoasync',
  'tournament/getheaderasync',
  'tournament/getclassesanddrawnamesasync',
  'organization/',
  'search/',
];

/** Cache-Control for an anonymous (shared) response. */
export function publicCacheControl(path: string): string {
  const p = path.replace(/^\/+/, '').toLowerCase();
  const stable = STABLE_PATHS.some((s) => p.startsWith(s));
  return stable
    ? 'public, max-age=60, s-maxage=600, stale-while-revalidate=3600'
    : 'public, max-age=0, s-maxage=30, stale-while-revalidate=300';
}
