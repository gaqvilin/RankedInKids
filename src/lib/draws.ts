import { accountHeaders } from './api';

export type ClassStatus = {
  classId: number;
  name: string;
  signInOpen: boolean;
  drawType: number;
  generated: boolean;
  scheduled: boolean;
  participants: number;
  seedingValid: boolean;
};
export type DayRow = { settingsId: number; day: string; startTime: string; endTime: string; duration: number; maxCourts: number; minBreak: number };
export type TournamentStatus = {
  classes: ClassStatus[];
  courts: { id: number; name: string }[];
  days: DayRow[];
  drawsPublished: boolean;
  matchesPublished: boolean;
  allMatchesHaveCourt: boolean;
  scheduling: boolean;
};

export class DrawApiError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function getDrawStatus(tournamentId: number): Promise<TournamentStatus> {
  const res = await fetch(`/api/draws?tournamentId=${tournamentId}`, { credentials: 'same-origin', headers: accountHeaders() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new DrawApiError(data.error ?? 'error', data.message ?? 'Kunde inte hämta läget från Rankedin.');
  return data as TournamentStatus;
}

export async function drawAction(tournamentId: number, action: string, extra: Record<string, unknown> = {}): Promise<void> {
  const res = await fetch('/api/draws', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...accountHeaders() },
    body: JSON.stringify({ action, tournamentId, ...extra }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new DrawApiError(data.error ?? 'error', data.message ?? 'Något gick fel.');
}
