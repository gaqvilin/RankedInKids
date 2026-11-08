import { describe, expect, it } from 'vitest';
import { getActiveAccount, isAllowedReadPath, isSameOriginJson, readUrl } from '../api/_lib/rankedin';

describe('read allowlist', () => {
  it('allows known reads', () => {
    expect(readUrl('Tournament/GetHeaderAsync?id=1')).toBe('https://api.rankedin.com/v1/Tournament/GetHeaderAsync?id=1');
  });
  it('blocks encoded and plain traversal', () => {
    for (const p of ['player/%2e%2e/Account/X', 'player/.%2E/.%2e/x', 'player/../Account/X', 'player/..\\Account', 'player\\..\\Account', 'https://evil.com/player/']) {
      expect(isAllowedReadPath(p)).toBe(false);
    }
  });
});

describe('same-origin writes', () => {
  const req = (h: Record<string, string>) => new Request('https://padeladmin-app.vercel.app/api/login', { method: 'POST', headers: h });
  it('accepts our own JSON posts', () => {
    expect(isSameOriginJson(req({ 'content-type': 'application/json', origin: 'https://padeladmin-app.vercel.app', 'sec-fetch-site': 'same-origin' }))).toBe(true);
  });
  it('rejects forms and other sites', () => {
    expect(isSameOriginJson(req({ 'content-type': 'text/plain' }))).toBe(false);
    expect(isSameOriginJson(req({ 'content-type': 'application/json', origin: 'https://evil.example' }))).toBe(false);
    expect(isSameOriginJson(req({ 'content-type': 'application/json', 'sec-fetch-site': 'cross-site' }))).toBe(false);
  });
});

describe('acting account', () => {
  const req = (cookie: string, header?: string) =>
    new Request('https://x/api', { headers: { cookie, ...(header ? { 'x-rk-account': header } : {}) } });
  it('acts as the account the page shows, never another', () => {
    const c = 'rk_rin_1=a; rk_rin_2=b; rk_active=2';
    expect(getActiveAccount(req(c, '1'))?.playerId).toBe(1);
    expect(getActiveAccount(req(c))?.playerId).toBe(2);
    expect(getActiveAccount(req(c, '3'))).toBeNull();
  });
});
