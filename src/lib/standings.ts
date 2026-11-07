import type { Side } from './rankedin';

export type StandingRow = {
  key: string;
  ids: number[];
  names: string[];
  played: number;
  won: number;
  setsFor: number;
  setsAgainst: number;
  gamesFor: number;
  gamesAgainst: number;
};

type M = { sides: [Side, Side]; sets: [number, number][]; played: boolean };

/** Simple group table: wins, then set difference, then game difference. */
export function standings(matches: M[]): StandingRow[] {
  const rows = new Map<string, StandingRow>();
  const row = (s: Side) => {
    const key = [...s.ids].sort((a, b) => a - b).join('-') || s.names.join('/');
    if (!rows.has(key)) {
      rows.set(key, { key, ids: s.ids, names: s.names, played: 0, won: 0, setsFor: 0, setsAgainst: 0, gamesFor: 0, gamesAgainst: 0 });
    }
    return rows.get(key)!;
  };

  for (const m of matches) {
    if (m.sides.some((s) => s.ids.length === 0)) continue;
    const a = row(m.sides[0]);
    const b = row(m.sides[1]);
    if (!m.played || m.sets.length === 0) continue;
    a.played++;
    b.played++;
    for (const [x, y] of m.sets) {
      a.gamesFor += x;
      a.gamesAgainst += y;
      b.gamesFor += y;
      b.gamesAgainst += x;
      if (x > y) {
        a.setsFor++;
        b.setsAgainst++;
      } else if (y > x) {
        b.setsFor++;
        a.setsAgainst++;
      }
    }
    if (m.sides[0].isWinner) a.won++;
    else if (m.sides[1].isWinner) b.won++;
  }

  return [...rows.values()].sort(
    (p, q) =>
      q.won - p.won ||
      q.setsFor - q.setsAgainst - (p.setsFor - p.setsAgainst) ||
      q.gamesFor - q.gamesAgainst - (p.gamesFor - p.gamesAgainst) ||
      p.names.join().localeCompare(q.names.join(), 'sv'),
  );
}
