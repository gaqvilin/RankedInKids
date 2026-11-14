import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { _setLangForTest, t } from '../src/lib/i18n';
import { EN } from '../src/lib/i18n/en/index';

const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : /\.(ts|tsx)$/.test(e.name) ? [join(dir, e.name)] : []));

/** Every literal t('…') / t("…") / t(`…`) in the app (templates with ${} are not allowed: use {vars}). */
function usedKeys(): { key: string; file: string }[] {
  const out: { key: string; file: string }[] = [];
  for (const file of files('src')) {
    if (file.includes('/i18n')) continue;
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/\bt\(\s*(?:'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\$]|\\.)*)`)/g)) {
      const raw = m[1] ?? m[2] ?? m[3];
      out.push({ key: raw.replace(/\\(['"`\\])/g, '$1').replace(/\\n/g, '\n'), file });
    }
  }
  return out;
}

afterEach(() => _setLangForTest('sv'));

describe('i18n', () => {
  it('Swedish is the text itself; English comes from the dictionary; placeholders are filled', () => {
    expect(t('Språk')).toBe('Språk');
    expect(t('{n} av {total}', { n: 3, total: 22 })).toBe('3 av 22');
    _setLangForTest('en');
    expect(t('Språk')).toBe('Language');
    expect(t('En text som saknar översättning')).toBe('En text som saknar översättning');
  });

  it('every text used with t() has an English translation', () => {
    const missing = [...new Set(usedKeys().filter((u) => !(u.key in EN)).map((u) => `${u.file}: ${u.key}`))];
    expect(missing).toEqual([]);
  });

  it('translations keep the same {placeholders} as the Swedish text', () => {
    const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
    const wrong = Object.entries(EN).filter(([sv, en]) => vars(sv) !== vars(en)).map(([sv]) => sv);
    expect(wrong).toEqual([]);
  });
});
