// Read-only proxy: GET /api/rin?p=Tournament/GetHeaderAsync?id=1
// Forwards the user's Rankedin session when logged in, so buttons like
// "enter result" reflect what that user is allowed to do.
import { RIN_API, getSessionCookie, isAllowedReadPath, json, publicCacheControl, rinHeaders } from './_lib/rankedin.js';

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.searchParams.get('p') || '';
  if (!isAllowedReadPath(path)) return json({ error: 'path_not_allowed' }, 400);

  // anon=1: public data that must not depend on who is logged in.
  const session = url.searchParams.get('anon') === '1' ? null : getSessionCookie(request);
  let upstream: Response;
  try {
    upstream = await fetch(`${RIN_API}/${path.replace(/^\/+/, '')}`, { headers: rinHeaders(session) });
  } catch {
    return json({ error: 'upstream_unreachable' }, 502);
  }

  const body = await upstream.text();
  return new Response(body, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('content-type') || 'application/json',
      // Anonymous responses are shared and briefly cached at the edge; personal ones never are.
      'Cache-Control': session ? 'private, no-store' : upstream.ok ? publicCacheControl(path) : 'no-store',
      Vary: 'Cookie',
    },
  });
}
