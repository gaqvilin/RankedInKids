import { afterEach, describe, expect, it, vi } from 'vitest';
import { getClassPlayoff, groupDone, playoffAsMatches, resolvePlayoffSide, type DrawGroup, type PlayoffSide } from '../src/lib/rankedin';
import placement from './fixtures/playoff-placement.json';

const pair = (i: number, names: string[], ids: number[]) => ({ index: i, names, ids });
const row = (position: number, ids: number[], played: number, names = ids.map((id) => `P${id} X`)) => ({
  position,
  names,
  ids,
  played,
  wins: 0,
  draws: 0,
  losses: 0,
  points: 0,
  gamesWon: 0,
  gamesLost: 0,
});
const group = (name: string, played: number): DrawGroup => ({
  name,
  pairs: [pair(1, ['a'], [1, 2]), pair(2, ['b'], [3, 4]), pair(3, ['c'], [5, 6])],
  cells: {},
  standings: [row(1, [3, 4], played), row(2, [1, 2], played), row(3, [5, 6], played)],
});
const slot = (g: string, place: number): PlayoffSide => ({ names: [], ids: [], group: g, place });

afterEach(() => vi.unstubAllGlobals());

describe('getClassPlayoff', () => {
  it('reads a placement draw: A#1–B#1 plays for 1–2, A#2–B#2 for 3–4', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(placement))));
    const list = await getClassPlayoff(178910);
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({ places: [1, 2], court: 'Ludz', date: '2026-11-14T14:00:00' });
    expect(list[0].sides[0]).toEqual({ names: [], ids: [], group: 'A', place: 1 });
    expect(list[0].sides[1]).toMatchObject({ group: 'B', place: 1 });
    expect(list[1]).toMatchObject({ places: [3, 4] });
  });
  it('is empty when the class has no playoff', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('[]')));
    expect(await getClassPlayoff(1)).toEqual([]);
  });
});

describe('resolvePlayoffSide', () => {
  it('names the pair once the group is done', () => {
    const g = group('Grupp A', 2);
    expect(groupDone(g)).toBe(true);
    expect(resolvePlayoffSide(slot('A', 1), [g])).toMatchObject({ ids: [3, 4], label: '1:a grupp A', provisional: false });
    expect(resolvePlayoffSide(slot('A', 3), [g])).toMatchObject({ ids: [5, 6], label: '3:e grupp A' });
  });
  it('shows the current holder as provisional while the group is playing', () => {
    const g = group('Grupp A', 1);
    expect(resolvePlayoffSide(slot('A', 1), [g])).toMatchObject({ ids: [3, 4], provisional: true });
  });
  it('keeps the placeholder before any match is played', () => {
    expect(resolvePlayoffSide(slot('B', 2), [group('Grupp B', 0)])).toMatchObject({ names: [], label: '2:a grupp B' });
  });
  it('keeps real players as they are', () => {
    const real: PlayoffSide = { names: ['Aron A'], ids: [9], group: null, place: null };
    expect(resolvePlayoffSide(real, [])).toMatchObject({ names: ['Aron A'], label: null });
  });
});

describe('playoffAsMatches', () => {
  it('shows scheduled playoff matches with court and time; undecided pairs by place', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(placement))));
    const [final, third] = playoffAsMatches('Pojkar 12 Step In', await getClassPlayoff(178911));
    expect(final).toMatchObject({ id: 7064227, draw: 'Final', court: 'Ludz', date: '2026-11-14T14:00:00', played: false, canEnterResult: false, upcoming: true });
    expect(final.sides.map((s) => s.names)).toEqual([['1:a grupp A'], ['1:a grupp B']]);
    expect(third.draw).toBe('Om plats 3–4');
  });
});
