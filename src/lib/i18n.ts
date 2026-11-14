// Swedish and English. The Swedish text is the key: t('Rapportera resultat') gives "Report result" in English
// and the text itself in Swedish. A text without an English entry falls back to Swedish, so nothing breaks
// when a new text is added – add its translation in src/lib/i18n/en/*.ts.
import { useSyncExternalStore } from 'react';
import { EN } from './i18n/en/index';

export type Lang = 'sv' | 'en';
const KEY = 'padeladmin.lang';

function initial(): Lang {
  // Tests and the server run without a browser: Swedish.
  if (typeof window === 'undefined') return 'sv';
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'sv' || saved === 'en') return saved;
  } catch {
    /* storage unavailable */
  }
  // First visit: the device's language. Swedish devices get Swedish, everyone else English.
  return /^sv\b/i.test(navigator.language || '') ? 'sv' : 'en';
}

let lang: Lang = initial();
const listeners = new Set<() => void>();
if (typeof document !== 'undefined') document.documentElement.lang = lang;

export const getLang = (): Lang => lang;
/** The locale for dates and number formatting. */
export const locale = (): string => (lang === 'en' ? 'en-GB' : 'sv-SE');

export function setLang(next: Lang) {
  if (next === lang) return;
  lang = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* storage unavailable: applies to this visit */
  }
  if (typeof document !== 'undefined') document.documentElement.lang = next;
  listeners.forEach((l) => l());
}

/** Re-renders the caller when the language changes (used at the app root, which remounts the pages). */
export function useLang(): Lang {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => lang,
    () => 'sv',
  );
}

/**
 * The text in the current language. `vars` fill {placeholders}: t('{n} av {total} matcher klara', { n: 3, total: 22 }).
 * Call it while rendering (not at module level), so a language change is picked up.
 */
export function t(sv: string, vars?: Record<string, string | number>): string {
  const text = lang === 'en' ? (EN[sv] ?? sv) : sv;
  return vars ? text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : text;
}

/** Test helper. */
export function _setLangForTest(next: Lang) {
  lang = next;
}
