import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from '../api/lineup';

const lineups = (canFirst: boolean) => ({
  firstTeam: { id: 1, name: 'Hemma', canLineupTeam: canFirst, players: [1, 2, 3, 4].map((id) => ({ playerId: id, firstName: `P${id}`, lastName: '' })) },
  secondTeam: { id: 2, name: 'Borta', canLineupTeam: false, players: [] },
});
const matches = [
  {
    settings: { matchType: 3 },
    matches: {
      matches: [
        { id: 100, challenger: { player1Id: 0, player2Id: 0 }, challenged: { player1Id: 70, player2Id: 80 } },
        { id: 101, challenger: { player1Id: 3, player2Id: 4 }, challenged: { player1Id: 0, player2Id: 0 } },
      ],
    },
  },
];

function mockRankedin(canFirst = true) {
  const posted: unknown[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('GetTeamsLineupsAsync')) return Response.json(lineups(canFirst));
      if (url.includes('GetTeamLeagueTeamsMatchesAsync')) return Response.json(matches);
      if (url.includes('UpdateTeamLeagueLineupsAsync')) {
        posted.push({ body: JSON.parse(String(init?.body)), cookie: (init?.headers as Record<string, string>).Cookie });
        return Response.json([{ challengeId: 100 }]);
      }
      return new Response('nope', { status: 404 });
    }),
  );
  return posted;
}

const req = (body: unknown, cookie = 'rk_rin=rin-auth%3Dabc') =>
  new Request('https://app/api/lineup', { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify(body) });

afterEach(() => vi.unstubAllGlobals());

describe('POST /api/lineup', () => {
  it('saves only the changed match and keeps the opponent', async () => {
    const posted = mockRankedin();
    const res = await POST(req({ teamMatchId: 9, side: 'first', lineups: [{ challengeId: 100, playerIds: [1, 2] }] }));
    expect(res.status).toBe(200);
    expect(posted).toEqual([
      {
        body: { TeamMatchId: 9, MatchesLineups: [{ ChallengeId: 100, FirstTeamPlayerIds: [1, 2], SecondTeamPlayerIds: [70, 80] }] },
        cookie: 'rin-auth=abc',
      },
    ]);
  });
  it('refuses when the user is not captain of that side', async () => {
    const posted = mockRankedin(false);
    const res = await POST(req({ teamMatchId: 9, side: 'first', lineups: [{ challengeId: 100, playerIds: [1, 2] }] }));
    expect(res.status).toBe(403);
    expect(posted).toHaveLength(0);
  });
  it('rejects invalid lineups before calling Rankedin', async () => {
    const posted = mockRankedin();
    const res = await POST(req({ teamMatchId: 9, side: 'first', lineups: [{ challengeId: 100, playerIds: [1, 1] }] }));
    expect(res.status).toBe(400);
    expect(posted).toHaveLength(0);
  });
  it('requires login', async () => {
    mockRankedin();
    const res = await POST(req({ teamMatchId: 9, side: 'first', lineups: [] }, ''));
    expect(res.status).toBe(401);
  });
});
