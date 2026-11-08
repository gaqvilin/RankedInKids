import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAccounts, getActiveAccount } from '../api/_lib/rankedin';
import { GET, POST } from '../api/session';

const req = (cookie: string, init: RequestInit = {}, header?: string) =>
  new Request('https://app/api/session', { ...init, headers: { cookie, ...(header ? { 'x-rk-account': header } : {}), 'content-type': 'application/json' } });

const two = 'rk_rin_11=rin-auth%3Dparent; rk_rin_22=rin-auth%3Dkid; rk_active=22';

describe('account cookies', () => {
  it('lists every account and picks the active one', () => {
    expect(getAccounts(req(two)).map((a) => a.playerId)).toEqual([11, 22]);
    expect(getActiveAccount(req(two))?.cookie).toBe('rin-auth=kid');
  });
  it('lets a request choose another of its own accounts', () => {
    expect(getActiveAccount(req(two, {}, '11'))?.cookie).toBe('rin-auth=parent');
    expect(getActiveAccount(req(two, {}, '99'))).toBeNull(); // never act as an account the page doesn't show
  });
  it('falls back when the active cookie is missing', () => {
    expect(getActiveAccount(req('rk_rin_11=a'))?.playerId).toBe(11);
    expect(getActiveAccount(req(''))).toBeNull();
  });
});

afterEach(() => vi.unstubAllGlobals());

describe('/api/session', () => {
  it('returns all logged-in accounts with the active one first-class', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        const kid = String((init?.headers as Record<string, string>).Cookie).includes('kid');
        return Response.json({ IsAuthenticated: true, CurrentPlayerId: kid ? 22 : 11, RankedinId: kid ? 'R2' : 'R1', FirstName: kid ? 'Aron' : 'Gustav', LastName: 'A' });
      }),
    );
    const data = await (await GET(req(two))).json();
    expect(data.playerId).toBe(22);
    expect(data.accounts.map((a: { name: string }) => a.name)).toEqual(['Aron A', 'Gustav A']);
  });
  it('switches only to an account the browser holds', async () => {
    const ok = await POST(req(two, { method: 'POST', body: JSON.stringify({ action: 'switch', playerId: 11 }) }));
    expect(ok.headers.get('set-cookie')).toContain('rk_active=11');
    const bad = await POST(req(two, { method: 'POST', body: JSON.stringify({ action: 'switch', playerId: 99 }) }));
    expect(bad.status).toBe(400);
  });
  it('logging out the active account makes the other one active', async () => {
    const res = await POST(req(two, { method: 'POST', body: JSON.stringify({ action: 'logout', playerId: 22 }) }));
    const cookies = res.headers.getSetCookie();
    expect(cookies.some((c) => c.startsWith('rk_rin_22=;'))).toBe(true);
    expect(cookies.some((c) => c.startsWith('rk_active=11'))).toBe(true);
  });
});
