// Error reports from the app, counted per day, without personal data.
// Each distinct error (kind, message, page, call, status, version, browser) is one row per day:
//   errors/<day>/<hash>    the description, written once
//   errors-n/<day>/<hash>  an atomic counter
// Player numbers, long ids and e-mail addresses are removed before anything is stored.
import { hashId } from './ratelimit.js';
import { getStore } from './store.js';

export type ErrorKind = 'crash' | 'shown' | 'call';
export const ERROR_KINDS: ErrorKind[] = ['crash', 'shown', 'call'];

export type ErrorReport = {
  kind: ErrorKind;
  message: string;
  page: string;
  call: string;
  status: number;
  version: string;
  browser: string;
};

export type ErrorSummary = ErrorReport & { count: number; days: number; lastDay: string };

const KEEP_SEC = 40 * 86400;

/** Removes what could point at a person: e-mail addresses, Rankedin ids (R000123), numbers of 4+ digits. */
export function scrub(text: unknown, max: number): string {
  if (typeof text !== 'string') return '';
  return text
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, '<e-post>')
    .replace(/\bR\d{3,}\b/gi, 'R…')
    .replace(/\d{4,}/g, '#')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/** Path only, ids replaced: /tavling/123/ledning → /tavling/:id/ledning. */
export function anonymousPage(page: unknown): string {
  if (typeof page !== 'string') return '';
  const path = page.split(/[?#]/)[0];
  return path
    .replace(/\/R\d+/gi, '/:spelare')
    .replace(/\/\d{4}-\d{2}-\d{2}/g, '/:datum')
    .replace(/\/\d+/g, '/:id')
    .slice(0, 120);
}

/** "iOS Safari", "Android Chrome", "Windows Edge" … – enough to reproduce, nothing more. */
export function browserName(userAgent: string | null): string {
  const ua = userAgent || '';
  const os = /iPhone|iPad|iPod/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : 'Annat';
  const app = /Edg\//.test(ua)
    ? 'Edge'
    : /CriOS|Chrome\//.test(ua)
      ? 'Chrome'
      : /FxiOS|Firefox\//.test(ua)
        ? 'Firefox'
        : /FBAN|FBAV|Instagram/.test(ua)
          ? 'Facebook/Instagram'
          : /Safari\//.test(ua)
            ? 'Safari'
            : 'annan';
  return `${os} ${app}`;
}

export function cleanReport(body: Record<string, unknown>, userAgent: string | null): ErrorReport | null {
  const kind = ERROR_KINDS.includes(body.kind as ErrorKind) ? (body.kind as ErrorKind) : null;
  const message = scrub(body.message, 300);
  if (!kind || !message) return null;
  const status = Number(body.status);
  return {
    kind,
    message,
    page: anonymousPage(body.page),
    call: scrub(anonymousPage(body.call), 120),
    status: Number.isInteger(status) && status >= 0 && status < 1000 ? status : 0,
    version: scrub(body.version, 20),
    browser: browserName(userAgent),
  };
}

const day = (d = new Date()) => d.toISOString().slice(0, 10);

export async function recordError(report: ErrorReport, now = new Date()): Promise<void> {
  const store = getStore();
  const d = day(now);
  const h = (await hashId(JSON.stringify(report))).slice(0, 24);
  const n = await store.hit(`errors-n/${d}/${h}`, KEEP_SEC);
  if (n === 1) await store.putJson(`errors/${d}/${h}`, report);
}

/** The last `days` days, the same error on several days summed, most frequent first. */
export async function listErrors(days = 7, now = new Date()): Promise<ErrorSummary[]> {
  const store = getStore();
  const from = day(new Date(now.getTime() - (days - 1) * 86400_000));
  const [docs, counts] = await Promise.all([store.listJson<ErrorReport>('errors/'), store.listJson<{ n: number }>('errors-n/')]);
  const countOf = new Map(counts.map((c) => [c.key.replace(/^errors-n\//, ''), Number(c.value?.n) || 0]));
  const byHash = new Map<string, ErrorSummary>();
  for (const { key, value } of docs) {
    const [, d, h] = key.split('/');
    if (!d || !h || d < from) continue;
    const n = countOf.get(`${d}/${h}`) ?? 1;
    const prev = byHash.get(h);
    if (prev) {
      prev.count += n;
      prev.days += 1;
      if (d > prev.lastDay) prev.lastDay = d;
    } else {
      byHash.set(h, { ...value, count: n, days: 1, lastDay: d });
    }
  }
  return [...byHash.values()].sort((a, b) => b.count - a.count || b.lastDay.localeCompare(a.lastDay)).slice(0, 100);
}
