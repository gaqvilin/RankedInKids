import { describe, expect, it } from 'vitest';
import { buildSubmitPayload, summarizeSets } from '../api/_lib/result';

describe('summarizeSets', () => {
  it('counts sets won', () => {
    expect(summarizeSets([[6, 3], [4, 6], [10, 8]])).toEqual({ p1: 2, p2: 1 });
  });
  it('accepts a single super tiebreak', () => {
    expect(summarizeSets([[7, 10]])).toEqual({ p1: 0, p2: 1 });
  });
  it('rejects ties and empty input', () => {
    expect(() => summarizeSets([])).toThrow();
    expect(() => summarizeSets([[5, 5]])).toThrow();
    expect(() => summarizeSets([[6, 3], [3, 6]])).toThrow(/supertiebreak/); // Rankedin has no draws
    expect(() => summarizeSets([[6, 3], [3, 6], [6, 6]])).toThrow();
    expect(() => summarizeSets([[6, 3], [3, 6], [4, 6], [6, 4]])).toThrow();
  });
});

describe('buildSubmitPayload', () => {
  it('mirrors the rankedin.com enter-result model', () => {
    const p = buildSubmitPayload(
      42,
      { Participant1ID: 11, Participant2ID: 22, CurrentPlayerId: 7 },
      [
        [6, 4],
        [3, 6],
        [10, 7],
      ],
    );
    expect(p).toMatchObject({
      challengeId: 42,
      participant1Score: 2,
      participant2Score: 1,
      participant1Games: '6,3,10,',
      participant2Games: '4,6,7,',
      participant1ID: 11,
      participant2ID: 22,
      currPlayerId: 7,
      reset: false,
    });
  });
  it('reads camelCase too', () => {
    const p = buildSubmitPayload(1, { participant1ID: 5, participant2ID: 6, currentPlayerId: 9 }, [[6, 0]]);
    expect([p.participant1ID, p.participant2ID, p.currPlayerId]).toEqual([5, 6, 9]);
  });
});

import { buildResetPayload } from '../api/_lib/result';

describe('buildResetPayload', () => {
  it('mirrors Rankedin reset: reset true, empty score, current player kept', () => {
    expect(buildResetPayload(7064231, { CurrentPlayerId: 42 })).toEqual({
      challengeId: 7064231,
      participant1CancellationType: 0,
      participant2CancellationType: 0,
      reset: true,
      participant1Score: 0,
      participant2Score: 0,
      participant1Games: '',
      participant2Games: '',
      setDuration: '',
      duration: false,
      games: false,
      currPlayerId: 42,
    });
  });
});
