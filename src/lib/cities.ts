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
