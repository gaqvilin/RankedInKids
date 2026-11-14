// Tournaments the user keeps an eye on (on this device): how many pairs have entered, and what is new since last look.
import { getClassPairs, getClasses, getTournament } from './rankedin';

export type Watched = { id: number; name: string; startDate: string };
/** Entered pairs per class name, as last seen on this device. */
export type Seen = Record<string, number>;

const KEY = 'padeladmin.watch.v1';
const SEEN = 'padeladmin.watch.seen.v1';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}

export const getWatched = (): Watched[] => read<Watched[]>(KEY, []);
export const isWatched = (id: number) => getWatched().some((w) => w.id === id);
/** Adds or removes; returns whether it is watched now. */
export function toggleWatch(tournament: Watched): boolean {
  const list = getWatched();
  const on = !list.some((w) => w.id === tournament.id);
  write(KEY, on ? [...list, tournament].slice(-20) : list.filter((w) => w.id !== tournament.id));
  return on;
}

export const getSeen = (id: number): Seen | null => read<Record<string, Seen>>(SEEN, {})[String(id)] ?? null;
export function setSeen(id: number, counts: Seen) {
  write(SEEN, { ...read<Record<string, Seen>>(SEEN, {}), [String(id)]: counts });
}

export type WatchStatus = {
  id: number;
  name: string;
  startDate: string;
  signInOpen: boolean;
  closeSignInDate: string | null;
  /** Complete pairs per class (entries still looking for a partner are counted in `seeking`). */
  classes: { name: string; pairs: number; seeking: number }[];
};

export async function loadWatchStatus(w: Watched): Promise<WatchStatus> {
  const [header, classes] = await Promise.all([getTournament(w.id), getClasses(w.id)]);
  const perClass = await Promise.all(
    classes.map(async (c) => {
      const pairs = await getClassPairs(w.id, c.id).catch(() => []);
      return { name: c.name, pairs: pairs.filter((p) => !p.missingPartner).length, seeking: pairs.filter((p) => p.missingPartner).length };
    }),
  );
  return { id: w.id, name: header.name, startDate: header.startDate, signInOpen: header.signInOpen, closeSignInDate: header.closeSignInDate, classes: perClass };
}

/** How many more entries (pairs + single entries) there are now than last time, per class; null on the first look. */
export function newSince(status: WatchStatus, seen: Seen | null): { total: number; byClass: Record<string, number> } | null {
  if (!seen) return null;
  const byClass: Record<string, number> = {};
  let total = 0;
  for (const c of status.classes) {
    const diff = c.pairs + c.seeking - (seen[c.name] ?? 0);
    if (diff > 0) {
      byClass[c.name] = diff;
      total += diff;
    }
  }
  return { total, byClass };
}

export const countsOf = (status: WatchStatus): Seen => Object.fromEntries(status.classes.map((c) => [c.name, c.pairs + c.seeking]));
