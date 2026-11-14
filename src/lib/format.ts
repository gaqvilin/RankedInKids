import { locale, t } from './i18n';
const TZ = 'Europe/Stockholm';

function toDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  // Rankedin sends local wall-clock times without zone; treat them as such.
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function fmtDay(iso: string | null | undefined): string {
  const d = toDate(iso);
  if (!d) return '';
  return d.toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', month: 'short' });
}

export function fmtTime(iso: string | null | undefined): string {
  const d = toDate(iso);
  if (!d) return '';
  const t = d.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });
  return t === '00:00' ? '' : t;
}

export function fmtDayTime(iso: string | null | undefined): string {
  const day = fmtDay(iso);
  const time = fmtTime(iso);
  return time ? `${day} ${time}` : day;
}

export function isSameDay(a: string | null | undefined, b: Date = new Date()): boolean {
  const d = toDate(a);
  return !!d && d.toDateString() === b.toDateString();
}

/** "om 2 dagar", "idag", "igår" etc. */
export function relativeDays(iso: string | null | undefined, now: Date = new Date()): string {
  const d = toDate(iso);
  if (!d) return '';
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(d) - start(now)) / 86_400_000);
  if (diff === 0) return t('idag');
  if (diff === 1) return t('imorgon');
  if (diff === -1) return t('igår');
  if (diff > 1) return t('om {n} dagar', { n: diff });
  return t('för {n} dagar sedan', { n: -diff });
}

export function hoursUntil(iso: string | null | undefined, now: Date = new Date()): number | null {
  const d = toDate(iso);
  return d ? (d.getTime() - now.getTime()) / 3_600_000 : null;
}

export function fmtSets(sets: [number, number][]): string {
  return sets.map(([a, b]) => `${a}–${b}`).join(', ');
}

export { TZ };

/** A detail worth showing next to a name only if the name doesn't already say it ("Step In Varberg …" + "Varberg"). */
export function unlessInName(name: string, value: string | null | undefined): string | null {
  if (!value) return null;
  return name.toLowerCase().includes(value.toLowerCase()) ? null : value;
}

/** "Pojkar 12 Step In" → "Pojkar 12" when the tournament name already says "Step In". */
export function classInEvent(className: string, eventName: string): string {
  const event = eventName.toLowerCase();
  let out = className;
  for (const level of ['Step In', 'Level Up', 'SPT Future', 'USM']) {
    if (event.includes(level.toLowerCase())) out = out.replace(new RegExp(`\\b${level}\\b`, 'i'), ' ');
  }
  return out.replace(/\s+/g, ' ').trim() || className;
}

/** Only "idag", "imorgon" or "igår" – the date itself says the rest. */
export function soon(iso: string | null | undefined, now: Date = new Date()): string {
  const r = relativeDays(iso, now);
  return r === 'idag' || r === 'imorgon' || r === 'igår' ? r : '';
}
