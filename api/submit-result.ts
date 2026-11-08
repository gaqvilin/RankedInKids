// POST /api/submit-result { challengeId, sets: [[6,3],[4,6],[10,8]] }
// Same flow as the "Enter result" dialog on rankedin.com:
//   GET  Match/GetChallengeResultAsync  (participant ids, current player)
//   POST Match/SubmitResultAsync
import { RIN_API, getSessionCookie, json, rinHeaders, isSameOriginJson } from './_lib/rankedin.js';
import { buildSubmitPayload, type ChallengeResult } from './_lib/result.js';

export async function POST(request: Request): Promise<Response> {
  if (!isSameOriginJson(request)) return json({ error: 'forbidden' }, 403);
  const session = getSessionCookie(request);
  if (!session) return json({ error: 'not_logged_in' }, 401);

  let body: { challengeId?: number; sets?: [number, number][] };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  const challengeId = Number(body.challengeId);
  if (!Number.isInteger(challengeId) || challengeId <= 0) return json({ error: 'bad_challenge' }, 400);

  const current = await fetch(`${RIN_API}/Match/GetChallengeResultAsync?challengeId=${challengeId}`, {
    headers: rinHeaders(session),
  });
  if (current.status === 401 || current.status === 403) return json({ error: 'not_allowed' }, 403);
  if (!current.ok) return json({ error: 'upstream_error', status: current.status }, 502);
  const challenge = (await current.json()) as ChallengeResult;

  let payload;
  try {
    payload = buildSubmitPayload(challengeId, challenge, body.sets || []);
  } catch (e) {
    return json({ error: 'invalid_score', message: (e as Error).message }, 400);
  }

  const res = await fetch(`${RIN_API}/Match/SubmitResultAsync`, {
    method: 'POST',
    headers: rinHeaders(session, true),
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if (!res.ok) {
    return json({ error: res.status === 401 || res.status === 403 ? 'not_allowed' : 'rejected', status: res.status, detail: text.slice(0, 500) }, res.status === 401 || res.status === 403 ? 403 : 422);
  }
  return json({ ok: true });
}
