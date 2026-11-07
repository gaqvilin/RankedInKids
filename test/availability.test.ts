import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from '../api/availability';
import { MemoryStore, setStore } from '../api/_lib/store';

// Rankedin mock: two sessions (parent = team leader, kid = player) and one team.
const layouts: Record<string, object> = {
  'rin-auth=lead': { IsAuthenticated: true, CurrentPlayerId: 900, RankedinId: 'R000000900', FirstName: 'Lena', LastName: 'Ledare' },
  'rin-auth=kid': { IsAuthenticated: true, CurrentPlayerId: 10, RankedinId: 'R000000010', FirstName: 'Kim', LastName: 'Kid' },
  'rin-auth=other': { IsAuthenticated: true, CurrentPlayerId: 77, RankedinId: 'R000000077', FirstName: 'Otto', LastName: 'Annan' },
};
const team = {
  team: {
    id: 5,
    name: 'Testlaget',
    initiator: [{ playerUrl: '/sv/player/R000000900/lena' }],
    players: [
      { id: 10, rankedinId: 'R000000010', firstName: 'Kim', lastName: 'Kid' },
      { id: 11, rankedinId: 'R000000011', firstName: 'Bo', lastName: 'Back' },
    ],
  },
};

beforeEach(() => {
  setStore(new MemoryStore());
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('GetLayoutInfoAsync')) return Response.json(layouts[String((init?.headers as Record<string, string>).Cookie)] ?? { IsAuthenticated: false });
      if (url.includes('GetTeamLeagueTeamHomepageAsync')) return Response.json(team);
      return new Response('', { status: 404 });
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  setStore(null);
});

const cookie = (...ids: [number, string][]) => ids.map(([id, v]) => `rk_rin_${id}=${encodeURIComponent(v)}`).join('; ');
const post = (c: string, body: object) =>
  POST(new Request('https://app/api/availability', { method: 'POST', headers: { cookie: c, 'content-type': 'application/json' }, body: JSON.stringify(body) }));
const get = (c: string) => GET(new Request('https://app/api/availability?teamId=5&date=2026-12-12', { headers: { cookie: c } }));

describe('availability', () => {
  it('lets a player answer for themselves and the team read it', async () => {
    const res = await post(cookie([10, 'rin-auth=kid']), { teamId: 5, date: '2026-12-12', playerId: 10, status: 'yes' });
    expect(res.status).toBe(200);
    const data = await (await get(cookie([10, 'rin-auth=kid']))).json();
    expect(data.entries).toMatchObject([{ playerId: 10, status: 'yes', updatedBy: 'Kim Kid' }]);
    expect(data.isCaptain).toBe(false);
  });
  it('lets a player not answer for a teammate', async () => {
    const res = await post(cookie([10, 'rin-auth=kid']), { teamId: 5, date: '2026-12-12', playerId: 11, status: 'no' });
    expect(res.status).toBe(403);
  });
  it('lets the team leader answer for anyone', async () => {
    const res = await post(cookie([900, 'rin-auth=lead']), { teamId: 5, date: '2026-12-12', playerId: 11, status: 'maybe', comment: 'sen' });
    expect(res.status).toBe(200);
    expect((await (await get(cookie([900, 'rin-auth=lead']))).json()).isCaptain).toBe(true);
  });
  it('keeps outsiders and forged cookies out', async () => {
    expect((await get(cookie([77, 'rin-auth=other']))).status).toBe(403);
    // Cookie *name* says player 10, but Rankedin says the session belongs to Otto.
    expect((await post(cookie([10, 'rin-auth=other']), { teamId: 5, date: '2026-12-12', playerId: 10, status: 'yes' })).status).toBe(403);
    expect((await get('')).status).toBe(401);
  });
  it('validates input', async () => {
    expect((await post(cookie([10, 'rin-auth=kid']), { teamId: 5, date: '12/12', playerId: 10, status: 'yes' })).status).toBe(400);
    expect((await post(cookie([10, 'rin-auth=kid']), { teamId: 5, date: '2026-12-12', playerId: 10, status: 'kanske' })).status).toBe(400);
  });
});
