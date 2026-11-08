// Organiser: draw, courts, times, schedule and publish for a tournament.
// GET  /api/draws?tournamentId              -> status per class and for the tournament
// POST /api/draws { action, tournamentId, classId?, ... } -> one step (see _lib/draws.ts)
import { RIN_API, getSessionCookie, isSameOriginJson, json, rinHeaders } from './_lib/rankedin.js';
import type { Call } from './_lib/pairing.js';
import * as D from './_lib/draws.js';
import { clientIp, memoryLimit, tooMany } from './_lib/ratelimit.js';

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

const pos = (v: unknown) => Number.isInteger(Number(v)) && Number(v) > 0;

function fail(e: unknown): Response {
  if (e instanceof D.DrawError) return json({ error: e.code, message: e.message }, e.code === 'not_admin' ? 403 : 409);
  return json({ error: 'upstream', message: 'Kunde inte nå Rankedin just nu.' }, 502);
}

export async function GET(request: Request): Promise<Response> {
  const session = getSessionCookie(request);
  if (!session) return json({ error: 'not_logged_in' }, 401);
  const t = Number(new URL(request.url).searchParams.get('tournamentId'));
  if (!pos(t)) return json({ error: 'bad_request' }, 400);
  try {
    return json(await D.loadStatus(callWith(session), t));
  } catch (e) {
    return fail(e);
  }
}

export async function POST(request: Request): Promise<Response> {
  if (!isSameOriginJson(request)) return json({ error: 'forbidden' }, 403);
  if (!memoryLimit('write', clientIp(request), 60, 60_000)) return tooMany(60);
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
  if (!pos(t)) return json({ error: 'bad_request' }, 400);
  const call = callWith(session);
  const needClass = ['closeSignIn', 'openSignIn', 'drawOnePool', 'drawPools', 'clearDraw', 'schedule', 'unschedule'];
  if (needClass.includes(String(b.action)) && !pos(c)) return json({ error: 'bad_request' }, 400);
  try {
    switch (b.action) {
      case 'closeSignIn':
        await D.closeSignIn(call, t, c);
        break;
      case 'openSignIn':
        await D.openSignIn(call, t, c);
        break;
      case 'drawOnePool':
        await D.drawOnePool(call, t, c);
        break;
      case 'drawPools':
        await D.drawPools(call, t, c, Number(b.pools));
        break;
      case 'clearDraw':
        await D.clearDraw(call, t, c);
        break;
      case 'addCourt': {
        const s = (k: string) => String(b[k] ?? '').trim().slice(0, 100);
        await D.addCourt(call, t, { courtName: s('courtName'), locationName: s('locationName'), address: s('address'), city: s('city'), order: Number(b.order) || 0 });
        break;
      }
      case 'saveTimes':
        await D.saveTimes(call, t, Array.isArray(b.days) ? (b.days as D.DayEdit[]) : []);
        break;
      case 'schedule':
        await D.scheduleClass(call, c);
        break;
      case 'unschedule':
        await D.unscheduleClass(call, c);
        break;
      case 'publish':
        await D.publish(call, t);
        break;
      case 'unpublish':
        await D.unpublish(call, t);
        break;
      default:
        return json({ error: 'bad_request' }, 400);
    }
    return json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
