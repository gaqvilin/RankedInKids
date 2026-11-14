// Error reporting: crashes, failed calls to our API and code errors shown to the user are sent
// to /api/errors so the owners see them (Feedback page) without anyone having to tell us.
// Never personal data: the server scrubs ids and e-mail addresses, and we only send the path.
import { anonymousPath } from './analytics';
import { t } from './i18n';
import { CURRENT_VERSION } from './releases';

export type ErrorKind = 'crash' | 'shown' | 'call';
export type ErrorSummary = {
  kind: ErrorKind;
  message: string;
  page: string;
  call: string;
  status: number;
  version: string;
  browser: string;
  count: number;
  days: number;
  lastDay: string;
};

const MAX_PER_PAGE_LOAD = 20;
const sent = new Set<string>();
let realFetch: typeof fetch = (...args) => fetch(...args);

const pagePath = () => new URL(anonymousPath(location.href)).pathname;

/** Sends one report; the same error is sent once per page load. Never throws. */
export function reportError(kind: ErrorKind, message: string, extra: { call?: string; status?: number } = {}) {
  try {
    if (!message) return;
    const body = { kind, message: message.slice(0, 300), page: pagePath(), call: extra.call ?? '', status: extra.status ?? 0, version: CURRENT_VERSION };
    const key = JSON.stringify(body);
    if (sent.has(key) || sent.size >= MAX_PER_PAGE_LOAD) return;
    sent.add(key);
    realFetch('/api/errors', { method: 'POST', credentials: 'same-origin', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(
      () => {},
    );
  } catch {
    /* reporting must never break the app */
  }
}

/** "/api/rin?p=Tournament/GetHeaderAsync?id=1" → "rin Tournament/GetHeaderAsync"; other calls by path. */
export function callName(url: string): string | null {
  const u = new URL(url, location.origin);
  if (u.origin !== location.origin || !u.pathname.startsWith('/api/') || u.pathname === '/api/errors') return null;
  const name = u.pathname.slice(5);
  if (name === 'rin') return `rin ${(u.searchParams.get('p') || '').split('?')[0]}`;
  return name;
}

/** Fails worth knowing about: our server or Rankedin broke, or the network did. Not "wrong password" (4xx). */
export const isServerFailure = (status: number) => status >= 500 || status === 0;

export function startErrorReporting() {
  if (typeof window === 'undefined') return;
  window.addEventListener('error', (e) => {
    // "Script error." comes from other sites' scripts (extensions, in-app browsers); nothing to act on.
    if (!e.message || e.message === 'Script error.') return;
    reportError('crash', e.message);
  });
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason as { message?: string } | string | undefined;
    reportError('crash', typeof r === 'string' ? r : (r?.message ?? 'Okänt fel'));
  });

  // Every call to our own /api: report server failures and network errors in one place.
  const original = window.fetch.bind(window);
  realFetch = original;
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const call = callName(url);
    try {
      const res = await original(input, init);
      if (call && isServerFailure(res.status)) reportError('call', `Svar ${res.status}`, { call, status: res.status });
      return res;
    } catch (e) {
      // Aborted requests (navigation, offline phone) are normal; only report while online.
      if (call && navigator.onLine && (e as Error)?.name !== 'AbortError') reportError('call', 'Nätverksfel', { call });
      throw e;
    }
  };
}

/** null = not allowed to read. */
export async function listErrors(): Promise<ErrorSummary[] | null> {
  const res = await fetch('/api/errors', { credentials: 'same-origin' });
  if (res.status === 401 || res.status === 403) return null;
  if (!res.ok) throw new Error(t('Kunde inte hämta felen.'));
  return ((await res.json()) as { items: ErrorSummary[] }).items;
}
