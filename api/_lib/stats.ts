// Usage statistics without personal data: per day, how many different Rankedin
// accounts used the app logged in, and how many logged in. Accounts are hashed;
// no names, ids or IPs are stored. Read with SQL on the docs table (keys stats/...).
import { hashId } from './ratelimit.js';
import { getStore } from './store.js';

const seen = new Map<string, number>(); // per instance: write each account once per day
const day = () => new Date().toISOString().slice(0, 10);

/** kind: 'active' (app opened while logged in) or 'login' (a successful login). Never throws. */
export async function countAccount(kind: 'active' | 'login', accountId: string | number): Promise<void> {
  try {
    const d = day();
    const key = `${kind}:${d}:${accountId}`;
    if (kind === 'active' && seen.has(key)) return;
    seen.set(key, Date.now());
    if (seen.size > 5000) seen.clear();
    await getStore().hit(`stats/${kind}/${d}/${await hashId(`account:${accountId}`)}`, 400 * 86400);
  } catch {
    /* statistics must never break the app */
  }
}
