import { describe, expect, it } from 'vitest';
import { ageClassFor, classMatchesAge, eventMatchesAge } from '../src/lib/ages';

describe('ages', () => {
  it('picks the youngest class a player can play', () => {
    expect(ageClassFor(11)).toBe(12);
    expect(ageClassFor(12)).toBe(12);
    expect(ageClassFor(13)).toBe(14);
    expect(ageClassFor(18)).toBe(18);
    expect(ageClassFor(19)).toBeNull();
    expect(ageClassFor(null)).toBeNull();
  });
  it('matches class names', () => {
    expect(classMatchesAge('Pojkar 12 Step In', 12)).toBe(true);
    expect(classMatchesAge('F12', 12)).toBe(true);
    expect(classMatchesAge('Pojkar 14 Step In', 12)).toBe(false);
    expect(classMatchesAge('Herr B', 12)).toBe(false);
    expect(classMatchesAge('Flickor 120', 12)).toBe(false);
  });
  it('uses classes when known, else the name', () => {
    expect(eventMatchesAge('Step In Varberg / Flickor och pojkar 12, 14 & 16', undefined, 14)).toBe(true);
    expect(eventMatchesAge('Step in - P12/F12/P14/F14 - Djursholm', undefined, 16)).toBe(false);
    expect(eventMatchesAge('Christmas Open 2026', ['Pojkar 12', 'Herr B'], 12)).toBe(true);
    expect(eventMatchesAge('SPT FUTURE 6, 5-6/12-2026, 12/14/16/18', ['Pojkar 16', 'Flickor 16'], 12)).toBe(false);
  });
});
