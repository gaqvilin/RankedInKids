import { describe, expect, it } from 'vitest';
import { checkSplLineup, divisionLevel, isSplLeague, lineupDeadline, rankingPoints } from '../src/lib/spl';

describe('divisionLevel', () => {
  it('reads the division number', () => {
    expect(divisionLevel('Div 1 Sydväst')).toBe(1);
    expect(divisionLevel('Div 3 Sydväst - södra')).toBe(3);
    expect(divisionLevel('10-14 år Gul-södra')).toBeNull();
    expect(divisionLevel(null)).toBeNull();
  });
  it('knows SPL leagues', () => {
    expect(isSplLeague('SPL Swedish Padel League Herrar 2026-27')).toBe(true);
    expect(isSplLeague('Klubbligan Sydväst 10-14 år HT 26')).toBe(false);
  });
  it('gives ranking points per division', () => {
    expect(rankingPoints(1)).toEqual({ win: 2, loss: 0.5 });
    expect(rankingPoints(4)).toEqual({ win: 0.4, loss: 0.1 });
    expect(rankingPoints(null)).toBeNull();
  });
});

const pts = new Map<number, number | null>([
  [1, 400], [2, 380], [3, 300], [4, 280], [5, 200], [6, 150],
]);

describe('checkSplLineup', () => {
  it('accepts a correct division 1 lineup', () => {
    expect(checkSplLineup([{ playerIds: [1, 2] }, { playerIds: [3, 4] }, { playerIds: [5, 6] }], pts, 1)).toEqual([]);
  });
  it('flags wrong ranking order and reused players in division 1', () => {
    const w = checkSplLineup([{ playerIds: [5, 6] }, { playerIds: [1, 2] }, { playerIds: [1, 3] }], pts, 1);
    expect(w.join(' ')).toMatch(/Match 2 har högre rankingpoäng/);
    expect(w.join(' ')).toMatch(/bara spela en match/);
    expect(w.join(' ')).toMatch(/minst 6 olika/);
  });
  it('allows a free third match in division 2+', () => {
    expect(checkSplLineup([{ playerIds: [3, 4] }, { playerIds: [5, 6] }, { playerIds: [1, 2] }], pts, 2)).toEqual([]);
    expect(checkSplLineup([{ playerIds: [5, 6] }, { playerIds: [3, 4] }, { playerIds: [1, 2] }], pts, 3)).toHaveLength(1);
  });
  it('needs at least 4 players in division 2+', () => {
    expect(checkSplLineup([{ playerIds: [1, 2] }, { playerIds: [1, 2] }, { playerIds: [1, 2] }], pts, 2).join(' ')).toMatch(/minst 4/);
  });
  it('does nothing outside SPL', () => {
    expect(checkSplLineup([{ playerIds: [5, 6] }, { playerIds: [1, 2] }], pts, null)).toEqual([]);
  });
});

describe('lineupDeadline', () => {
  it('is 15 minutes before a known start time', () => {
    expect(lineupDeadline('2026-12-12T10:00:00')?.getHours()).toBe(9);
    expect(lineupDeadline('2026-12-12T10:00:00')?.getMinutes()).toBe(45);
    expect(lineupDeadline('2026-12-12T00:00:00')).toBeNull();
  });
});
