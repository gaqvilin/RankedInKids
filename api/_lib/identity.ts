// Who is really logged in, verified against Rankedin (cookie names alone can
// be forged, so every write checks each session with Rankedin).
import { RIN_API, fetchLayout, getAccounts, rinHeaders } from './rankedin.js';

export type VerifiedAccount = { playerId: number; rankedinId: string; name: string };

export async function verifiedAccounts(request: Request): Promise<VerifiedAccount[]> {
  const stored = getAccounts(request);
  const layouts = await Promise.all(stored.map((a) => fetchLayout(a.cookie).catch(() => null)));
  const out: VerifiedAccount[] = [];
  for (const l of layouts) {
    if (!l?.IsAuthenticated || !l.RankedinId) continue;
    if (out.some((x) => x.rankedinId === l.RankedinId)) continue;
    out.push({ playerId: l.CurrentPlayerId ?? 0, rankedinId: l.RankedinId, name: [l.FirstName, l.LastName].filter(Boolean).join(' ') });
  }
  return out;
}

export type TeamRoster = {
  teamId: number;
  name: string;
  players: { playerId: number; rankedinId: string; name: string }[];
  captainRankedinIds: string[];
};

/** Public team info from Rankedin: players and team leaders ("initiators"). */
export async function fetchTeamRoster(teamId: number): Promise<TeamRoster | null> {
  const res = await fetch(`${RIN_API}/TeamLeague/GetTeamLeagueTeamHomepageAsync?TeamId=${teamId}&Language=sv`, { headers: rinHeaders(null) });
  if (!res.ok) return null;
  const raw = (await res.json()) as {
    team?: {
      id: number;
      name: string;
      initiator?: { playerUrl: string }[];
      players?: { id: number; rankedinId: string; firstName: string; lastName: string }[];
    };
  };
  if (!raw.team) return null;
  return {
    teamId: raw.team.id,
    name: raw.team.name,
    players: (raw.team.players || []).map((p) => ({ playerId: p.id, rankedinId: p.rankedinId, name: `${p.firstName} ${p.lastName}`.trim() })),
    captainRankedinIds: (raw.team.initiator || []).map((i) => i.playerUrl.match(/R\d{9}/)?.[0]).filter((x): x is string => !!x),
  };
}
