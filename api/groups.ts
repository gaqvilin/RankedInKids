// Groups of players (for trainers).
// GET  /api/groups                 -> the active account's groups
// GET  /api/groups?share=<id>      -> one group by its share link (no login)
// POST /api/groups { action: 'save', id?, name, players }  -> create or update
// POST /api/groups { action: 'delete', id }
import { getActiveAccount, isSameOriginJson, json } from './_lib/rankedin.js';
import { verifiedAccounts } from './_lib/identity.js';
import { GroupError, deleteGroup, listGroups, saveGroup, sharedGroup } from './_lib/groups.js';
import { getStore } from './_lib/store.js';
import { clientIp, memoryLimit, tooMany } from './_lib/ratelimit.js';

/** The Rankedin number of the account this request acts as, verified with Rankedin. */
async function owner(request: Request): Promise<string | null> {
  const active = getActiveAccount(request);
  if (!active) return null;
  const accounts = await verifiedAccounts(request);
  return (accounts.find((a) => a.playerId === active.playerId) ?? null)?.rankedinId ?? null;
}

function fail(e: unknown): Response {
  if (e instanceof GroupError) return json({ error: e.code, message: e.message }, e.code === 'not_logged_in' ? 401 : e.code === 'not_found' ? 404 : 400);
  return json({ error: 'server', message: 'Kunde inte spara gruppen just nu.' }, 500);
}

export async function GET(request: Request): Promise<Response> {
  const share = new URL(request.url).searchParams.get('share');
  if (share !== null) {
    if (!memoryLimit('groupshare', clientIp(request), 120, 60_000)) return tooMany(60);
    const g = await sharedGroup(getStore(), share);
    return g ? json(g) : json({ error: 'not_found', message: 'Gruppen finns inte längre.' }, 404);
  }
  const rid = await owner(request);
  if (!rid) return json({ error: 'not_logged_in' }, 401);
  return json({ groups: await listGroups(getStore(), rid) });
}

export async function POST(request: Request): Promise<Response> {
  if (!isSameOriginJson(request)) return json({ error: 'forbidden' }, 403);
  if (!memoryLimit('write', clientIp(request), 60, 60_000)) return tooMany(60);
  let b: Record<string, unknown>;
  try {
    b = await request.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  const rid = await owner(request);
  if (!rid) return json({ error: 'not_logged_in', message: 'Logga in med Rankedin för att spara en grupp.' }, 401);
  try {
    if (b.action === 'save') return json({ group: await saveGroup(getStore(), rid, b) });
    if (b.action === 'delete') {
      await deleteGroup(getStore(), rid, String(b.id ?? ''));
      return json({ ok: true });
    }
    return json({ error: 'bad_request' }, 400);
  } catch (e) {
    return fail(e);
  }
}
