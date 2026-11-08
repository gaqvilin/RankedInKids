// Team availability per round ("Kan du spela 12/12?").
// GET  /api/availability?teamId=1&date=2026-12-12  -> answers for that team and day
// POST /api/availability { teamId, date, playerId, status, comment? }
//
// Only people with a Rankedin login on this device that belong to the team
// (player or team leader) can read; players set their own answer, team
// leaders can set anyone's.
import { json, isSameOriginJson } from './_lib/rankedin.js';
import { fetchTeamRoster, verifiedAccounts } from './_lib/identity.js';
import { getStore } from './_lib/store.js';

export type AvailabilityStatus = 'yes' | 'no' | 'maybe';
export type AvailabilityEntry = {
  playerId: number;
  status: AvailabilityStatus;
  comment: string;
  updatedAt: string;
  updatedBy: string;
};

const STATUSES: AvailabilityStatus[] = ['yes', 'no', 'maybe'];
const isDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d));
const key = (teamId: number, date: string, playerId?: number) => `availability/${teamId}/${date}${playerId != null ? `/${playerId}` : ''}`;

async function access(request: Request, teamId: number) {
  const [accounts, roster] = await Promise.all([verifiedAccounts(request), fetchTeamRoster(teamId)]);
  if (!roster) return { error: json({ error: 'unknown_team' }, 404) } as const;
  const mine = accounts.filter((a) => roster.players.some((p) => p.rankedinId === a.rankedinId) || roster.captainRankedinIds.includes(a.rankedinId));
  if (accounts.length === 0) return { error: json({ error: 'not_logged_in' }, 401) } as const;
  if (mine.length === 0) return { error: json({ error: 'not_in_team' }, 403) } as const;
  const isCaptain = mine.some((a) => roster.captainRankedinIds.includes(a.rankedinId));
  return { roster, mine, isCaptain } as const;
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const teamId = Number(url.searchParams.get('teamId'));
  const date = url.searchParams.get('date') || '';
  if (!Number.isInteger(teamId) || teamId <= 0 || !isDate(date)) return json({ error: 'bad_request' }, 400);
  const a = await access(request, teamId);
  if ('error' in a) return a.error!;
  const docs = await getStore().listJson<AvailabilityEntry>(`${key(teamId, date)}/`);
  return json({
    entries: docs.map((d) => d.value),
    isCaptain: a.isCaptain,
    me: a.mine.map((m) => m.rankedinId),
  });
}

export async function POST(request: Request): Promise<Response> {
  if (!isSameOriginJson(request)) return json({ error: 'forbidden' }, 403);
  let body: { teamId?: number; date?: string; playerId?: number; status?: string; comment?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  const teamId = Number(body.teamId);
  const playerId = Number(body.playerId);
  const date = String(body.date || '');
  const status = body.status as AvailabilityStatus;
  const comment = String(body.comment || '').slice(0, 200);
  if (!Number.isInteger(teamId) || teamId <= 0 || !Number.isInteger(playerId) || playerId <= 0 || !isDate(date) || !STATUSES.includes(status)) {
    return json({ error: 'bad_request' }, 400);
  }
  const a = await access(request, teamId);
  if ('error' in a) return a.error!;
  const target = a.roster.players.find((p) => p.playerId === playerId);
  if (!target) return json({ error: 'not_in_team' }, 400);
  const self = a.mine.find((m) => m.rankedinId === target.rankedinId);
  if (!self && !a.isCaptain) return json({ error: 'not_allowed' }, 403);

  const entry: AvailabilityEntry = {
    playerId,
    status,
    comment,
    updatedAt: new Date().toISOString(),
    updatedBy: (self ?? a.mine.find((m) => a.roster.captainRankedinIds.includes(m.rankedinId)) ?? a.mine[0]).name,
  };
  await getStore().putJson(key(teamId, date, playerId), entry);
  return json({ ok: true, entry });
}
