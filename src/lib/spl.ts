// SPL (Swedish Padel League) rules that matter to team leaders.
// Source: SPF "SPL – Särskilda tävlingsbestämmelser seriespel" 2024/25 and
// the 2026/27 series text in Rankedin. Klubbligan has none of these rules.

/** "Div 1 Sydväst" → 1, "Elitserien"/"Klubblags-SM" → 0, Klubbligan/unknown → null. */
export function divisionLevel(division: string | null | undefined): number | null {
  if (!division) return null;
  if (/elitserie|klubblags/i.test(division)) return 0;
  const m = division.match(/\bdiv(?:ision)?\.?\s*(\d)/i);
  return m ? Number(m[1]) : null;
}

export const isSplLeague = (leagueName: string | null | undefined) => /\bSPL\b|swedish padel league|nationellt seriespel/i.test(leagueName || '');

/** Ranking points for a win / loss in SPL, per division level. */
export function rankingPoints(level: number | null): { win: number; loss: number } | null {
  switch (level) {
    case 0:
      return { win: 8, loss: 2 };
    case 1:
      return { win: 2, loss: 0.5 };
    case 2:
      return { win: 1, loss: 0.25 };
    case 3:
      return { win: 0.5, loss: 0.125 };
    case 4:
    case 5:
    case 6:
      return { win: 0.4, loss: 0.1 };
    default:
      return null;
  }
}

export type LineupRules = {
  /** Distinct players needed across the team match. */
  minDistinctPlayers: number;
  /** Matches (1-based) whose pairs must be in ranking order, strongest first. */
  rankedMatches: number[];
  summary: string;
};

export function lineupRules(level: number | null): LineupRules | null {
  if (level == null) return null;
  if (level <= 1) {
    return { minDistinctPlayers: 6, rankedMatches: [1, 2, 3], summary: '6 olika spelare. Högst rankade paret spelar match 1, näst högst match 2 osv.' };
  }
  return {
    minDistinctPlayers: 4,
    rankedMatches: [1, 2],
    summary: 'Minst 4 olika spelare. Högst rankade paret spelar match 1, nästa par match 2. Fri uppställning i match 3.',
  };
}

export type PairInput = { playerIds: number[] };

/**
 * Soft check of a lineup against SPL rules. Returns readable warnings; empty
 * means it looks fine. Points are each player's ranking points (null = unknown).
 */
export function checkSplLineup(pairs: PairInput[], points: Map<number, number | null>, level: number | null): string[] {
  const rules = lineupRules(level);
  if (!rules) return [];
  const warnings: string[] = [];
  const chosen = pairs.flatMap((p) => p.playerIds.filter((id) => id > 0));
  const distinct = new Set(chosen).size;
  const complete = pairs.every((p) => p.playerIds.filter((id) => id > 0).length === 2);
  if (complete && distinct < rules.minDistinctPlayers) {
    warnings.push(`Lagmatchen ska ha minst ${rules.minDistinctPlayers} olika spelare (nu ${distinct}).`);
  }
  if (level != null && level <= 1 && chosen.length !== distinct) {
    warnings.push('I division 1 får en spelare bara spela en match per lagmatch.');
  }
  const sum = (p: PairInput) => {
    const vals = p.playerIds.filter((id) => id > 0).map((id) => points.get(id));
    if (vals.length < 2 || vals.some((v) => v == null)) return null;
    return (vals as number[]).reduce((a, b) => a + b, 0);
  };
  for (let i = 0; i < rules.rankedMatches.length - 1; i++) {
    const a = pairs[rules.rankedMatches[i] - 1];
    const b = pairs[rules.rankedMatches[i + 1] - 1];
    if (!a || !b) continue;
    const sa = sum(a);
    const sb = sum(b);
    if (sa != null && sb != null && sb > sa) {
      warnings.push(`Match ${rules.rankedMatches[i + 1]} har högre rankingpoäng (${fmt(sb)}) än match ${rules.rankedMatches[i]} (${fmt(sa)}). Högst rankade paret ska spela tidigare.`);
    }
  }
  return warnings;
}

const fmt = (n: number) => (n >= 100 ? String(Math.round(n)) : n.toFixed(1).replace('.', ','));

/** Lineup must be in Rankedin 15 minutes before the first match. */
export function lineupDeadline(firstMatchStart: string | null): Date | null {
  if (!firstMatchStart) return null;
  const d = new Date(firstMatchStart);
  if (Number.isNaN(d.getTime()) || (d.getHours() === 0 && d.getMinutes() === 0)) return null;
  return new Date(d.getTime() - 15 * 60_000);
}
