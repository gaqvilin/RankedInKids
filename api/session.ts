// GET  /api/session -> the Rankedin accounts this device is logged in with, and which is active.
// POST /api/session { action: 'switch', playerId }  -> make another account active.
// POST /api/session { action: 'logout', playerId? } -> log out one account (default: the active one).
// POST /api/session { action: 'logout-all' }        -> log out every account.
import {
  accountCookieHeader,
  activeCookieHeader,
  clearAccountCookieHeader,
  clearSessionCookieHeader,
  fetchLayout,
  getAccounts,
  getActiveAccount,
  json,
  publicUser,
} from './_lib/rankedin.js';

type Account = ReturnType<typeof publicUser>;

export async function GET(request: Request): Promise<Response> {
  const stored = getAccounts(request);
  if (stored.length === 0) return json({ loggedIn: false, accounts: [] });

  const active = getActiveAccount(request);
  const cookies: string[] = [];
  const accounts: Account[] = [];
  let activeAccount: Account | null = null;

  await Promise.all(
    stored.map(async (a) => {
      const layout = await fetchLayout(a.cookie);
      if (!layout?.IsAuthenticated || !layout.CurrentPlayerId) {
        cookies.push(clearAccountCookieHeader(a.playerId)); // expired session
        return;
      }
      const user = publicUser(layout);
      if (a.playerId === 0) {
        // Migrate a legacy single-account login to the per-account cookie.
        cookies.push(clearSessionCookieHeader());
        cookies.push(accountCookieHeader(layout.CurrentPlayerId, a.cookie));
      }
      if (!accounts.some((x) => x.playerId === user.playerId)) accounts.push(user);
      if (a.playerId === active?.playerId) activeAccount = user;
    }),
  );

  if (accounts.length === 0) return json({ loggedIn: false, accounts: [] }, 200, {}, [...cookies, activeCookieHeader(null)]);
  accounts.sort((x, y) => x.name.localeCompare(y.name, 'sv'));
  const current: Account = activeAccount ?? accounts[0];
  if (current !== activeAccount) cookies.push(activeCookieHeader(current.playerId));
  return json({ ...current, accounts }, 200, {}, cookies);
}

export async function POST(request: Request): Promise<Response> {
  let body: { action?: string; playerId?: number } = {};
  try {
    body = await request.json();
  } catch {
    /* empty body = log out active account */
  }
  const stored = getAccounts(request);
  const action = body.action || 'logout';

  if (action === 'switch') {
    const id = Number(body.playerId);
    if (!stored.some((a) => a.playerId === id)) return json({ error: 'unknown_account' }, 400);
    return json({ ok: true, active: id }, 200, {}, [activeCookieHeader(id)]);
  }

  if (action === 'logout-all') {
    return json({ ok: true }, 200, {}, [...stored.map((a) => clearAccountCookieHeader(a.playerId)), activeCookieHeader(null)]);
  }

  // logout one account
  const target = body.playerId != null ? stored.find((a) => a.playerId === Number(body.playerId)) : getActiveAccount(request);
  if (!target) return json({ ok: true });
  const remaining = stored.filter((a) => a.playerId !== target.playerId && a.playerId > 0);
  const cookies = [clearAccountCookieHeader(target.playerId)];
  if (getActiveAccount(request)?.playerId === target.playerId) cookies.push(activeCookieHeader(remaining[0]?.playerId ?? null));
  return json({ ok: true }, 200, {}, cookies);
}
