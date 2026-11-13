// Error reports from the app.
// POST /api/errors { kind, message, page, call?, status?, version } -> counted per day (see _lib/errors.ts)
// GET  /api/errors -> the last 7 days, most frequent first; only for the app's owners
import { json, isSameOriginJson } from './_lib/rankedin.js';
import { cleanReport, listErrors, recordError } from './_lib/errors.js';
import { ownerOnly } from './_lib/owners.js';
import { clientIp, storeLimit } from './_lib/ratelimit.js';

export async function POST(request: Request): Promise<Response> {
  if (!isSameOriginJson(request)) return json({ error: 'forbidden' }, 403);
  // Over the limit: answer ok anyway, the app should never care whether a report was kept.
  if (!(await storeLimit('errors', clientIp(request), 30, 60 * 60))) return json({ ok: true });
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  const report = cleanReport(body, request.headers.get('user-agent'));
  if (!report) return json({ error: 'bad_request' }, 400);
  await recordError(report);
  return json({ ok: true });
}

export async function GET(request: Request): Promise<Response> {
  const denied = await ownerOnly(request, json);
  if (denied) return denied;
  return json({ items: await listErrors(7) });
}
