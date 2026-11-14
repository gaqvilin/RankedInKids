import { SE_TOWNS } from './cities-se';
// Swedish towns with approximate coordinates, for "tournaments near <city>".
// Accuracy of a few km is plenty for a radius search.
export type City = { name: string; lat: number; lng: number };

/** Every town, alphabetical (for the suggestion list). */
export const CITIES: City[] = SE_TOWNS.map(([name, lat, lng]) => ({ name, lat, lng })).sort((a, b) => a.name.localeCompare(b.name, 'sv'));
/** Same towns, largest first: a prefix match should pick the bigger town. */
const BY_SIZE: City[] = SE_TOWNS.map(([name, lat, lng]) => ({ name, lat, lng }));

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Finds a town by name, ignoring case and Swedish diacritics ("orebro" → Örebro). */
export function findCity(input: string): City | null {
  const q = fold(input.trim());
  if (!q) return null;
  return BY_SIZE.find((c) => fold(c.name) === q) ?? BY_SIZE.find((c) => fold(c.name).startsWith(q)) ?? null;
}

/** Places clubs name themselves after that the town list lacks (suburbs counted into a bigger town). */
const EXTRA_PLACES = ['Danderyd', 'Täby', 'Nacka', 'Lidingö', 'Solna', 'Bromma', 'Mölndal', 'Partille', 'Kungsbacka', 'Limhamn'];
/** Town names that are also ordinary words in event names. */
const NOT_A_TOWN = new Set(['berg', 'sala', 'hede', 'vara', 'mark', 'bro', 'ed', 'hov', 'vik', 'arla', 'viken']);

/**
 * The town an event name mentions ("Step In … SKURUP" → Skurup, "Lerums Padelcenter" → Lerum), or null.
 * Used when Rankedin has no address for the event. The first town in the name wins; a town must be a whole word,
 * or the start of one followed by a genitive s or a club word.
 */
export function townFromName(name: string | null | undefined): string | null {
  const towns = [...BY_SIZE.map((c) => c.name), ...EXTRA_PLACES].filter((t) => t.length >= 4 && !NOT_A_TOWN.has(fold(t)));
  const byFold = new Map<string, string>();
  for (const t of towns) if (!byFold.has(fold(t))) byFold.set(fold(t), t);
  for (const raw of (name || '').split(/[^\p{L}]+/u)) {
    const w = fold(raw);
    if (w.length < 4) continue;
    const exact = byFold.get(w);
    if (exact) return exact;
    // Longest town the word starts with, if what follows looks like a genitive or a club word.
    let best: string | null = null;
    for (const [f, t] of byFold) {
      if (f.length >= 5 && w.startsWith(f) && w.length > f.length && (w.length - f.length === 1 ? w.endsWith('s') : /^s?(padel|tennis|mästerskap|masterskap)/.test(w.slice(f.length)))) {
        if (!best || f.length > fold(best).length) best = t;
      }
    }
    if (best) return best;
  }
  return null;
}
