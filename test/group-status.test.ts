import { describe, expect, it } from 'vitest';
import { groupBlocks, playerStatus, type GroupPlayer } from '../src/lib/groups';
import type { Entry, LeagueTeamSummary } from '../src/lib/overview';

const NOW = new Date('2026-11-16T09:00:00'); // a Monday
const entry = (id: number, date: string, o: Partial<Entry> = {}): Entry => ({
  event: { id, name: `Tävling ${id}`, kind: 'tournament', state: 1, startDate: date, link: '' },
  closeSignInDate: null,
  signInOpen: true,
  className: 'Pojkar 12',
  partner: 'Eric F',
  missingPartner: false,
  hasLicense: true,
  ...o,
});
const team = (date: string): LeagueTeamSummary => ({ teamId: 7, teamName: 'Varberg Gul', next: { date } } as unknown as LeagueTeamSummary);

describe('playerStatus', () => {
  it('a missing partner comes first, then a missing licence', () => {
    expect(playerStatus([entry(1, '2026-11-21T09:00:00'), entry(2, '2026-12-05T09:00:00', { missingPartner: true, closeSignInDate: '2026-11-30T23:55:00' })], [], NOW)).toEqual({
      kind: 'partner',
      eventId: 2,
      event: 'Tävling 2',
      closes: '2026-11-30T23:55:00',
    });
    expect(playerStatus([entry(1, '2026-11-21T09:00:00', { hasLicense: false })], [], NOW)).toEqual({ kind: 'license', eventId: 1, event: 'Tävling 1' });
  });
  it('otherwise the next thing they play; soon when it is this week', () => {
    expect(playerStatus([entry(1, '2026-11-21T09:00:00')], [team('2026-11-28T10:00:00')], NOW)).toMatchObject({ kind: 'tournament', soon: true, eventId: 1, partner: 'Eric F' });
    expect(playerStatus([entry(1, '2026-12-05T09:00:00')], [team('2026-11-28T10:00:00')], NOW)).toMatchObject({ kind: 'matchday', soon: false, teamId: 7 });
    expect(playerStatus([entry(1, '2026-11-22T09:00:00')], [], NOW)).toMatchObject({ soon: true }); // Sunday this week
    expect(playerStatus([entry(1, '2026-11-23T09:00:00')], [], NOW)).toMatchObject({ soon: false }); // Monday next week
  });
  it('past events and nothing planned give none', () => {
    expect(playerStatus([entry(1, '2026-11-14T09:00:00', { missingPartner: true })], [], NOW)).toEqual({ kind: 'none' });
    expect(playerStatus([], [], NOW)).toEqual({ kind: 'none' });
  });
});

describe('groupBlocks', () => {
  const p = (name: string, status: GroupPlayer['status']): GroupPlayer => ({ rankedinId: name, id: 1, name, age: null, imageUrl: null, status });
  it('splits into action, this week and the rest', () => {
    const b = groupBlocks([
      p('Inget', { kind: 'none' }),
      p('Helg', { kind: 'tournament', soon: true, eventId: 1, event: 'x', date: '2026-11-21', partner: null }),
      p('Partner', { kind: 'partner', eventId: 1, event: 'x', closes: null }),
      p('Senare', { kind: 'matchday', soon: false, teamId: 1, team: 'x', date: '2026-12-12' }),
    ]);
    expect(b.action.map((x) => x.name)).toEqual(['Partner']);
    expect(b.soon.map((x) => x.name)).toEqual(['Helg']);
    expect(b.rest.map((x) => x.name)).toEqual(['Senare', 'Inget']);
  });
});
