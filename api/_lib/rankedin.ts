// Shared helpers for the Vercel functions that talk to api.rankedin.com.
// Files in api/_lib are not exposed as routes.

export const RIN_API = 'https://api.rankedin.com/v1';
export const SESSION_COOKIE = 'rk_rin';
const THIRTY_DAYS = 60 * 60 * 24 * 30;

/** Read paths the proxy may forward. Everything else is rejected. */
const READ_PREFIXES = [
  'player/',
  'tournament/',
  'teamleague/',
  'clubleague/',
  'search/',
  'calendar/',
  'ranking/',
  'rating/',
  'match/getchallengeresultasync',
  'match/getheadtoheadasync',
];

export function isAllowedReadPath(path: string): boolean {
  const p = path.replace(/^\/+/, '').toLowerCase();
  if (p.includes('..') || p.includes('://')) return false;
  return READ_PREFIXES.some((prefix) => p.startsWith(prefix));
}

export function getSessionCookie(request: Request): string | null {
  const header = request.headers.get('cookie') || '';
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === SESSION_COOKIE) {
      const value = rest.join('=');
      try {
        return decodeURIComponent(value) || null;
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function sessionCookieHeader(rinCookie: string): string {
  return `${SESSION_COOKIE}=${encodeURIComponent(rinCookie)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${THIRTY_DAYS}`;
}

export function clearSessionCookieHeader(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
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

export function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extraHeaders },
  });
}

export function publicUser(layout: LayoutInfo) {
  return {
    loggedIn: true,
    playerId: layout.CurrentPlayerId,
    rankedinId: layout.RankedinId,
    name: [layout.FirstName, layout.LastName].filter(Boolean).join(' '),
  };
}
