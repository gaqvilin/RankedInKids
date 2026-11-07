import { describe, expect, it } from 'vitest';
import { appearances, buildLineupPayload, validateLineup } from '../api/_lib/lineup';

const roster = [
  { id: 1, name: 'Anna' },
  { id: 2, name: 'Bea' },
  { id: 3, name: 'Cia' },
  { id: 4, name: 'Disa' },
];

describe('validateLineup', () => {
  it('accepts complete doubles pairs', () => {
    expect(validateLineup([{ challengeId: 10, playerIds: [1, 2] }, { challengeId: 11, playerIds: [3, 4] }], { matchType: 3, roster })).toBeNull();
  });
  it('rejects a missing partner and duplicates', () => {
    expect(validateLineup([{ challengeId: 10, playerIds: [1, 0] }], { matchType: 3, roster })).toMatch(/saknar partner/);
    expect(validateLineup([{ challengeId: 10, playerIds: [1, 1] }], { matchType: 3, roster })).toMatch(/två gånger/);
  });
  it('rejects players outside the team', () => {
    expect(validateLineup([{ challengeId: 10, playerIds: [1, 99] }], { matchType: 3, roster })).toMatch(/finns inte/);
  });
  it('can require every match to be filled', () => {
    expect(validateLineup([{ challengeId: 10, playerIds: [0, 0] }], { matchType: 3, requireComplete: true })).toMatch(/välj två/);
    expect(validateLineup([{ challengeId: 10, playerIds: [0, 0] }], { matchType: 3 })).toBeNull();
  });
  it('handles singles match types', () => {
    expect(validateLineup([{ challengeId: 10, playerIds: [1] }], { matchType: 1, roster })).toBeNull();
  });
});

describe('buildLineupPayload', () => {
  const current = [
    { challengeId: 10, firstTeamPlayerIds: [0, 0], secondTeamPlayerIds: [7, 8] },
    { challengeId: 11, firstTeamPlayerIds: [3, 4], secondTeamPlayerIds: [0, 0] },
  ];
  it('keeps the opponent and sends only changed matches', () => {
    expect(buildLineupPayload(5, 'first', current, [{ challengeId: 10, playerIds: [1, 2] }], 3)).toEqual({
      TeamMatchId: 5,
      MatchesLineups: [{ ChallengeId: 10, FirstTeamPlayerIds: [1, 2], SecondTeamPlayerIds: [7, 8] }],
    });
  });
  it('writes the second team side', () => {
    const p = buildLineupPayload(5, 'second', current, [{ challengeId: 11, playerIds: [1, 2] }], 3);
    expect(p.MatchesLineups).toEqual([{ ChallengeId: 11, FirstTeamPlayerIds: [3, 4], SecondTeamPlayerIds: [1, 2] }]);
  });
});

describe('appearances', () => {
  it('counts matches per player', () => {
    const a = appearances([{ challengeId: 1, playerIds: [1, 2] }, { challengeId: 2, playerIds: [1, 3] }]);
    expect(a.get(1)).toBe(2);
    expect(a.get(3)).toBe(1);
  });
});
