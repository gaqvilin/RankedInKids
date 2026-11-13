import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GET, POST } from '../api/errors';
import { anonymousPage, browserName, cleanReport, listErrors, recordError, scrub } from '../api/_lib/errors';
import { MemoryStore, setStore } from '../api/_lib/store';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';

const post = (body: unknown, headers: Record<string, string> = {}) =>
  POST(
    new Request('https://padeladmin-app.vercel.app/api/errors', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://padeladmin-app.vercel.app', 'user-agent': IPHONE, 'x-forwarded-for': '10.0.0.1', ...headers },
      body: JSON.stringify(body),
    }),
  );

beforeEach(() => setStore(new MemoryStore()));
afterEach(() => setStore(null));

describe('error reports carry no personal data', () => {
  it('removes e-mail addresses, Rankedin ids and long numbers', () => {
    expect(scrub('Fel för anna.berg@example.com R000385768 i match 1234567', 300)).toBe('Fel för <e-post> R… i match #');
  });
  it('keeps only the path, with ids replaced', () => {
    expect(anonymousPage('/spelare/R000385768?klass=Pojkar')).toBe('/spelare/:spelare');
    expect(anonymousPage('/tavling/75317/skriv-ut?typ=banor')).toBe('/tavling/:id/skriv-ut');
    expect(anonymousPage('/lag/12/omgang/2026-11-14')).toBe('/lag/:id/omgang/:datum');
  });
  it('names the browser coarsely', () => {
    expect(browserName(IPHONE)).toBe('iOS Safari');
    expect(browserName('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36')).toBe('Android Chrome');
  });
  it('rejects unknown kinds and empty messages', () => {
    expect(cleanReport({ kind: 'hack', message: 'x' }, null)).toBeNull();
    expect(cleanReport({ kind: 'crash', message: '   ' }, null)).toBeNull();
  });
  it('scrubs the call name too', () => {
    expect(cleanReport({ kind: 'call', message: 'Svar 502', call: 'rin Tournament/GetHeaderAsync/75317' }, null)?.call).toBe('rin Tournament/GetHeaderAsync/:id');
  });
});

describe('counting', () => {
  it('counts the same error once per occurrence and sums days', async () => {
    const r = cleanReport({ kind: 'crash', message: 'x is undefined', page: '/tavling/1', version: '0.12' }, IPHONE)!;
    const d1 = new Date('2026-11-12T10:00:00Z');
    const d2 = new Date('2026-11-13T10:00:00Z');
    await recordError(r, d1);
    await recordError(r, d2);
    await recordError(r, d2);
    await recordError({ ...r, message: 'other' }, d2);
    const list = await listErrors(7, d2);
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({ message: 'x is undefined', count: 3, days: 2, lastDay: '2026-11-13', browser: 'iOS Safari' });
  });
  it('leaves out days older than the window', async () => {
    const r = cleanReport({ kind: 'crash', message: 'old' }, null)!;
    await recordError(r, new Date('2026-11-01T10:00:00Z'));
    expect(await listErrors(7, new Date('2026-11-13T10:00:00Z'))).toHaveLength(0);
  });
});

describe('/api/errors', () => {
  it('stores a report from the app', async () => {
    const res = await post({ kind: 'call', message: 'Svar 502', call: 'submit-result', status: 502, page: '/tavling/1', version: '0.12' });
    expect(res.status).toBe(200);
    expect(await listErrors()).toMatchObject([{ kind: 'call', call: 'submit-result', status: 502, page: '/tavling/:id' }]);
  });
  it('refuses other sites', async () => {
    expect((await post({ kind: 'crash', message: 'x' }, { origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' })).status).toBe(403);
  });
  it('reading needs an owner login', async () => {
    expect((await GET(new Request('https://padeladmin-app.vercel.app/api/errors'))).status).toBe(401);
  });
});
