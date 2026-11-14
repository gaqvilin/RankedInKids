import { expect, it } from 'vitest';
import { RELEASES } from '../src/lib/releases';
import { EN } from '../src/lib/i18n/en/index';
it('every release note has English', () => {
  const all = RELEASES.flatMap((r) => [r.title, ...r.items]);
  expect(all.filter((x) => !(x in EN))).toEqual([]);
});
