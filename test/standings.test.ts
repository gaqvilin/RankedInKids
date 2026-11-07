import { describe, expect, it } from 'vitest';
import { standings } from '../src/lib/standings';

const side = (ids: number[], isWinner: boolean) => ({ ids, names: ids.map(String), isWinner });

describe('standings', () => {
  it('ranks by wins then set and game difference', () => {
    const rows = standings([
      { sides: [side([1, 2], true), side([3, 4], false)], sets: [[6, 1]], played: true },
      { sides: [side([5, 6], true), side([1, 2], false)], sets: [[6, 4]], played: true },
      { sides: [side([3, 4], false), side([5, 6], true)], sets: [[2, 6]], played: true },
    ]);
    expect(rows.map((r) => r.key)).toEqual(['5-6', '1-2', '3-4']);
    expect(rows[0]).toMatchObject({ played: 2, won: 2 });
  });
  it('lists pairs with unplayed matches', () => {
    const rows = standings([{ sides: [side([1, 2], false), side([3, 4], false)], sets: [], played: false }]);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.played === 0)).toBe(true);
  });
});
