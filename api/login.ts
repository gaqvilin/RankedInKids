// POST /api/login { userName, password } -> logs in to Rankedin and keeps the
// Rankedin session in an HttpOnly cookie on our own domain (one per account,
// several accounts can be logged in at once). The password is never stored.
import {
  RIN_API,
  accountCookieHeader,
  activeCookieHeader,
  clearSessionCookieHeader,
  cookiesFromResponse,
  fetchLayout,
  isSameOriginJson,
  json,
  publicUser,
  rinHeaders,
} from './_lib/rankedin.js';
import { clientIp, storeLimit, tooMany } from './_lib/ratelimit.js';
import { countAccount } from './_lib/stats.js';

export async function POST(request: Request): Promise<Response> {
  if (!isSameOriginJson(request)) return json({ error: 'forbidden' }, 403);
  let body: { userName?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  const userName = (body.userName || '').trim();
  const password = body.password || '';
  if (!userName || !password) return json({ error: 'missing_credentials' }, 400);
  // Slow down password guessing through us: per device/IP and per account name.
  if (!(await storeLimit('login-ip', clientIp(request), 20, 15 * 60)) || !(await storeLimit('login-user', userName, 8, 15 * 60))) {
    return tooMany(15 * 60, 'För många inloggningsförsök. Vänta en kvart och försök igen.');
  }

  let res: Response;
  try {
    res = await fetch(`${RIN_API}/Account/LogInAsync`, {
      method: 'POST',
      headers: rinHeaders(null, true),
      body: JSON.stringify({ userName, password, rememberMe: true, timezoneOffset: -60, clientPlatform: 'web' }),
      redirect: 'manual',
    });
  } catch {
    return json({ error: 'upstream_unreachable' }, 502);
  }

  const cookie = cookiesFromResponse(res);
  if (!res.ok || !/rin-auth=/i.test(cookie)) {
    return json({ error: 'invalid_credentials' }, 401);
  }

  let layout;
  try {
    layout = await fetchLayout(cookie);
  } catch {
    return json({ error: 'upstream_unreachable' }, 502);
  }
  if (!layout?.IsAuthenticated || !layout.CurrentPlayerId) return json({ error: 'invalid_credentials' }, 401);

  await countAccount('login', layout.CurrentPlayerId);
  // Adds this account next to any others already logged in on this device, and makes it active.
  return json(publicUser(layout), 200, {}, [
    accountCookieHeader(layout.CurrentPlayerId, cookie),
    activeCookieHeader(layout.CurrentPlayerId),
    clearSessionCookieHeader(),
  ]);
}
