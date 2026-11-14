import { t } from './i18n';
import { CURRENT_VERSION } from './releases';

export type FeedbackKind = 'idea' | 'bug' | 'other';
export type FeedbackItem = {
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

export async function sendFeedback(input: { kind: FeedbackKind; message: string; contact: string; website: string }): Promise<void> {
  const res = await fetch('/api/feedback', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...input, page: location.pathname + location.search, version: CURRENT_VERSION }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(res.status === 400 ? t('Skriv några ord först.') : t((res.status === 429 && data.message) || 'Kunde inte skicka just nu. Försök igen om en stund.'));
  }
}

/** null = not allowed to read. */
export async function listFeedback(): Promise<FeedbackItem[] | null> {
  const res = await fetch('/api/feedback', { credentials: 'same-origin' });
  if (res.status === 401 || res.status === 403) return null;
  if (!res.ok) throw new Error(t('Kunde inte hämta feedback.'));
  return ((await res.json()) as { items: FeedbackItem[] }).items;
}
