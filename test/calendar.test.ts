import { describe, expect, it } from 'vitest';
import { findCity } from '../src/lib/cities';
import { levelFromName, townFromAddress } from '../src/lib/rankedin';

describe('townFromAddress', () => {
  it('takes the town after the postcode', () => {
    expect(townFromAddress('Härdgatan 7, 432 32 Varberg, Sverige')).toBe('Varberg');
    expect(townFromAddress('Silovägen 7A 136 50 Jordbro')).toBeNull();
    expect(townFromAddress('Stationstorget 5, 269 43 Båstad, Sweden')).toBe('Båstad');
    expect(townFromAddress('Danderydsvägen 4')).toBeNull();
    expect(townFromAddress(null)).toBeNull();
  });
});

describe('levelFromName', () => {
  it('detects the youth levels', () => {
    expect(levelFromName('Step In Varberg Padelklubb / Flickor och pojkar')).toBe('Step In');
    expect(levelFromName('Step in - P12/F12')).toBe('Step In');
    expect(levelFromName('Bromölla Padel Court Youth Trophy - level up')).toBe('Level Up');
    expect(levelFromName('SPT FUTURE 6, 5-6/12-2026')).toBe('SPT Future');
    expect(levelFromName('Båstad Padelklubb Mästerskap 2026')).toBe('Övrigt');
  });
});

describe('findCity', () => {
  it('ignores case and diacritics and accepts prefixes', () => {
    expect(findCity('orebro')?.name).toBe('Örebro');
    expect(findCity('VARBERG')?.name).toBe('Varberg');
    expect(findCity('Göte')?.name).toBe('Göteborg');
    expect(findCity('Atlantis')).toBeNull();
  });
});

import { htmlToParagraphs } from '../src/lib/rankedin';

describe('htmlToParagraphs', () => {
  it('turns organiser HTML into safe plain paragraphs', () => {
    const p = htmlToParagraphs('<p><strong>Plats</strong>: Padelview&nbsp;Factory</p><p></p><ul><li>P12 &amp; F12</li></ul><script>alert(1)</script><img src=x onerror=alert(2)>');
    expect(p).toEqual(['Plats: Padelview Factory', '• P12 & F12']);
  });
  it('handles empty input', () => {
    expect(htmlToParagraphs(null)).toEqual([]);
  });
});

import { unlessInName } from '../src/lib/format';
describe('unlessInName', () => {
  it('drops details the name already says', () => {
    expect(unlessInName('Step In Varberg Padelklubb / Flickor och pojkar', 'Varberg')).toBeNull();
    expect(unlessInName('Step In Varberg Padelklubb', 'Step In')).toBeNull();
    expect(unlessInName('Båstad Padelklubb Mästerskap 2026', 'Båstad')).toBeNull();
    expect(unlessInName('Danderydsmästerskapen Padel 2026 (DJTK & GTG)', 'Stockholm')).toBe('Stockholm');
  });
});
