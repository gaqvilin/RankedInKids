import { describe, expect, it } from 'vitest';
import { anonymousPath } from '../src/lib/analytics';

describe('anonymousPath', () => {
  it('removes player numbers, ids, dates and query strings', () => {
    expect(anonymousPath('https://padeladmin-app.vercel.app/spelare/R000335756')).toBe('https://padeladmin-app.vercel.app/spelare/:spelare');
    expect(anonymousPath('https://a.app/lag/3422248/omgang/2026-11-28')).toBe('https://a.app/lag/:id/omgang/:datum');
    expect(anonymousPath('https://a.app/tavling/75555?spelare=2817388&klass=P12')).toBe('https://a.app/tavling/:id');
    expect(anonymousPath('https://a.app/')).toBe('https://a.app/');
  });
});
