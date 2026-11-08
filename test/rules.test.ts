import { describe, expect, it } from 'vitest';
import { checkLineup, seriesKind, seriesRules, showsStandings } from '../src/lib/rules';

describe('seriesKind', () => {
  it('tells the series apart', () => {
    expect(seriesKind('SPL Swedish Padel League Herrar 2026-27')).toBe('spl');
    expect(seriesKind('Klubbligan Sydväst 10-14 år HT 26')).toBe('klubbligan-young');
    expect(seriesKind('Klubbligan Väst 10-13 år HT 26')).toBe('klubbligan-young');
    expect(seriesKind('Klubbligan Öst 13-16 och 16-19 år HT 26')).toBe('klubbligan');
    expect(seriesKind('Något annat')).toBe('other');
  });
  it('hides tables for the youngest Klubbligan', () => {
    expect(showsStandings('klubbligan-young')).toBe(false);
    expect(showsStandings('klubbligan')).toBe(true);
    expect(showsStandings('spl')).toBe(true);
  });
  it('gives wave order per series', () => {
    expect(seriesRules('klubbligan-young')?.waves).toEqual([[1, 2], [3, 4], [5, 6]]);
    expect(seriesRules('spl', 'Div 1 Sydväst')?.waves).toEqual([[1, 2, 3]]);
    expect(seriesRules('spl', 'Div 3 Syd')?.waves).toEqual([[1, 2], [3]]);
    expect(seriesRules('klubbligan')?.invitationDeadline).toMatch(/10 dagar/);
  });
});

describe('checkLineup Klubbligan', () => {
  const none = new Map<number, number | null>();
  it('warns about the same pair twice and too few players', () => {
    const w = checkLineup('klubbligan-young', null, [{ playerIds: [1, 2] }, { playerIds: [3, 4] }, { playerIds: [1, 2] }], none);
    expect(w.join(' ')).toMatch(/Samma par spelar match 1 och 3/);
    const w2 = checkLineup('klubbligan', null, [{ playerIds: [1, 2] }, { playerIds: [2, 1] }, { playerIds: [1, 3] }], none);
    expect(w2.join(' ')).toMatch(/inte tillåtet/);
    expect(w2.join(' ')).toMatch(/minst 4/);
  });
  it('accepts a good lineup', () => {
    expect(checkLineup('klubbligan-young', null, [{ playerIds: [1, 2] }, { playerIds: [3, 4] }, { playerIds: [1, 3] }, { playerIds: [2, 4] }], none)).toEqual([]);
  });
});
