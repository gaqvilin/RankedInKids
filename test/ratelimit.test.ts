import { afterEach, describe, expect, it } from 'vitest';
import { hashId, memoryLimit, storeLimit } from '../api/_lib/ratelimit';
import { MemoryStore, setStore } from '../api/_lib/store';

afterEach(() => setStore(null));

describe('rate limits', () => {
  it('memory window allows up to the limit, then blocks until reset', () => {
    const t = 1_000_000;
    for (let i = 0; i < 3; i++) expect(memoryLimit('t1', 'ip', 3, 1000, t)).toBe(true);
    expect(memoryLimit('t1', 'ip', 3, 1000, t + 10)).toBe(false);
    expect(memoryLimit('t1', 'ip', 3, 1000, t + 2000)).toBe(true);
    expect(memoryLimit('t1', 'other', 3, 1000, t + 10)).toBe(true);
  });
  it('store window counts across calls and keys by hashed id', async () => {
    setStore(new MemoryStore());
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await storeLimit('t2', 'user@example.com', 3, 60));
    expect(results).toEqual([true, true, true, false]);
    const h = await hashId('user@example.com');
    expect(h).toMatch(/^[0-9a-f]{20}$/);
    expect(h).not.toContain('example');
  });
});
