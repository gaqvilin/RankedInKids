// Rate limits. Two layers:
// - memoryLimit: per server instance, no I/O – for high-volume reads (the Rankedin proxy).
// - storeLimit: shared across instances via the database – for login and feedback.
// Client IPs are hashed before they are used as keys; raw IPs are never stored.
import { getStore } from './store.js';

export function clientIp(request: Request): string {
  return request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
}

export async function hashId(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`padeladmin:${value.toLowerCase()}`));
  return [...new Uint8Array(digest)]
    .slice(0, 10)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

const windows = new Map<string, { n: number; reset: number }>();

/** true = allowed. */
export function memoryLimit(scope: string, id: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const key = `${scope}:${id}`;
  const w = windows.get(key);
  if (!w || w.reset < now) {
    windows.set(key, { n: 1, reset: now + windowMs });
    if (windows.size > 5000) for (const [k, v] of windows) if (v.reset < now) windows.delete(k);
    return true;
  }
  w.n++;
  return w.n <= limit;
}

/** true = allowed. Fails open if the store is unreachable (the memory layer still applies). */
export async function storeLimit(scope: string, id: string, limit: number, windowSec: number): Promise<boolean> {
  if (!memoryLimit(scope, id, limit, windowSec * 1000)) return false;
  try {
    const n = await getStore().hit(`ratelimit/${scope}/${await hashId(id)}`, windowSec);
    return n <= limit;
  } catch {
    return true;
  }
}

export function tooMany(retryAfterSec: number, message = 'För många försök. Vänta en stund och försök igen.'): Response {
  return new Response(JSON.stringify({ error: 'rate_limited', message }), {
    status: 429,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Retry-After': String(retryAfterSec) },
  });
}
