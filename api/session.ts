// GET /api/session -> who is logged in (if anyone).
// POST /api/session -> log out.
import { clearSessionCookieHeader, fetchLayout, getSessionCookie, json, publicUser } from './_lib/rankedin.js';

export async function GET(request: Request): Promise<Response> {
  const session = getSessionCookie(request);
  if (!session) return json({ loggedIn: false });
  const layout = await fetchLayout(session);
  if (!layout?.IsAuthenticated) {
    return json({ loggedIn: false }, 200, { 'Set-Cookie': clearSessionCookieHeader() });
  }
  return json(publicUser(layout));
}

export async function POST(): Promise<Response> {
  return json({ loggedIn: false }, 200, { 'Set-Cookie': clearSessionCookieHeader() });
}
