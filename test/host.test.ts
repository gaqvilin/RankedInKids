import { describe, expect, it } from 'vitest';
import { buildInvitation, buildSchedule } from '../src/lib/host';

const tms = [
  { id: 1, home: 'A', away: 'F' },
  { id: 2, home: 'D', away: 'E' },
  { id: 3, home: 'C', away: 'B' },
];

describe('buildSchedule', () => {
  it('fits 9 matches on 6 courts in two slots without team clashes', () => {
    const s = buildSchedule(tms, { courts: 6, start: '10:00', slotMinutes: 75, freeThirdMatch: false });
    const all = s.flatMap((x) => x.courts.filter(Boolean));
    expect(all).toHaveLength(9);
    expect(s[0].start).toBe('10:00');
    expect(s[1].start).toBe('11:15');
  });
  it('never puts one team in two team matches at the same time', () => {
    const clash = [
      { id: 1, home: 'A', away: 'F' },
      { id: 2, home: 'F', away: 'E' },
    ];
    const s = buildSchedule(clash, { courts: 6, start: '10:00', slotMinutes: 75, freeThirdMatch: false });
    for (const slot of s) {
      const tmsInSlot = new Set(slot.courts.filter(Boolean).map((g) => g!.split(' · ')[0]));
      expect(tmsInSlot.size).toBeLessThanOrEqual(1);
    }
  });
  it('plays match 3 after matches 1 and 2 when the third match is free', () => {
    const s = buildSchedule([tms[0]], { courts: 4, start: '10:00', slotMinutes: 75, freeThirdMatch: true });
    expect(s[0].courts.filter(Boolean)).toHaveLength(2);
    expect(s[1].courts.filter(Boolean)[0]).toMatch(/match 3/);
  });
});

describe('buildInvitation', () => {
  it('fills in SPF template', () => {
    const t = buildInvitation({
      hostClub: 'Varberg Padelklubb',
      division: 'Div 3 Sydväst - södra',
      dateLabel: 'lördag 12 december',
      venue: 'Pantergatan 1, Varberg',
      contact: 'Gustav',
      startTime: '10:00',
      teamMatches: tms,
      freeThirdMatch: true,
      feePerTeamMatch: 550,
    });
    expect(t).toMatch(/välkommen till Varberg Padelklubb/);
    expect(t).toMatch(/- A – F/);
    expect(t).toMatch(/3:e matchens/);
    expect(t).toMatch(/550 kr per lagmatch/);
  });
});
