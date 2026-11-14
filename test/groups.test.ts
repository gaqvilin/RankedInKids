import { describe, expect, it } from 'vitest';
import { GroupError, MAX_PLAYERS, cleanGroup, deleteGroup, listGroups, saveGroup, sharedGroup } from '../api/_lib/groups';
import { MemoryStore } from '../api/_lib/store';

const OWNER = 'R000385768';
const code = async (p: Promise<unknown>) => p.then(() => 'ok', (e) => (e as GroupError).code);

describe('groups', () => {
  it('cleans name and players: trimmed, upper case, no duplicates', () => {
    expect(cleanGroup({ name: '  P12   tisdag ', players: ['r000335756', 'R000335756', 'R000372820'] })).toEqual({ name: 'P12 tisdag', players: ['R000335756', 'R000372820'] });
    expect(() => cleanGroup({ name: '', players: [] })).toThrow(GroupError);
    expect(() => cleanGroup({ name: 'x', players: ['../etc'] })).toThrow(/ogiltigt/);
    expect(() => cleanGroup({ name: 'x', players: Array.from({ length: MAX_PLAYERS + 1 }, (_, i) => `R${String(100000 + i)}`) })).toThrow(/högst/);
  });

  it('creates, lists, updates and shares a group; the share shows nothing about the owner', async () => {
    const store = new MemoryStore();
    const g = await saveGroup(store, OWNER, { name: 'P12 tisdag', players: ['R000335756'] });
    expect(g.id).toMatch(/^[a-f0-9]{16}$/);
    expect(g.shareId).toMatch(/^[a-f0-9]{32}$/);
    expect(await listGroups(store, OWNER)).toHaveLength(1);
    const updated = await saveGroup(store, OWNER, { id: g.id, name: 'P12 onsdag', players: ['R000335756', 'R000372820'] });
    expect(updated).toMatchObject({ id: g.id, shareId: g.shareId, name: 'P12 onsdag' });
    expect(await sharedGroup(store, g.shareId)).toEqual({ name: 'P12 onsdag', players: ['R000335756', 'R000372820'] });
  });

  it('only the owner can change or delete a group', async () => {
    const store = new MemoryStore();
    const g = await saveGroup(store, OWNER, { name: 'A', players: [] });
    expect(await code(saveGroup(store, 'R000999999', { id: g.id, name: 'Kapad', players: [] }))).toBe('not_found');
    expect(await code(deleteGroup(store, 'R000999999', g.id))).toBe('not_found');
    expect(await listGroups(store, 'R000999999')).toEqual([]);
    expect((await listGroups(store, OWNER))[0].name).toBe('A');
  });

  it('a deleted group is gone from the list and its share link stops working', async () => {
    const store = new MemoryStore();
    const g = await saveGroup(store, OWNER, { name: 'A', players: [] });
    await deleteGroup(store, OWNER, g.id);
    expect(await listGroups(store, OWNER)).toEqual([]);
    expect(await sharedGroup(store, g.shareId)).toBeNull();
  });

  it('refuses bad share ids and owners that are not Rankedin numbers', async () => {
    const store = new MemoryStore();
    expect(await sharedGroup(store, '../../groups')).toBeNull();
    expect(await code(saveGroup(store, 'evil/../x', { name: 'A', players: [] }))).toBe('not_logged_in');
  });
});
