// Client for /api/availability.
import { ApiError } from './api';
import { t } from './i18n';

export type AvailabilityStatus = 'yes' | 'no' | 'maybe';
export type AvailabilityEntry = { playerId: number; status: AvailabilityStatus; comment: string; updatedAt: string; updatedBy: string };
export type Availability = { entries: AvailabilityEntry[]; isCaptain: boolean; me: string[] };

export const STATUS_LABEL: Record<AvailabilityStatus, string> = { yes: 'Kan', maybe: 'Kanske', no: 'Kan inte' };

export async function getAvailability(teamId: number, date: string): Promise<Availability> {
  const res = await fetch(`/api/availability?teamId=${teamId}&date=${date}`, { credentials: 'same-origin' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const messages: Record<string, string> = {
      not_logged_in: t('Logga in med ett Rankedin-konto som finns i laget för att se och svara.'),
      not_in_team: t('Inget av dina inloggade konton finns i det här laget.'),
    };
    throw new ApiError(messages[data.error] || t('Kunde inte hämta tillgänglighet.'), res.status, data.error);
  }
  return data as Availability;
}

export async function setAvailability(teamId: number, date: string, playerId: number, status: AvailabilityStatus, comment = ''): Promise<void> {
  const res = await fetch('/api/availability', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ teamId, date, playerId, status, comment }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(data.error === 'not_allowed' ? t('Du kan bara svara för dig själv (lagledare kan svara för alla).') : t('Kunde inte spara svaret.'), res.status, data.error);
  }
}
