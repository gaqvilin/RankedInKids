// POST /api/login { userName, password } -> logs in to Rankedin and keeps the
// Rankedin session in an HttpOnly cookie on our own domain. The password is
// never stored.
import {
  RIN_API,
  cookiesFromResponse,
  fetchLayout,
  json,
  publicUser,
  rinHeaders,
  sessionCookieHeader,
} from './_lib/rankedin.js';

export async function POST(request: Request): Promise<Response> {
  let body: { userName?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  const userName = (body.userName || '').trim();
  const password = body.password || '';
  if (!userName || !password) return json({ error: 'missing_credentials' }, 400);

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

  const layout = await fetchLayout(cookie);
  if (!layout?.IsAuthenticated) return json({ error: 'invalid_credentials' }, 401);

  return json(publicUser(layout), 200, { 'Set-Cookie': sessionCookieHeader(cookie) });
}
