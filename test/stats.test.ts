import { afterEach, describe, expect, it } from 'vitest';
import { countAccount } from '../api/_lib/stats';
import { MemoryStore, setStore } from '../api/_lib/store';

afterEach(() => setStore(null));

describe('usage stats', () => {
  it('counts each account once per day as active, every login as a login, without storing ids', async () => {
    const store = new MemoryStore();
    setStore(store);
    await countAccount('active', 2817388);
    await countAccount('active', 2817388);
    await countAccount('active', 3565181);
    await countAccount('login', 2817388);
    await countAccount('login', 2817388);
    const d = new Date().toISOString().slice(0, 10);
    const active = await store.listJson<{ n: number }>(`stats/active/${d}/`);
    const logins = await store.listJson<{ n: number }>(`stats/login/${d}/`);
    expect(active).toHaveLength(2);
    expect(logins).toHaveLength(1);
    expect(logins[0].value.n).toBe(2);
    expect(JSON.stringify([...active, ...logins])).not.toContain('2817388');
  });
});
