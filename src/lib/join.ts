// Enter a tournament class as the logged-in player (see api/_lib/join.ts).
import { accountHeaders } from './api';

export type JoinClass = {
  classId: number;
  name: string;
  doubles: boolean;
  signInOpen: boolean;
  signedIn: boolean;
  lookingForPartner: boolean;
  full: boolean;
  blocked: string | null;
};
export type JoinOptions = { playerId: number; licenseRequired: boolean; askForConsent: boolean; signInPassed: boolean; classes: JoinClass[] };
export type JoinResult = { paymentUrl: string | null; verified: boolean };

export class JoinApiError extends Error {
  constructor(
    public code: string,
    message: string,
    /** Where to finish on rankedin.com (licence, home club, singles). */
    public url?: string,
  ) {
    super(message);
  }
}

export async function getJoinOptions(tournamentId: number): Promise<JoinOptions> {
  const res = await fetch(`/api/join-partner?tournamentId=${tournamentId}`, { credentials: 'same-origin', headers: accountHeaders() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new JoinApiError(data.error ?? 'error', data.message ?? 'Kunde inte hämta anmälan från Rankedin.');
  return data as JoinOptions;
}

export async function joinClass(tournamentId: number, classId: number, partnerId: number | null): Promise<JoinResult> {
  const res = await fetch('/api/join-partner', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...accountHeaders() },
    body: JSON.stringify({ action: 'join', tournamentId, classId, partnerId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new JoinApiError(data.error ?? 'error', data.message ?? 'Något gick fel.', typeof data.url === 'string' ? data.url : undefined);
  return { paymentUrl: data.paymentUrl ?? null, verified: !!data.verified };
}
