// Team-league lineups: shared validation + payload building (API and UI).
// Mirrors rankedin.com's lineup editor: one entry per individual match with
// both teams' player ids; singles match types (1, 2) take one player per side.

export type Side = 'first' | 'second';

export type CurrentMatch = {
  challengeId: number;
  firstTeamPlayerIds: number[];
  secondTeamPlayerIds: number[];
};

export type LineupChange = { challengeId: number; playerIds: number[] };

export function isSinglesMatchType(matchType: number): boolean {
  return matchType === 1 || matchType === 2;
}

/** Returns an error message (Swedish) or null when the lineup is valid. */
export function validateLineup(
  changes: LineupChange[],
  opts: {
    matchType: number;
    /** When given, every chosen player must be in it. */
    roster?: { id: number; name: string }[];
    /** Names used in messages (defaults to roster). */
    names?: { id: number; name: string }[];
    requireComplete?: boolean;
  },
): string | null {
  const per = isSinglesMatchType(opts.matchType) ? 1 : 2;
  const name = (id: number) => (opts.names ?? opts.roster)?.find((p) => p.id === id)?.name ?? `spelare ${id}`;
  for (const [i, c] of changes.entries()) {
    const ids = c.playerIds.slice(0, per);
    const chosen = ids.filter((id) => id > 0);
    if (opts.requireComplete && chosen.length < per) return `Match ${i + 1}: välj ${per === 1 ? 'en spelare' : 'två spelare'}.`;
    if (chosen.length > 0 && chosen.length < per) return `Match ${i + 1}: ${name(chosen[0])} saknar partner.`;
    if (new Set(chosen).size !== chosen.length) return `Match ${i + 1}: ${name(chosen[0])} är vald två gånger.`;
    if (opts.roster && chosen.some((id) => !opts.roster!.some((p) => p.id === id))) return `Match ${i + 1}: spelaren finns inte i laget.`;
  }
  return null;
}

/** How many individual matches each player is set to play. */
export function appearances(changes: LineupChange[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const c of changes) for (const id of c.playerIds) if (id > 0) m.set(id, (m.get(id) || 0) + 1);
  return m;
}

/**
 * Builds UpdateTeamLeagueLineupsAsync's body. The other team's current
 * players are kept as they are, so we never overwrite the opponent.
 */
export function buildLineupPayload(teamMatchId: number, side: Side, current: CurrentMatch[], changes: LineupChange[], matchType: number) {
  const per = isSinglesMatchType(matchType) ? 1 : 2;
  const pad = (ids: number[]) => Array.from({ length: per }, (_, i) => ids[i] || 0);
  // Like rankedin.com, only send the matches that were changed.
  const changed = current.filter((m) => changes.some((c) => c.challengeId === m.challengeId));
  const lineups = changed.map((m) => {
    const change = changes.find((c) => c.challengeId === m.challengeId)!;
    const mine = pad(change.playerIds);
    const theirs = pad(side === 'first' ? m.secondTeamPlayerIds : m.firstTeamPlayerIds);
    return {
      ChallengeId: m.challengeId,
      FirstTeamPlayerIds: side === 'first' ? mine : theirs,
      SecondTeamPlayerIds: side === 'first' ? theirs : mine,
    };
  });
  return { TeamMatchId: teamMatchId, MatchesLineups: lineups };
}
