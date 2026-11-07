// GET /api/health -> which data store is in use and whether it answers.
import { json } from './_lib/rankedin.js';
import { getStore } from './_lib/store.js';

export async function GET(): Promise<Response> {
  const backend = process.env.DATABASE_URL ? 'neon' : process.env.BLOB_READ_WRITE_TOKEN ? 'blob' : 'memory';
  try {
    const t0 = Date.now();
    const doc = await getStore().getJson<{ ok: boolean }>('system/healthcheck');
    return json({ ok: true, backend, store: doc ? 'reachable' : 'empty', ms: Date.now() - t0 });
  } catch (e) {
    return json({ ok: false, backend, error: (e as Error).message.slice(0, 200) }, 500);
  }
}
