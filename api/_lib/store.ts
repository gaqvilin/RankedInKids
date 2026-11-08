// Small JSON document store for data Rankedin doesn't have (availability,
// later notes etc.). Production: Neon Postgres (table "docs"). Fallbacks:
// private Vercel Blob store, then in-memory for local dev and tests.
import { get, list, put } from '@vercel/blob';
import { neon } from '@neondatabase/serverless';

export interface DocStore {
  getJson<T>(key: string): Promise<T | null>;
  putJson(key: string, value: unknown): Promise<void>;
  /** All documents whose key starts with prefix. */
  listJson<T>(prefix: string): Promise<{ key: string; value: T }[]>;
  /** Counts one hit in a fixed window and returns the count so far (for rate limits). */
  hit(key: string, windowSec: number): Promise<number>;
}

type Counter = { n: number; reset: number };
/** Non-atomic fallback for stores without a counter primitive (fine for dev and blob). */
async function hitViaJson(store: Pick<DocStore, 'getJson' | 'putJson'>, key: string, windowSec: number): Promise<number> {
  const now = Date.now() / 1000;
  const c = await store.getJson<Counter>(key);
  const next = !c || c.reset < now ? { n: 1, reset: now + windowSec } : { n: c.n + 1, reset: c.reset };
  await store.putJson(key, next);
  return next.n;
}

const safeKey = (key: string) => {
  if (!/^[a-z0-9/_-]+$/i.test(key) || key.includes('..')) throw new Error(`invalid key: ${key}`);
  return `${key}.json`;
};

class BlobStore implements DocStore {
  hit(key: string, windowSec: number) {
    return hitViaJson(this, key, windowSec);
  }
  async getJson<T>(key: string): Promise<T | null> {
    const res = await get(safeKey(key), { access: 'private', useCache: false });
    if (!res) return null;
    const text = await new Response(res.stream).text();
    return JSON.parse(text) as T;
  }

  async putJson(key: string, value: unknown): Promise<void> {
    await put(safeKey(key), JSON.stringify(value), {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json',
      cacheControlMaxAge: 60,
    });
  }

  async listJson<T>(prefix: string): Promise<{ key: string; value: T }[]> {
    const out: { key: string; value: T }[] = [];
    let cursor: string | undefined;
    do {
      const page = await list({ prefix, cursor, limit: 1000 });
      const docs = await Promise.all(
        page.blobs
          .filter((b) => b.pathname.endsWith('.json'))
          .map(async (b) => {
            const res = await get(b.pathname, { access: 'private', useCache: false });
            if (!res) return null;
            return { key: b.pathname.replace(/\.json$/, ''), value: JSON.parse(await new Response(res.stream).text()) as T };
          }),
      );
      for (const d of docs) if (d) out.push(d);
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return out;
  }
}

/** Runs a parameterised SQL query and returns rows. */
export type SqlQuery = (text: string, params: unknown[]) => Promise<Record<string, unknown>[]>;

/** Postgres: one table docs(key text primary key, value jsonb, updated_at timestamptz). */
export class SqlStore implements DocStore {
  constructor(private query: SqlQuery) {}

  /** Atomic fixed-window counter in the same docs table: {"n": count, "reset": epoch seconds}. */
  async hit(key: string, windowSec: number): Promise<number> {
    safeKey(key);
    const rows = await this.query(
      `INSERT INTO docs (key, value, updated_at)
         VALUES ($1, jsonb_build_object('n', 1, 'reset', extract(epoch from now()) + $2::int), now())
       ON CONFLICT (key) DO UPDATE SET
         value = CASE WHEN (docs.value->>'reset')::float < extract(epoch from now())
                      THEN jsonb_build_object('n', 1, 'reset', extract(epoch from now()) + $2::int)
                      ELSE jsonb_set(docs.value, '{n}', to_jsonb((docs.value->>'n')::int + 1)) END,
         updated_at = now()
       RETURNING (value->>'n')::int AS n`,
      [key, windowSec],
    );
    return Number(rows[0]?.n ?? 1);
  }

  async getJson<T>(key: string): Promise<T | null> {
    safeKey(key);
    const rows = await this.query('SELECT value FROM docs WHERE key = $1', [key]);
    return rows[0] ? (rows[0].value as T) : null;
  }

  async putJson(key: string, value: unknown): Promise<void> {
    safeKey(key);
    await this.query(
      'INSERT INTO docs (key, value, updated_at) VALUES ($1, $2::jsonb, now()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()',
      [key, JSON.stringify(value)],
    );
  }

  async listJson<T>(prefix: string): Promise<{ key: string; value: T }[]> {
    if (!/^[A-Za-z0-9/_-]*$/.test(prefix)) throw new Error(`invalid prefix: ${prefix}`);
    // Prefix contains no LIKE wildcards (validated above), so a plain LIKE is safe.
    const rows = await this.query('SELECT key, value FROM docs WHERE key LIKE $1 ORDER BY key', [`${prefix}%`]);
    return rows.map((r) => ({ key: String(r.key), value: r.value as T }));
  }
}

export class MemoryStore implements DocStore {
  private docs = new Map<string, string>();
  hit(key: string, windowSec: number) {
    return hitViaJson(this, key, windowSec);
  }
  async getJson<T>(key: string): Promise<T | null> {
    const v = this.docs.get(safeKey(key));
    return v ? (JSON.parse(v) as T) : null;
  }
  async putJson(key: string, value: unknown): Promise<void> {
    this.docs.set(safeKey(key), JSON.stringify(value));
  }
  async listJson<T>(prefix: string): Promise<{ key: string; value: T }[]> {
    return [...this.docs.entries()]
      .filter(([k]) => k.startsWith(prefix))
      .map(([k, v]) => ({ key: k.replace(/\.json$/, ''), value: JSON.parse(v) as T }));
  }
}

let instance: DocStore | null = null;

export function getStore(): DocStore {
  if (!instance) {
    if (process.env.DATABASE_URL) {
      const sql = neon(process.env.DATABASE_URL);
      instance = new SqlStore((text, params) => sql.query(text, params) as Promise<Record<string, unknown>[]>);
    } else if (process.env.BLOB_READ_WRITE_TOKEN) {
      instance = new BlobStore();
    } else {
      instance = new MemoryStore();
    }
  }
  return instance;
}

/** Tests can inject a store. */
export function setStore(store: DocStore | null) {
  instance = store;
}
