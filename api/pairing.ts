// Organiser pairing for a tournament class (see _lib/pairing.ts for the Rankedin calls).
// GET  /api/pairing?tournamentId&classId          -> { entries } (admin only)
// POST /api/pairing { action: 'pair', tournamentId, classId, aId, bId }
// POST /api/pairing { action: 'unpair', tournamentId, classId, entryId }
import { RIN_API, getSessionCookie, isSameOriginJson, json, rinHeaders } from './_lib/rankedin.js';
import { PairingError, loadEntries, pairPlayers, unpairPlayers, type Call } from './_lib/pairing.js';

const callWith =
  (session: string): Call =>
  async (method, path, body) => {
    const res = await fetch(`${RIN_API}/${path}`, {
      method,
      headers: rinHeaders(session, method === 'POST'),
      body: method === 'POST' ? JSON.stringify(body ?? {}) : undefined,
    });
    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    return { ok: res.ok, status: res.status, data };
  };

const ids = (...v: unknown[]) => v.map(Number).every((n) => Number.isInteger(n) && n > 0);

function fail(e: unknown): Response {
  if (e instanceof PairingError) return json({ error: e.code, message: e.message }, e.code === 'not_admin' ? 403 : 409);
  return json({ error: 'upstream', message: 'Kunde inte nå Rankedin just nu.' }, 502);
}

export async function GET(request: Request): Promise<Response> {
  const session = getSessionCookie(request);
  if (!session) return json({ error: 'not_logged_in' }, 401);
  const u = new URL(request.url);
  const t = Number(u.searchParams.get('tournamentId'));
  const c = Number(u.searchParams.get('classId'));
  if (!ids(t, c)) return json({ error: 'bad_request' }, 400);
  try {
    return json({ entries: await loadEntries(callWith(session), t, c) });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(request: Request): Promise<Response> {
  if (!isSameOriginJson(request)) return json({ error: 'forbidden' }, 403);
  const session = getSessionCookie(request);
  if (!session) return json({ error: 'not_logged_in' }, 401);
  let b: Record<string, unknown>;
  try {
    b = await request.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  const t = Number(b.tournamentId);
  const c = Number(b.classId);
  const call = callWith(session);
  try {
    if (b.action === 'pair' && ids(t, c, b.aId, b.bId)) return json({ ok: true, entries: await pairPlayers(call, t, c, Number(b.aId), Number(b.bId)) });
    if (b.action === 'unpair' && ids(t, c, b.entryId)) return json({ ok: true, entries: await unpairPlayers(call, t, c, Number(b.entryId)) });
    return json({ error: 'bad_request' }, 400);
  } catch (e) {
    return fail(e);
  }
}
