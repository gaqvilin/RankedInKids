// Read-only proxy: GET /api/rin?p=Tournament/GetHeaderAsync?id=1
// Forwards the user's Rankedin session when logged in, so buttons like
// "enter result" reflect what that user is allowed to do.
import { getSessionCookie, json, publicCacheControl, readUrl, rinHeaders } from './_lib/rankedin.js';

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.searchParams.get('p') || '';
  const target = readUrl(path);
  if (!target) return json({ error: 'path_not_allowed' }, 400);

  // anon=1: public data that must not depend on who is logged in.
  const anon = url.searchParams.get('anon') === '1';
  const session = anon ? null : getSessionCookie(request);
  let upstream: Response;
  try {
    upstream = await fetch(target, { headers: rinHeaders(session) });
  } catch {
    return json({ error: 'upstream_unreachable' }, 502);
  }

  const body = await upstream.text();
  return new Response(body, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('content-type') || 'application/json',
      // Only explicitly anonymous reads are shared at the edge; anything that could depend on a login never is.
      'Cache-Control': anon && upstream.ok ? publicCacheControl(path) : 'private, no-store',
      Vary: 'Cookie',
    },
  });
}
