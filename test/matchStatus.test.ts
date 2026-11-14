import { describe, expect, it } from 'vitest';
import { matchStatus } from '../src/lib/matchStatus';
import type { TournamentMatch } from '../src/lib/rankedin';

const m = (id: number, time: string, court: string, a: number[], b: number[], played = false): TournamentMatch => ({
  id,
  date: `2026-11-14T${time}:00`,
  court,
  className: 'P16',
  draw: '',
  sides: [
    { names: [], ids: a, isWinner: false },
    { names: [], ids: b, isWinner: false },
  ],
  sets: [],
  played,
  canEnterResult: true,
  awaitingConfirmation: false,
});
const at = (t: string) => Date.parse(`2026-11-14T${t}:00`);

describe('matchStatus', () => {
  const list = [
    m(1, '12:00', 'Hasselströms', [1, 2], [3, 4]), // still unreported at 13:10
    m(2, '13:00', 'Reklamkungen', [3, 4], [5, 6]), // 3/4 still in match 1
    m(3, '13:00', 'Ludz', [7, 8], [9, 10]), // free players and court
    m(4, '13:00', 'Hasselströms', [11, 12], [13, 14]), // court still taken by match 1
    m(5, '14:00', 'Cramo', [15, 16], [17, 18]), // not started
    m(6, '12:00', 'Cramo', [19, 20], [21, 22], true), // played
  ];
  it('a pair still in an earlier match, or a court still in use, means waiting – not live', () => {
    const s = matchStatus(list, at('13:10'));
    expect(s.get(1)).toBe('live');
    expect(s.get(2)).toBe('waiting');
    expect(s.get(3)).toBe('live');
    expect(s.get(4)).toBe('waiting');
    expect(s.has(5)).toBe(false);
    expect(s.has(6)).toBe(false);
  });
  it('once the earlier match is reported, the next one is live', () => {
    const s = matchStatus(list.map((x) => (x.id === 1 ? { ...x, played: true } : x)), at('13:10'));
    expect(s.get(2)).toBe('live');
    expect(s.get(4)).toBe('live');
  });
  it('after 90 minutes without a result a match no longer blocks', () => {
    const s = matchStatus(list, at('13:40'));
    expect(s.has(1)).toBe(false);
    expect(s.get(2)).toBe('live');
  });
});
