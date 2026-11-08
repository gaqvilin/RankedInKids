import { describe, expect, it } from 'vitest';
import { pairPlayers, parseEntries, unpairPlayers, type Call } from '../api/_lib/pairing';

type Row = { id: number; tpid: number; p1: number; p2: number; draw?: boolean };
/** A fake Rankedin that behaves like the admin UI expects. */
function fakeRankedin(rows: Row[], opts: { rejectUpdate?: boolean; updateRemovesSingle?: boolean; rejectSignIn?: boolean } = {}) {
  let nextId = 100;
  const calls: string[] = [];
  const name = (id: number) => `P${id}`;
  const settings = () => ({
    SelectedTournamentClass: 7,
    Participants: rows.map((r) => ({
      Id: r.id,
      IsDrawCreated: !!r.draw,
      IsAnyMatchGenerated: false,
      Participant: { TournamentPlayerId: r.tpid, FirstPlayer: { Id: r.p1, Name: name(r.p1) }, SecondPlayer: { Id: r.p2, Name: r.p2 ? name(r.p2) : '' } },
    })),
  });
  const call: Call = async (method, path, body) => {
    calls.push(`${method} ${path.split('?')[0]}`);
    const b = body as Record<string, any>;
    if (method === 'GET') return { ok: true, status: 200, data: settings() };
    if (path === 'Tournament/UpdateDoubleAsync') {
      if (opts.rejectUpdate) return { ok: false, status: 400, data: null };
      const r = rows.find((x) => x.id === b.id)!;
      r.p2 = b.player2Id;
      if (opts.updateRemovesSingle) rows = rows.filter((x) => !(x.p1 === b.player2Id && !x.p2));
      return { ok: true, status: 200, data: null };
    }
    if (path === 'Tournament/RemoveParticipantAsync') {
      rows = rows.filter((x) => x.tpid !== b.tournamentPlayerId);
      return { ok: true, status: 200, data: null };
    }
    if (path === 'Tournament/MultiSignInDoublesAsync') {
      if (opts.rejectSignIn) return { ok: false, status: 400, data: null };
      for (const c of b.addedInvitedCouples) rows.push({ id: nextId, tpid: nextId++, p1: c[0].PlayerId, p2: c[1].PlayerId ?? 0 });
      return { ok: true, status: 200, data: { ok: true } };
    }
    return { ok: false, status: 404, data: null };
  };
  return { call, calls, rows: () => rows };
}

describe('parseEntries', () => {
  it('reads PascalCase and camelCase', () => {
    const e = parseEntries({ participants: [{ id: 1, participant: { tournamentPlayerId: 9, firstPlayer: { id: 5, name: 'A' }, secondPlayer: { id: 0 } } }] });
    expect(e).toEqual([{ entryId: 1, tournamentPlayerId: 9, player1: { id: 5, name: 'A' }, player2: null, drawCreated: false }]);
  });
});

describe('pairPlayers', () => {
  it('puts B on A’s entry and removes B’s single entry', async () => {
    const f = fakeRankedin([
      { id: 1, tpid: 11, p1: 5, p2: 0 },
      { id: 2, tpid: 12, p1: 6, p2: 0 },
      { id: 3, tpid: 13, p1: 7, p2: 8 },
    ]);
    const after = await pairPlayers(f.call, 99, 7, 5, 6);
    expect(after.map((e) => [e.player1?.id, e.player2?.id ?? 0])).toEqual([
      [5, 6],
      [7, 8],
    ]);
    expect(f.calls).toContain('POST Tournament/UpdateDoubleAsync');
    expect(f.calls).toContain('POST Tournament/RemoveParticipantAsync');
  });
  it('does not remove anything if Rankedin already merged the entries', async () => {
    const f = fakeRankedin(
      [
        { id: 1, tpid: 11, p1: 5, p2: 0 },
        { id: 2, tpid: 12, p1: 6, p2: 0 },
      ],
      { updateRemovesSingle: true },
    );
    await pairPlayers(f.call, 99, 7, 5, 6);
    expect(f.calls).not.toContain('POST Tournament/RemoveParticipantAsync');
  });
  it('changes nothing when Rankedin rejects', async () => {
    const f = fakeRankedin([
      { id: 1, tpid: 11, p1: 5, p2: 0 },
      { id: 2, tpid: 12, p1: 6, p2: 0 },
    ], { rejectUpdate: true });
    await expect(pairPlayers(f.call, 99, 7, 5, 6)).rejects.toMatchObject({ code: 'rejected' });
    expect(f.rows()).toHaveLength(2);
    expect(f.calls).not.toContain('POST Tournament/RemoveParticipantAsync');
  });
  it('refuses after the draw', async () => {
    const f = fakeRankedin([
      { id: 1, tpid: 11, p1: 5, p2: 0, draw: true },
      { id: 2, tpid: 12, p1: 6, p2: 0 },
    ]);
    await expect(pairPlayers(f.call, 99, 7, 5, 6)).rejects.toMatchObject({ code: 'draw_exists' });
    expect(f.calls.filter((c) => c.startsWith('POST'))).toEqual([]);
  });
  it('adds a player who is not entered in the class as partner', async () => {
    const f = fakeRankedin([
      { id: 1, tpid: 11, p1: 5, p2: 0 },
      { id: 3, tpid: 13, p1: 7, p2: 8 },
    ]);
    const after = await pairPlayers(f.call, 99, 7, 5, 42);
    expect(after.find((e) => e.entryId === 1)?.player2?.id).toBe(42);
    expect(f.calls).not.toContain('POST Tournament/RemoveParticipantAsync');
  });
  it('refuses a partner who already plays in another pair', async () => {
    const f = fakeRankedin([
      { id: 1, tpid: 11, p1: 5, p2: 0 },
      { id: 3, tpid: 13, p1: 7, p2: 8 },
    ]);
    await expect(pairPlayers(f.call, 99, 7, 5, 8)).rejects.toMatchObject({ code: 'b_not_single' });
  });
  it('refuses players that already have a partner', async () => {
    const f = fakeRankedin([
      { id: 1, tpid: 11, p1: 5, p2: 9 },
      { id: 2, tpid: 12, p1: 6, p2: 0 },
    ]);
    await expect(pairPlayers(f.call, 99, 7, 5, 6)).rejects.toMatchObject({ code: 'a_not_single' });
  });
});

describe('unpairPlayers', () => {
  it('removes the pair and adds both back without partner', async () => {
    const f = fakeRankedin([{ id: 1, tpid: 11, p1: 5, p2: 6 }]);
    const after = await unpairPlayers(f.call, 99, 7, 1);
    expect(after.map((e) => [e.player1?.id, e.player2?.id ?? 0]).sort()).toEqual([
      [5, 0],
      [6, 0],
    ]);
  });
  it('restores the pair if they cannot be added back', async () => {
    const f = fakeRankedin([{ id: 1, tpid: 11, p1: 5, p2: 6 }], { rejectSignIn: true });
    await expect(unpairPlayers(f.call, 99, 7, 1)).rejects.toMatchObject({ code: 'partly' });
  });
  it('pair then unpair round-trips', async () => {
    const f = fakeRankedin([
      { id: 1, tpid: 11, p1: 5, p2: 0 },
      { id: 2, tpid: 12, p1: 6, p2: 0 },
    ]);
    const paired = await pairPlayers(f.call, 99, 7, 5, 6);
    const back = await unpairPlayers(f.call, 99, 7, paired[0].entryId);
    expect(back.filter((e) => !e.player2).map((e) => e.player1?.id).sort()).toEqual([5, 6]);
  });
});
