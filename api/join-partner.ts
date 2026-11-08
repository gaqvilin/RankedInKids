// A player entered without partner adds a partner – Rankedin's own
// "Lägg till partner" (addPartnerAfterJoin → tournament/JoinDoublePartnerAsync),
// done with the player's own login. No organiser rights needed.
// POST /api/join-partner { tournamentId, classId, partnerId }
import { RIN_API, getSessionCookie, isSameOriginJson, json, rinHeaders } from './_lib/rankedin.js';
import { clientIp, memoryLimit, tooMany } from './_lib/ratelimit.js';

const STATUS: Record<number, string> = {
  1: 'Sista anmälningsdag har passerat.',
  2: 'Klassen är full.',
  3: 'Anmälan kräver betalning – slutför den i Rankedin.',
  4: 'Rankedin vill att anmälan slutförs på rankedin.com.',
  5: 'Klassen är full.',
  6: 'Partnern är redan anmäld i klassen.',
  7: 'Partnern är redan anmäld i klassen.',
};

export async function POST(request: Request): Promise<Response> {
  if (!isSameOriginJson(request)) return json({ error: 'forbidden' }, 403);
  if (!memoryLimit('write', clientIp(request), 60, 60_000)) return tooMany(60);
  const session = getSessionCookie(request);
  if (!session) return json({ error: 'not_logged_in', message: 'Logga in med spelarens konto först.' }, 401);
  let b: Record<string, unknown>;
  try {
    b = await request.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  const [tournamentId, classId, partnerId] = [b.tournamentId, b.classId, b.partnerId].map(Number);
  if (![tournamentId, classId, partnerId].every((n) => Number.isInteger(n) && n > 0)) return json({ error: 'bad_request' }, 400);

  const res = await fetch(`${RIN_API}/tournament/JoinDoublePartnerAsync`, {
    method: 'POST',
    headers: rinHeaders(session, true),
    body: JSON.stringify({ partnerId, tournamentClassId: classId, tournamentId, language: 'sv' }),
  });
  const text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    /* not json */
  }
  if (res.status === 401 || res.status === 403) return json({ error: 'not_allowed', message: 'Rankedin tillät inte ändringen för det här kontot.' }, 403);
  if (!res.ok) {
    const msg = String(data.message ?? data.Message ?? '');
    return json({ error: 'rejected', message: msg || `Rankedin svarade ${res.status}.` }, 422);
  }
  const status = Number(data.status ?? data.Status ?? 0);
  if (status !== 0) return json({ error: 'status', status, message: STATUS[status] ?? `Rankedin svarade med status ${status}.` }, 409);
  return json({ ok: true });
}
