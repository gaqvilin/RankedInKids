// POST /api/lineup { teamMatchId, side: 'first'|'second', lineups: [{ challengeId, playerIds }] }
// Saves a team-league lineup for the logged-in captain, the same way the
// lineup editor on rankedin.com does (TeamLeague/UpdateTeamLeagueLineupsAsync).
import { RIN_API, getSessionCookie, json, rinHeaders, isSameOriginJson } from './_lib/rankedin.js';
import { buildLineupPayload, validateLineup, type CurrentMatch, type LineupChange, type Side } from './_lib/lineup.js';
import { clientIp, memoryLimit, tooMany } from './_lib/ratelimit.js';

type RawSide = { player1Id: number | null; player2Id: number | null } | null;

export async function POST(request: Request): Promise<Response> {
  if (!isSameOriginJson(request)) return json({ error: 'forbidden' }, 403);
  if (!memoryLimit('write', clientIp(request), 60, 60_000)) return tooMany(60);
  const session = getSessionCookie(request);
  if (!session) return json({ error: 'not_logged_in' }, 401);

  let body: { teamMatchId?: number; side?: Side; lineups?: LineupChange[] };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  const teamMatchId = Number(body.teamMatchId);
  const side = body.side;
  const changes = (body.lineups || []).map((l) => ({
    challengeId: Number(l.challengeId),
    playerIds: (l.playerIds || []).map((n) => Number(n) || 0),
  }));
  if (!Number.isInteger(teamMatchId) || teamMatchId <= 0 || (side !== 'first' && side !== 'second') || changes.length === 0) {
    return json({ error: 'bad_request' }, 400);
  }

  // Current state, seen with the captain's own session.
  const [lineupsRes, matchesRes] = await Promise.all([
    fetch(`${RIN_API}/TeamLeague/GetTeamsLineupsAsync?teamMatchId=${teamMatchId}&language=sv`, { headers: rinHeaders(session) }),
    fetch(`${RIN_API}/TeamLeague/GetTeamLeagueTeamsMatchesAsync?teamMatchId=${teamMatchId}&language=sv`, { headers: rinHeaders(session) }),
  ]);
  if (!lineupsRes.ok || !matchesRes.ok) return json({ error: 'upstream_error' }, 502);
  const lineups = (await lineupsRes.json().catch(() => ({}))) as Record<'firstTeam' | 'secondTeam', { canLineupTeam: boolean; players: { playerId: number; firstName: string; lastName: string }[] }>;
  const team = side === 'first' ? lineups.firstTeam : lineups.secondTeam;
  if (!team?.canLineupTeam) return json({ error: 'not_allowed' }, 403);

  const blocks = ((await matchesRes.json().catch(() => null)) ?? []) as {
    settings?: { matchType: number };
    matches?: { matches?: { id: number; challenger: RawSide; challenged: RawSide }[] };
  }[];
  const matchesOf = (b: (typeof blocks)[number]) => b?.matches?.matches ?? [];
  // A team match can hold several blocks (one per match type); every change must be in the same one.
  const block = Array.isArray(blocks) ? blocks.find((b) => matchesOf(b).some((m) => changes.some((c) => c.challengeId === m.id))) : undefined;
  if (!block || !changes.every((c) => matchesOf(block).some((m) => m.id === c.challengeId))) return json({ error: 'unknown_matches' }, 400);
  const matchType = block.settings?.matchType ?? 3;
  const ids = (s: RawSide) => [s?.player1Id || 0, s?.player2Id || 0];
  const current: CurrentMatch[] = matchesOf(block).map((m) => ({
    challengeId: m.id,
    firstTeamPlayerIds: ids(m.challenger),
    secondTeamPlayerIds: ids(m.challenged),
  }));

  const roster = (team.players || []).map((p) => ({ id: p.playerId, name: `${p.firstName} ${p.lastName}`.trim() }));
  const error = validateLineup(changes, { matchType, roster: roster.length ? roster : undefined });
  if (error) return json({ error: 'invalid_lineup', message: error }, 400);

  const payload = buildLineupPayload(teamMatchId, side, current, changes, matchType);
  const res = await fetch(`${RIN_API}/TeamLeague/UpdateTeamLeagueLineupsAsync`, {
    method: 'POST',
    headers: rinHeaders(session, true),
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if (!res.ok) {
    const denied = res.status === 401 || res.status === 403;
    return json({ error: denied ? 'not_allowed' : 'rejected', status: res.status, detail: text.slice(0, 500) }, denied ? 403 : 422);
  }
  return json({ ok: true });
}
