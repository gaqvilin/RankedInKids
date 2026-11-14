// A trainer's groups of players. Stored in the doc store, owned by a Rankedin account:
//   groups/<ownerRid>/<groupId>  -> the group
//   groupshare/<shareId>         -> { owner, id }: who a share link points to (read-only access, unguessable id)
// Only the group's name and the players' Rankedin numbers are stored – everything else is read from Rankedin.
import { randomBytes } from 'node:crypto';
import type { DocStore } from './store.js';

export type Group = { id: string; name: string; players: string[]; shareId: string; updatedAt: string };
export const MAX_PLAYERS = 40;
export const MAX_GROUPS = 10;

export class GroupError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

const RID = /^R\d{6,12}$/;
const ID = /^[a-z0-9]{8,40}$/;
const token = (bytes: number) => randomBytes(bytes).toString('hex');
const key = (owner: string, id: string) => `groups/${owner}/${id}`;

/** Trims and checks what the client sent; throws GroupError with a message for the user. */
export function cleanGroup(input: { name?: unknown; players?: unknown }): { name: string; players: string[] } {
  const name = String(input.name ?? '').trim().replace(/\s+/g, ' ').slice(0, 40);
  if (!name) throw new GroupError('bad_name', 'Ge gruppen ett namn.');
  if (!Array.isArray(input.players)) throw new GroupError('bad_players', 'Gruppen behöver spelare.');
  const players = [...new Set(input.players.map((p) => String(p).trim().toUpperCase()))];
  if (players.some((p) => !RID.test(p))) throw new GroupError('bad_players', 'En spelare i gruppen har ett ogiltigt Rankedin-nummer.');
  if (players.length > MAX_PLAYERS) throw new GroupError('too_many', `En grupp kan ha högst ${MAX_PLAYERS} spelare.`);
  return { name, players };
}

export async function listGroups(store: DocStore, owner: string): Promise<Group[]> {
  if (!RID.test(owner)) return [];
  const docs = await store.listJson<Group>(`groups/${owner}/`);
  return docs.map((d) => d.value).filter((g) => g && !('deleted' in g)).sort((a, b) => a.name.localeCompare(b.name, 'sv'));
}

/** Create (no id) or update a group owned by `owner`. */
export async function saveGroup(store: DocStore, owner: string, input: { id?: unknown; name?: unknown; players?: unknown }): Promise<Group> {
  if (!RID.test(owner)) throw new GroupError('not_logged_in', 'Logga in med Rankedin för att spara en grupp.');
  const clean = cleanGroup(input);
  const now = new Date().toISOString();
  if (input.id !== undefined && input.id !== null && input.id !== '') {
    const id = String(input.id);
    const existing = ID.test(id) ? await store.getJson<Group>(key(owner, id)) : null;
    if (!existing || 'deleted' in existing) throw new GroupError('not_found', 'Gruppen finns inte.');
    const next: Group = { ...existing, ...clean, updatedAt: now };
    await store.putJson(key(owner, id), next);
    return next;
  }
  if ((await listGroups(store, owner)).length >= MAX_GROUPS) throw new GroupError('too_many_groups', `Du kan ha högst ${MAX_GROUPS} grupper.`);
  const group: Group = { id: token(8), ...clean, shareId: token(16), updatedAt: now };
  await store.putJson(key(owner, group.id), group);
  await store.putJson(`groupshare/${group.shareId}`, { owner, id: group.id });
  return group;
}

/** The store has no delete: a deleted group is overwritten with a marker, and its share link stops working. */
export async function deleteGroup(store: DocStore, owner: string, id: string): Promise<void> {
  const existing = RID.test(owner) && ID.test(id) ? await store.getJson<Group>(key(owner, id)) : null;
  if (!existing || 'deleted' in existing) throw new GroupError('not_found', 'Gruppen finns inte.');
  await store.putJson(key(owner, id), { deleted: true, updatedAt: new Date().toISOString() });
  await store.putJson(`groupshare/${existing.shareId}`, { deleted: true });
}

/** What a share link shows: the name and the players, nothing about the owner. */
export async function sharedGroup(store: DocStore, shareId: string): Promise<{ name: string; players: string[] } | null> {
  if (!/^[a-f0-9]{32}$/.test(shareId)) return null;
  const ref = await store.getJson<{ owner?: string; id?: string }>(`groupshare/${shareId}`);
  if (!ref?.owner || !ref.id) return null;
  const g = await store.getJson<Group>(key(ref.owner, ref.id));
  return g && !('deleted' in g) ? { name: g.name, players: g.players } : null;
}
