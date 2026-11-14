import { describe, expect, it } from 'vitest';
import { boardColumns } from '../src/components/MatchBoard';
import type { TournamentMatch } from '../src/lib/rankedin';

const m = (id: number, date: string | null, court: string): TournamentMatch => ({
  id,
  date,
  court,
  className: 'P12',
  draw: '',
  sides: [
    { names: [], ids: [], isWinner: false },
    { names: [], ids: [], isWinner: false },
  ],
  sets: [],
  played: false,
  canEnterResult: false,
  awaitingConfirmation: false,
});

describe('boardColumns', () => {
  it('groups by start time in order, courts sorted, no time last', () => {
    const cols = boardColumns([m(1, '2026-11-14T11:00:00', 'Ludz'), m(2, null, 'X'), m(3, '2026-11-14T10:00:00', 'Cramo'), m(4, '2026-11-14T10:00:00', 'Bana 5')]);
    expect(cols.map((c) => c.time)).toEqual(['10:00', '11:00', 'Ingen tid']);
    expect(cols[0].matches.map((x) => x.id)).toEqual([4, 3]);
  });
});
