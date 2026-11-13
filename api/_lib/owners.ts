// The app's owners: may read feedback and error reports. Public Rankedin ids, not secrets.
import { verifiedAccounts } from './identity.js';

export const owners = () => (process.env.FEEDBACK_ADMINS || 'R000385768').split(',').map((s) => s.trim()).filter(Boolean);

/** null when the request is from an owner, otherwise the response to send. */
export async function ownerOnly(request: Request, json: (body: unknown, status: number) => Response): Promise<Response | null> {
  const accounts = await verifiedAccounts(request).catch(() => []);
  if (accounts.length === 0) return json({ error: 'not_logged_in' }, 401);
  if (!accounts.some((a) => owners().includes(a.rankedinId))) return json({ error: 'not_allowed' }, 403);
  return null;
}
