import { accountHeaders } from './api';
import { t } from './i18n';

export type PairEntry = {
  entryId: number;
  tournamentPlayerId: number;
  player1: { id: number; name: string } | null;
  player2: { id: number; name: string } | null;
  drawCreated: boolean;
};

export class PairingApiError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function handle(res: Response): Promise<PairEntry[]> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new PairingApiError(data.error ?? 'error', t(data.message ?? (res.status === 401 ? 'Logga in först.' : 'Något gick fel.')));
  return data.entries as PairEntry[];
}

/** Rankedin's admin view of a class. Throws code "not_admin" when the active account isn't organiser. */
export async function getClassEntries(tournamentId: number, classId: number): Promise<PairEntry[]> {
  return handle(await fetch(`/api/pairing?tournamentId=${tournamentId}&classId=${classId}`, { credentials: 'same-origin', headers: accountHeaders() }));
}

async function post(body: Record<string, unknown>) {
  return handle(
    await fetch('/api/pairing', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...accountHeaders() },
      body: JSON.stringify(body),
    }),
  );
}

export const pairPlayers = (tournamentId: number, classId: number, aId: number, bId: number) => post({ action: 'pair', tournamentId, classId, aId, bId });
export const unpairPlayers = (tournamentId: number, classId: number, entryId: number) => post({ action: 'unpair', tournamentId, classId, entryId });

/** The logged-in player (entered without partner) adds a partner, like "Lägg till partner" on rankedin.com. */
export async function addMyPartner(tournamentId: number, classId: number, partnerId: number): Promise<void> {
  const res = await fetch('/api/join-partner', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...accountHeaders() },
    body: JSON.stringify({ tournamentId, classId, partnerId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new PairingApiError(data.error ?? 'error', t(data.message ?? 'Något gick fel.'));
}
