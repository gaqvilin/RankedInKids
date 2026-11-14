import { describe, expect, it } from 'vitest';
import { countsOf, newSince, type WatchStatus } from '../src/lib/watch';

const status: WatchStatus = {
  id: 1,
  name: 'Step In',
  startDate: '2026-11-21T09:00:00',
  signInOpen: true,
  closeSignInDate: null,
  classes: [
    { name: 'Pojkar 12', pairs: 10, seeking: 2 },
    { name: 'Flickor 12', pairs: 4, seeking: 0 },
  ],
};

describe('watch', () => {
  it('counts entries per class (pairs and those looking for a partner)', () => {
    expect(countsOf(status)).toEqual({ 'Pojkar 12': 12, 'Flickor 12': 4 });
  });
  it('nothing is new on the first look', () => {
    expect(newSince(status, null)).toBeNull();
  });
  it('shows what has been added since last time, per class; withdrawals are not shown as new', () => {
    expect(newSince(status, { 'Pojkar 12': 9, 'Flickor 12': 6 })).toEqual({ total: 3, byClass: { 'Pojkar 12': 3 } });
    expect(newSince(status, { 'Pojkar 12': 12, 'Flickor 12': 4 })).toEqual({ total: 0, byClass: {} });
  });
  it('a class added after the last look counts as new', () => {
    expect(newSince(status, { 'Pojkar 12': 12 })).toEqual({ total: 4, byClass: { 'Flickor 12': 4 } });
  });
});
