import { describe, expect, it } from 'vitest';
import { cookiesFromResponse, isAllowedReadPath } from '../api/_lib/rankedin';
import { parseRinDate } from '../src/lib/rankedin';

describe('isAllowedReadPath', () => {
  it('allows read controllers', () => {
    expect(isAllowedReadPath('Tournament/GetHeaderAsync?id=1')).toBe(true);
    expect(isAllowedReadPath('player/GetPlayerMatchesAsync?playerid=1')).toBe(true);
    expect(isAllowedReadPath('Match/GetChallengeResultAsync?challengeId=1')).toBe(true);
  });
  it('blocks everything else', () => {
    expect(isAllowedReadPath('Account/LogInAsync')).toBe(false);
    expect(isAllowedReadPath('Admin/Anything')).toBe(false);
    expect(isAllowedReadPath('Match/SubmitResultAsync')).toBe(false);
    expect(isAllowedReadPath('player/../Admin/x')).toBe(false);
    expect(isAllowedReadPath('https://evil.example/x')).toBe(false);
  });
});

describe('cookiesFromResponse', () => {
  it('joins Set-Cookie values', () => {
    const h = new Headers();
    h.append('set-cookie', 'rin-auth=abc; path=/; secure; httponly');
    h.append('set-cookie', 'other=1; path=/');
    expect(cookiesFromResponse(new Response(null, { headers: h }))).toBe('rin-auth=abc; other=1');
  });
});

describe('parseRinDate', () => {
  it('parses dd/MM/yyyy HH:mm', () => {
    expect(parseRinDate('07/11/2026 14:30')).toBe('2026-11-07T14:30:00');
    expect(parseRinDate('07/11/2026 00:00')).toBe('2026-11-07T00:00:00');
    expect(parseRinDate(null)).toBeNull();
  });
});
