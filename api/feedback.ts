// Feedback from users.
// POST /api/feedback { kind, message, contact?, page?, version?, website? } -> saved in the store
// GET  /api/feedback -> every message, newest first; only for the app's owners
//
// Anyone can send (no login needed). If logged in, the verified Rankedin
// accounts are attached so we know who wrote. "website" is a honeypot field
// that people never fill in; bots do.
import { json, isSameOriginJson } from './_lib/rankedin.js';
import { verifiedAccounts } from './_lib/identity.js';
import { getStore } from './_lib/store.js';
import { clientIp, storeLimit, tooMany } from './_lib/ratelimit.js';

export type FeedbackKind = 'idea' | 'bug' | 'other';
export type Feedback = {
  id: string;
  kind: FeedbackKind;
  message: string;
  contact: string;
  page: string;
  version: string;
  accounts: { rankedinId: string; name: string }[];
  userAgent: string;
  createdAt: string;
};

const KINDS: FeedbackKind[] = ['idea', 'bug', 'other'];
/** Rankedin ids that may read feedback. Public ids, not secrets. */
const admins = () => (process.env.FEEDBACK_ADMINS || 'R000385768').split(',').map((s) => s.trim()).filter(Boolean);
const clip = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

export async function POST(request: Request): Promise<Response> {
  if (!isSameOriginJson(request)) return json({ error: 'forbidden' }, 403);
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  if (clip(body.website, 200)) return json({ ok: true }); // honeypot: pretend it worked
  if (!(await storeLimit('feedback', clientIp(request), 10, 60 * 60))) return tooMany(60 * 60, 'Du har skickat mycket feedback på kort tid – tack! Vänta en stund.');
  const message = clip(body.message, 4000);
  if (message.length < 3) return json({ error: 'empty' }, 400);
  const kind = KINDS.includes(body.kind as FeedbackKind) ? (body.kind as FeedbackKind) : 'other';

  const accounts = await verifiedAccounts(request).catch(() => []);
  const now = new Date();
  const id = `${now.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}-${Math.random().toString(36).slice(2, 8)}`;
  const entry: Feedback = {
    id,
    kind,
    message,
    contact: clip(body.contact, 200),
    page: clip(body.page, 300),
    version: clip(body.version, 20),
    accounts: accounts.map((a) => ({ rankedinId: a.rankedinId, name: a.name })),
    userAgent: clip(request.headers.get('user-agent'), 300),
    createdAt: now.toISOString(),
  };
  await getStore().putJson(`feedback/${id}`, entry);
  return json({ ok: true, id });
}

export async function GET(request: Request): Promise<Response> {
  const accounts = await verifiedAccounts(request).catch(() => []);
  if (accounts.length === 0) return json({ error: 'not_logged_in' }, 401);
  if (!accounts.some((a) => admins().includes(a.rankedinId))) return json({ error: 'not_allowed' }, 403);
  const docs = await getStore().listJson<Feedback>('feedback/');
  return json({ items: docs.map((d) => d.value).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });
}
