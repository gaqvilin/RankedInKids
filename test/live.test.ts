import { describe, expect, it } from 'vitest';
import { tennisPoints, toScoreView, type LiveScore } from '../src/lib/live';

const s = (a: number, b: number, detailed?: LiveScore[] | null, extra: Partial<LiveScore> = {}): LiveScore => ({
  firstParticipantScore: a,
  secondParticipantScore: b,
  detailedResult: detailed ?? null,
  ...extra,
});

describe('tennisPoints', () => {
  it('maps points', () => {
    expect(tennisPoints(0, 0)).toEqual(['0', '0']);
    expect(tennisPoints(2, 1)).toEqual(['30', '15']);
    expect(tennisPoints(3, 3)).toEqual(['40', '40']);
    expect(tennisPoints(4, 3)).toEqual(['AD', '40']);
  });
});

describe('toScoreView', () => {
  it('handles no score', () => {
    expect(toScoreView(null).points).toEqual(['0', '0']);
  });
  it('reads sets, games and points', () => {
    const score = s(1, 0, [s(6, 3), s(2, 1, [s(1, 0), s(1, 1), s(0, 0), s(2, 3)])]);
    const v = toScoreView(score);
    expect(v.sets).toEqual([
      [6, 3],
      [2, 1],
    ]);
    expect(v.points).toEqual(['30', '40']);
    expect(v.setsWon).toEqual([1, 0]);
  });
  it('shows tiebreak points as numbers', () => {
    const score = s(0, 0, [s(6, 6, [s(5, 4, null, { isTieBreak: true })], { isTieBreak: true })]);
    const v = toScoreView(score);
    expect(v.inTiebreak).toBe(true);
    expect(v.points).toEqual(['5', '4']);
  });
  it('shows a super tiebreak as points, not as a set', () => {
    const score = s(1, 1, [s(6, 3), s(4, 6), s(7, 5, null, { isSuperTieBreak: true })]);
    const v = toScoreView(score);
    expect(v.sets).toHaveLength(2);
    expect(v.points).toEqual(['7', '5']);
  });
});
