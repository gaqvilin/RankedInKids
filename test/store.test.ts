import { describe, expect, it } from 'vitest';
import { MemoryStore, SqlStore, type SqlQuery } from '../api/_lib/store';

/** A tiny fake of the docs table that understands the three statements SqlStore uses. */
function fakeSql(): { query: SqlQuery; calls: { text: string; params: unknown[] }[] } {
  const table = new Map<string, unknown>();
  const calls: { text: string; params: unknown[] }[] = [];
  const query: SqlQuery = async (text, params) => {
    calls.push({ text, params });
    if (text.startsWith('SELECT value')) return table.has(params[0] as string) ? [{ value: table.get(params[0] as string) }] : [];
    if (text.startsWith('INSERT')) {
      table.set(params[0] as string, JSON.parse(params[1] as string));
      return [];
    }
    if (text.startsWith('SELECT key')) {
      const prefix = String(params[0]).slice(0, -1);
      return [...table.entries()].filter(([k]) => k.startsWith(prefix)).map(([key, value]) => ({ key, value }));
    }
    throw new Error('unexpected sql');
  };
  return { query, calls };
}

for (const [name, make] of [
  ['MemoryStore', () => new MemoryStore()],
  ['SqlStore', () => new SqlStore(fakeSql().query)],
] as const) {
  describe(name, () => {
    it('stores, overwrites and lists by prefix', async () => {
      const s = make();
      await s.putJson('availability/5/2026-12-12/10', { status: 'yes' });
      await s.putJson('availability/5/2026-12-12/10', { status: 'no' });
      await s.putJson('availability/5/2026-12-12/11', { status: 'maybe' });
      await s.putJson('availability/6/2026-12-12/10', { status: 'yes' });
      expect(await s.getJson('availability/5/2026-12-12/10')).toEqual({ status: 'no' });
      expect(await s.getJson('nope')).toBeNull();
      const listed = await s.listJson<{ status: string }>('availability/5/2026-12-12/');
      expect(listed.map((d) => d.value.status).sort()).toEqual(['maybe', 'no']);
    });
    it('rejects unsafe keys', async () => {
      await expect(make().putJson("x'; drop table docs;--", {})).rejects.toThrow();
      await expect(make().putJson('../etc', {})).rejects.toThrow();
    });
  });
}

describe('SqlStore', () => {
  it('uses parameters, never string-built SQL', async () => {
    const f = fakeSql();
    const s = new SqlStore(f.query);
    await s.putJson('a/b', { x: 1 });
    await s.listJson('a/');
    expect(f.calls.every((c) => !c.text.includes('a/'))).toBe(true);
  });
});
