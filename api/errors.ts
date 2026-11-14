// Error reports from the app.
// POST /api/errors { kind, message, page, call?, status?, version } -> counted per day (see _lib/errors.ts)
// GET  /api/errors -> the last 7 days, most frequent first; only for the app's owners
// GET  /api/errors?health=1 -> which data store is in use and whether it answers (was /api/health)
import { json, isSameOriginJson } from './_lib/rankedin.js';
import { cleanReport, listErrors, recordError } from './_lib/errors.js';
import { ownerOnly } from './_lib/owners.js';
import { clientIp, storeLimit } from './_lib/ratelimit.js';
import { getStore } from './_lib/store.js';

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

async function health(): Promise<Response> {
  const backend = process.env.DATABASE_URL ? 'neon' : process.env.BLOB_READ_WRITE_TOKEN ? 'blob' : 'memory';
  try {
    const t0 = Date.now();
    const doc = await getStore().getJson<{ ok: boolean }>('system/healthcheck');
    return json({ ok: true, backend, store: doc ? 'reachable' : 'empty', ms: Date.now() - t0 });
  } catch (e) {
    return json({ ok: false, backend, error: (e as Error).message.slice(0, 200) }, 500);
  }
}

export async function GET(request: Request): Promise<Response> {
  if (new URL(request.url).searchParams.get('health') === '1') return health();
  const denied = await ownerOnly(request, json);
  if (denied) return denied;
  return json({ items: await listErrors(7) });
}
