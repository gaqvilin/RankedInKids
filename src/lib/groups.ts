// A trainer's group of players: saved on the server (api/groups.ts), shown on Översikt, shareable by link.
import { accountHeaders } from './api';
import { t } from './i18n';
import { loadOverview, type Entry, type LeagueTeamSummary } from './overview';
import { getProfile } from './rankedin';

export type Group = { id: string; name: string; players: string[]; shareId: string; updatedAt: string };

export class GroupApiError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function call<T>(init: RequestInit & { url: string }, fallback: string): Promise<T> {
  const res = await fetch(init.url, { credentials: 'same-origin', ...init });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new GroupApiError(data.error ?? 'error', t(data.message ?? fallback));
  return data as T;
}

export const listGroups = () => call<{ groups: Group[] }>({ url: '/api/groups', headers: accountHeaders() }, 'Kunde inte hämta grupperna.').then((d) => d.groups);
export const getSharedGroup = (shareId: string) =>
  call<{ name: string; players: string[] }>({ url: `/api/groups?share=${encodeURIComponent(shareId)}` }, 'Gruppen finns inte längre.');

const post = (body: unknown) => ({ url: '/api/groups', method: 'POST', headers: { 'Content-Type': 'application/json', ...accountHeaders() }, body: JSON.stringify(body) });
export const saveGroup = (g: { id?: string; name: string; players: string[] }) =>
  call<{ group: Group }>(post({ action: 'save', ...g }), 'Kunde inte spara gruppen.').then((d) => d.group);
export const deleteGroup = (id: string) => call<{ ok: true }>(post({ action: 'delete', id }), 'Kunde inte ta bort gruppen.');

/** Where a player stands right now – what the group view shows on their row. */
export type PlayerStatus =
  | { kind: 'partner'; eventId: number; event: string; closes: string | null }
  | { kind: 'license'; eventId: number; event: string }
  | { kind: 'tournament'; soon: boolean; eventId: number; event: string; date: string; partner: string | null }
  | { kind: 'matchday'; soon: boolean; teamId: number; team: string; date: string }
  | { kind: 'none' };

export type GroupPlayer = { rankedinId: string; id: number; name: string; age: string | null; imageUrl: string | null; status: PlayerStatus; failed?: boolean };

const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
/** The Sunday that ends this week (today, when it is a Sunday). */
function endOfWeek(now: Date): Date {
  const d = dayStart(now);
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7) + 1);
  return d; // exclusive: Monday 00:00
}

/**
 * One status per player, most urgent first: a missing partner, a missing licence, then the next thing they play
 * (marked `soon` when it is this week), else nothing.
 */
export function playerStatus(entries: Entry[], leagueTeams: LeagueTeamSummary[], now: Date = new Date()): PlayerStatus {
  const today = dayStart(now).getTime();
  const upcoming = entries.filter((e) => Date.parse(e.event.startDate) >= today).sort((a, b) => a.event.startDate.localeCompare(b.event.startDate));
  const noPartner = upcoming.find((e) => e.missingPartner);
  if (noPartner) return { kind: 'partner', eventId: noPartner.event.id, event: noPartner.event.name, closes: noPartner.closeSignInDate };
  const noLicense = upcoming.find((e) => e.className && !e.hasLicense);
  if (noLicense) return { kind: 'license', eventId: noLicense.event.id, event: noLicense.event.name };

  const week = endOfWeek(now).getTime();
  const nextTournament = upcoming.find((e) => e.className);
  const nextDay = leagueTeams
    .filter((l) => l.next?.date && Date.parse(l.next.date) >= today)
    .sort((a, b) => a.next!.date!.localeCompare(b.next!.date!))[0];
  const tDate = nextTournament ? Date.parse(nextTournament.event.startDate) : Infinity;
  const dDate = nextDay ? Date.parse(nextDay.next!.date!) : Infinity;
  if (tDate === Infinity && dDate === Infinity) return { kind: 'none' };
  if (tDate <= dDate) {
    const e = nextTournament!;
    return { kind: 'tournament', soon: tDate < week, eventId: e.event.id, event: e.event.name, date: e.event.startDate, partner: e.partner };
  }
  return { kind: 'matchday', soon: dDate < week, teamId: nextDay.teamId, team: nextDay.teamName, date: nextDay.next!.date! };
}

/** Everything the group view needs for each player. A player that cannot be read is kept, marked as failed. */
export async function loadGroupPlayers(rankedinIds: string[]): Promise<GroupPlayer[]> {
  return Promise.all(
    rankedinIds.map(async (rankedinId): Promise<GroupPlayer> => {
      try {
        const p = await getProfile(rankedinId);
        const o = await loadOverview(p.id);
        return { rankedinId, id: p.id, name: p.name, age: p.age, imageUrl: p.imageUrl, status: playerStatus(o.entries, o.leagueTeams) };
      } catch {
        return { rankedinId, id: 0, name: rankedinId, age: null, imageUrl: null, status: { kind: 'none' }, failed: true };
      }
    }),
  );
}

/** The three blocks of the group view. */
export function groupBlocks(players: GroupPlayer[]) {
  const action = players.filter((p) => p.status.kind === 'partner' || p.status.kind === 'license');
  const soon = players.filter((p) => (p.status.kind === 'tournament' || p.status.kind === 'matchday') && p.status.soon);
  const rest = players.filter((p) => !action.includes(p) && !soon.includes(p));
  const date = (p: GroupPlayer) => ('date' in p.status ? p.status.date : '9999');
  return { action, soon: [...soon].sort((a, b) => date(a).localeCompare(date(b))), rest: [...rest].sort((a, b) => date(a).localeCompare(date(b)) || a.name.localeCompare(b.name, 'sv')) };
}
