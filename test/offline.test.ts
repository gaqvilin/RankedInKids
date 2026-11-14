import { beforeEach, describe, expect, it, vi } from 'vitest';
import { currentSets, resultConflict } from '../api/_lib/result';
import { ApiError } from '../src/lib/api';
import { _reset, enqueue, flush, overwrite, queued } from '../src/lib/outbox';

describe('currentSets', () => {
  it('reads Rankedin games as arrays or "6,4," strings, [] when unplayed', () => {
    expect(currentSets({ FirstPlayerGames: [6, 4], SecondPlayerGames: [3, 6], Participant1Score: 1, Participant2Score: 1 })).toEqual([[6, 3], [4, 6]]);
    expect(currentSets({ Participant1Games: '6,6,', Participant2Games: '2,4,', Participant1Score: 2 })).toEqual([[6, 2], [6, 4]]);
    expect(currentSets({ FirstPlayerGames: [0, 0, 0], SecondPlayerGames: [0, 0, 0], Participant1Score: 0, Participant2Score: 0 })).toEqual([]);
  });
});

describe('resultConflict', () => {
  const played = { FirstPlayerGames: [6, 6], SecondPlayerGames: [2, 4], Participant1Score: 2, Participant2Score: 0 };
  it('no conflict when Rankedin still has what the phone saw', () => {
    expect(resultConflict({ FirstPlayerGames: [], SecondPlayerGames: [] }, [], [[6, 3]])).toBeNull();
    expect(resultConflict(played, [[6, 2], [6, 4]], [[6, 3], [6, 4]])).toBeNull();
  });
  it('no conflict when Rankedin already has exactly ours', () => {
    expect(resultConflict(played, [], [[6, 2], [6, 4]])).toBeNull();
  });
  it('conflict when someone else reported something else meanwhile', () => {
    expect(resultConflict(played, [], [[6, 3], [6, 3]])).toEqual([[6, 2], [6, 4]]);
  });
});

describe('outbox', () => {
  beforeEach(() => _reset());
  const item = (challengeId: number, sets: [number, number][] | null = [[6, 3]]) => ({ challengeId, sets, expected: [] as [number, number][], account: 7, title: 'A – B' });

  it('sends waiting results as the account that entered them, then forgets them', async () => {
    enqueue(item(1));
    enqueue(item(2, null));
    const send = vi.fn(async () => {});
    expect(await flush(send)).toBe(2);
    expect(send).toHaveBeenCalledWith(1, [[6, 3]], { expected: [], account: 7 });
    expect(send).toHaveBeenCalledWith(2, null, { expected: [], account: 7 });
    expect(queued()).toEqual([]);
  });

  it('keeps everything while the network is still down', async () => {
    enqueue(item(1));
    const send = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    expect(await flush(send)).toBe(0);
    expect(queued()[0].state).toBe('waiting');
  });

  it('marks a conflict with what Rankedin has, and overwrite sends ours against that', async () => {
    enqueue(item(1));
    const err = Object.assign(new ApiError('x', 409, 'conflict'), { current: [[6, 2]] });
    await flush(vi.fn(async () => Promise.reject(err)));
    expect(queued()[0]).toMatchObject({ state: 'conflict', current: [[6, 2]] });
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })));
    overwrite(1);
    await flush();
    expect(queued()).toEqual([]);
    vi.unstubAllGlobals();
  });

  it('a newer entry for the same match replaces the older one', () => {
    enqueue(item(1, [[6, 3]]));
    enqueue(item(1, [[3, 6]]));
    expect(queued()).toHaveLength(1);
    expect(queued()[0].sets).toEqual([[3, 6]]);
  });
});
