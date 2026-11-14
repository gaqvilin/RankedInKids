import { describe, expect, it } from 'vitest';
import { townFromName } from '../src/lib/cities';

describe('townFromName', () => {
  it.each([
    ['Step In flickor och pojkar 12,14,16 SKURUP', 'Skurup'],
    ['December Open - Lerums Padelcenter (Smile Room)', 'Lerum'],
    ['Vista Padel Club Winter Open Step-in - Huddinge . F12/P12/F14/P14/F16/P16', 'Huddinge'],
    ['Christmas Open Skuruppadelklubb 2026', 'Skurup'],
    ['Skurup Open 2027', 'Skurup'],
    ['Danderydsmästerskapen Padel 2026 (DJTK & GTG)', 'Danderyd'],
    ['SPT FUTURE 6, 5-6/12-2026, E4 Arena Jönköping, 12/14/16/18-årsklasser', 'Jönköping'],
    ['Step In Varberg Padelklubb / Flickor och pojkar 12, 14 & 16', 'Varberg'],
  ])('%s → %s', (name, town) => expect(townFromName(name)).toBe(town));

  it('finds nothing when no town is named', () => {
    expect(townFromName('Klubbmästerskap Padel Open 2026')).toBeNull();
    expect(townFromName('Winter Cup Step In')).toBeNull();
    expect(townFromName(null)).toBeNull();
  });
});
