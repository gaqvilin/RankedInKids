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
  return d.toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function fmtTime(iso: string | null | undefined): string {
  const d = toDate(iso);
  if (!d) return '';
  const t = d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
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
  if (diff === 0) return 'idag';
  if (diff === 1) return 'imorgon';
  if (diff === -1) return 'igår';
  if (diff > 1) return `om ${diff} dagar`;
  return `för ${-diff} dagar sedan`;
}

export function hoursUntil(iso: string | null | undefined, now: Date = new Date()): number | null {
  const d = toDate(iso);
  return d ? (d.getTime() - now.getTime()) / 3_600_000 : null;
}

export function fmtSets(sets: [number, number][]): string {
  return sets.map(([a, b]) => `${a}–${b}`).join(', ');
}

export { TZ };
