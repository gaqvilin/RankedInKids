// Small JSON document store for data Rankedin doesn't have (availability,
// later notes etc.). Production: private Vercel Blob store. Local dev and
// tests: in memory. Swap the implementation here to move to a real database.
import { get, list, put } from '@vercel/blob';

export interface DocStore {
  getJson<T>(key: string): Promise<T | null>;
  putJson(key: string, value: unknown): Promise<void>;
  /** All documents whose key starts with prefix. */
  listJson<T>(prefix: string): Promise<{ key: string; value: T }[]>;
}

const safeKey = (key: string) => {
  if (!/^[a-z0-9/_-]+$/i.test(key) || key.includes('..')) throw new Error(`invalid key: ${key}`);
  return `${key}.json`;
};

class BlobStore implements DocStore {
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

export class MemoryStore implements DocStore {
  private docs = new Map<string, string>();
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
  if (!instance) instance = process.env.BLOB_READ_WRITE_TOKEN ? new BlobStore() : new MemoryStore();
  return instance;
}

/** Tests can inject a store. */
export function setStore(store: DocStore | null) {
  instance = store;
}
