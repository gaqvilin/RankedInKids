import { describe, expect, it } from 'vitest';
import { drawOnePool, drawPools, loadStatus, publish, saveTimes, unpublish } from '../api/_lib/draws';
import type { Call } from '../api/_lib/pairing';

/** Fake Rankedin admin API with PascalCase answers, recording posts. */
function fake(state: Partial<{ generated: boolean; drawType: number; creatorDraws: unknown[]; matchesPublished: boolean; saveSetsType: boolean; publishFails: boolean }> = {}) {
  const s = { generated: false, drawType: 0, creatorDraws: [] as unknown[], matchesPublished: false, saveSetsType: true, publishFails: false, ...state };
  const posts: { path: string; body: any }[] = [];
  const call: Call = async (method, path, rawBody) => {
    const body = rawBody as any;
    const p = path.split('?')[0];
    if (method === 'GET') {
      const data: Record<string, unknown> = {
        'tournament/GetDrawsSettingsAsync': { DrawTypeIndex: s.drawType, AreMatchesGeneratedForSelectedClass: s.generated, IsSeedingValid: true, SelectedClassParticipantsCount: 7, EL: { Plates: 0, Playoffs: 0 } },
        'tournament/GetDrawCreatorDataAsync': { Draws: s.creatorDraws, AvailableParticipants: Array.from({ length: 7 }, (_, i) => ({ ParticipantId: i + 1, Name: `Par ${i + 1}`, InitialOrder: i + 1, RankingPosition: 0, LowSeed: 0, HighSeed: 0 })) },
        'tournament/MatchesSettingsAsync': { AreMatchesPublished: s.matchesPublished, AllDrawsArePublished: false, AllMatchesHaveCourt: true },
        'tournament/GetCloseSignInInfoAsync': { Classes: [{ TournamentClassId: 9, TournamentClassName: 'P12', IsSignInOpen: true }] },
        'tournament/GetClassesForSchedulingAsync': [{ Id: 9, Name: 'P12', IsScheduled: false, AreDrawsGenerated: s.generated }],
        'tournament/GetCourtsAsync': [{ Id: 1, CourtName: 'Bana 1' }],
        'tournament/GetTimeSettingsAsync': { SettingsCollection: [{ Day: '2026-11-14T00:00:00', SettingsId: 5, StartTime: '1900-01-01T09:00:00', EndTime: '1900-01-01T17:00:00', Duration: 30, MaxCourts: 2, MinBreak: 30 }], SchedulingAdvancedSettings: [{ ClassId: 9 }] },
      };
      return { ok: true, status: 200, data: data[p] ?? null };
    }
    posts.push({ path: p, body });
    if (p === 'tournament/DrawsSettingsAsync') s.drawType = body.DrawTypeIndex;
    if (p === 'tournament/SaveDrawCreatorAsync' && s.saveSetsType) s.drawType = 99;
    if (p === 'tournament/GenerateMatchesAsync') s.generated = true;
    if (p === 'tournament/PublishMatchesAsync') {
      if (s.publishFails) return { ok: false, status: 400, data: { Code: 3 } };
      s.matchesPublished = !s.matchesPublished;
    }
    return { ok: true, status: 200, data: null };
  };
  return { call, posts, s };
}

describe('draws', () => {
  it('reads status with PascalCase answers', async () => {
    const f = fake();
    const st = await loadStatus(f.call, 1);
    expect(st.classes[0]).toMatchObject({ classId: 9, name: 'P12', signInOpen: true, generated: false });
    expect(st.days[0]).toMatchObject({ settingsId: 5, startTime: '09:00', endTime: '17:00', duration: 30 });
    expect(st.courts).toEqual([{ id: 1, name: 'Bana 1' }]);
  });
  it('one pool: sets round robin then generates', async () => {
    const f = fake();
    await drawOnePool(f.call, 1, 9);
    expect(f.posts.map((p) => p.path)).toEqual(['tournament/DrawsSettingsAsync', 'tournament/GenerateMatchesAsync']);
    expect(f.posts[0].body).toMatchObject({ TournamentId: 1, DrawTypeIndex: 1, TournamentClassId: 9 });
  });
  it('pools: saves a multi round robin with every pair, then generates', async () => {
    const f = fake();
    await drawPools(f.call, 1, 9, 2);
    const save = f.posts.find((p) => p.path === 'tournament/SaveDrawCreatorAsync')!.body;
    expect(save.draws[0]).toMatchObject({ type: 12, poolsCount: 2, size: 7, poolsNames: ['Grupp A', 'Grupp B'] });
    expect(save.draws[0].players).toHaveLength(7);
    expect(f.posts.at(-1)!.path).toBe('tournament/GenerateMatchesAsync');
  });
  it('pools: stops before generating if Rankedin did not get a draw type', async () => {
    const f = fake({ saveSetsType: false });
    await expect(drawPools(f.call, 1, 9, 2)).rejects.toMatchObject({ code: 'no_type' });
    expect(f.posts.map((p) => p.path)).not.toContain('tournament/GenerateMatchesAsync');
  });
  it('never regenerates an existing draw', async () => {
    const f = fake({ generated: true });
    await expect(drawOnePool(f.call, 1, 9)).rejects.toMatchObject({ code: 'already' });
    await expect(drawPools(f.call, 1, 9, 2)).rejects.toMatchObject({ code: 'already' });
    expect(f.posts).toEqual([]);
  });
  it('publish only toggles matches on when they are off', async () => {
    const off = fake();
    await publish(off.call, 1);
    expect(off.s.matchesPublished).toBe(true);
    const on = fake({ matchesPublished: true });
    await publish(on.call, 1);
    expect(on.s.matchesPublished).toBe(true);
    expect(on.posts.map((p) => p.path)).not.toContain('tournament/PublishMatchesAsync');
    await unpublish(on.call, 1);
    expect(on.s.matchesPublished).toBe(false);
  });
  it('explains Rankedin error codes in Swedish', async () => {
    const f = fake({ publishFails: true });
    await expect(publish(f.call, 1)).rejects.toThrow(/fel läge/);
  });
  it('saves edited times on the full model', async () => {
    const f = fake();
    await saveTimes(f.call, 1, [{ settingsId: 5, startTime: '08:30', endTime: '16:00', duration: 40, maxCourts: 4, breakFactor: 1 }]);
    const body = f.posts[0].body;
    expect(body.TimeSettingsCollection[0]).toMatchObject({ StartTime: '08:30', EndTime: '16:00', Duration: 40, MaxCourts: 4, MinBreak: 40, IsChanged: true });
    expect(body.AdvancedSettingsCollection).toEqual([{ ClassId: 9 }]);
    await expect(saveTimes(f.call, 1, [{ settingsId: 5, startTime: '16:00', endTime: '08:00', duration: 40, maxCourts: 4, breakFactor: 1 }])).rejects.toMatchObject({ code: 'bad_time' });
  });
});
