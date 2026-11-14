import { describe, expect, it } from 'vitest';
import { buildMove, DrawError, moveMatch, toPlanner } from '../api/_lib/draws';
import type { Call } from '../api/_lib/pairing';
import real from './fixtures/planner-75555.json';

const REKLAM = 195840;
const CRAMO = 195838;

/** Fake Rankedin court planner built from a real (public) snapshot of tournament 75555; MultiMoveMatch moves the cell. */
function fake(opts: { ignoreMove?: boolean } = {}) {
  const usage = structuredClone(real.usage) as Record<string, any>[];
  const posts: { path: string; body: any }[] = [];
  const call: Call = async (method, path, body) => {
    const p = path.split('?')[0];
    if (method === 'GET') {
      if (p === 'Tournament/GetTimetableDatesAsync') return { ok: true, status: 200, data: real.dates };
      if (p === 'Tournament/GetTournamentTimetableInfoAsync/') return { ok: true, status: 200, data: real.info };
      return { ok: false, status: 404, data: null };
    }
    posts.push({ path: p, body });
    if (p === 'Tournament/GetCourtPlannerAsync') return { ok: true, status: 200, data: real.planner };
    if (p === 'Tournament/GetCourtUsageAsync') return { ok: true, status: 200, data: usage };
    if (p === 'tournament/MultiMoveMatchAsync' && !opts.ignoreMove) {
      for (const m of body as any[]) {
        const u = usage.find((x) => x.TournamentMatchId === m.TournamentMatchId)!;
        u.CourtId = m.TargetCourtId;
        u.MatchDate = m.TargetDateTime;
      }
    }
    return { ok: true, status: 200, data: null };
  };
  return { call, posts };
}

describe('court planner', () => {
  const p = toPlanner(real.dates, real.planner, real.usage, real.info);

  it('reads courts by name and the day slots 10:00–17:00 every 60 min', () => {
    expect(p.date).toBe('2026-11-14');
    expect(p.courts.map((c) => c.name)).toEqual(['Cramo', 'Hasselströms Bygg AB', 'Reklamkungen', 'Ludz', 'Bana 5']);
    expect(p.slots).toEqual(['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00']);
    expect(p.busy).toContainEqual({ courtId: CRAMO, time: '10:00', challengeId: 7064215 });
  });

  it('builds exactly the body Rankedin posts for a drop on a free cell', () => {
    const body = buildMove(75555, p, real.usage, 7064239, REKLAM, '17:00');
    const tm = real.usage.find((u) => u.ChallengeId === 7064239)!.TournamentMatchId;
    expect(body).toEqual([
      { TargetShowDate: '2026-11-14', TournamentMatchId: tm, TargetCourtId: REKLAM, TargetDateTime: '2026-11-14T17:00:00', TargetNoschedulecourtpos: 0, TournamentId: 75555 },
    ]);
  });

  it('refuses taken cells, unknown courts and times outside the day', () => {
    expect(() => buildMove(75555, p, real.usage, 7064239, CRAMO, '10:00')).toThrow(DrawError);
    expect(() => buildMove(75555, p, real.usage, 7064239, 1, '17:00')).toThrow(/Banan finns inte/);
    expect(() => buildMove(75555, p, real.usage, 7064239, REKLAM, '18:00')).toThrow(/utanför/);
    expect(() => buildMove(75555, p, real.usage, 1, REKLAM, '17:00')).toThrow(/finns inte i banplaneringen/);
  });

  it('moves, then reads back that the match is there', async () => {
    const f = fake();
    await moveMatch(f.call, 75555, 7064239, REKLAM, '17:00');
    expect(f.posts.filter((x) => x.path === 'tournament/MultiMoveMatchAsync')).toHaveLength(1);
  });

  it('reports when Rankedin accepted but the match did not move', async () => {
    const f = fake({ ignoreMove: true });
    await expect(moveMatch(f.call, 75555, 7064239, REKLAM, '17:00')).rejects.toThrow(/ligger inte där/);
  });
});
