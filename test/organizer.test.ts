import { describe, expect, it } from 'vitest';
import { courtBoard, missingResults, partnerSeekers } from '../src/lib/organizer';
import type { TournamentMatch } from '../src/lib/rankedin';

const side = (n: string, id: number) => ({ names: [n], ids: [id], isWinner: false });
const m = (id: number, court: string, hhmm: string, played = false): TournamentMatch => ({
  id,
  date: `2026-11-14T${hhmm}:00`,
  className: 'P12',
  draw: '',
  court,
  sides: [side('A', id * 10), side('B', id * 10 + 1)],
  sets: [],
  played,
  canEnterResult: true,
  awaitingConfirmation: false,
});

describe('courtBoard', () => {
  const now = new Date('2026-11-14T10:20:00');
  it('finds what is on each court now and next, in court order', () => {
    const b = courtBoard([m(1, 'Bana 10', '10:00'), m(2, 'Bana 2', '09:00', true), m(3, 'Bana 2', '10:00'), m(4, 'Bana 2', '10:45')], now);
    expect(b.map((c) => c.court)).toEqual(['Bana 2', 'Bana 10']);
    expect(b[0].now?.id).toBe(3);
    expect(b[0].next?.id).toBe(4);
    expect(b[0].done).toBe(1);
    expect(b[0].lateMinutes).toBe(0);
  });
  it('flags a court running late', () => {
    const b = courtBoard([m(1, 'Bana 1', '09:00'), m(2, 'Bana 1', '09:45')], now);
    expect(b[0].now?.id).toBe(1);
    expect(b[0].lateMinutes).toBe(35);
  });
  it('shows nothing on court before the first start', () => {
    const b = courtBoard([m(1, 'Bana 1', '11:00')], now);
    expect(b[0].now).toBeNull();
    expect(b[0].next?.id).toBe(1);
  });
});

describe('missingResults', () => {
  it('lists finished slots without result, oldest first', () => {
    const r = missingResults([m(1, 'B', '09:30'), m(2, 'B', '08:00'), m(3, 'B', '10:00'), m(4, 'B', '08:30', true)], new Date('2026-11-14T10:20:00'));
    expect(r.map((x) => x.id)).toEqual([2, 1]);
  });
});

describe('partnerSeekers', () => {
  it('collects players without partner per class', () => {
    const p = (ids: number[]) => ({ players: ids.map((id) => ({ id, name: `P${id}`, rankedinId: null, hasLicense: true })), missingPartner: ids.length < 2, seed: '' });
    const s = partnerSeekers(new Map([['P12', [p([1, 2]), p([3]), p([4])]], ['F12', [p([5, 6])]]]));
    expect([...s.keys()]).toEqual(['P12']);
    expect(s.get('P12')!.map((x) => x.name)).toEqual(['P3', 'P4']);
  });
});
