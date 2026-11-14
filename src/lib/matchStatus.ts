// Which matches are being played right now. A match is "live" from its start time (for 90 minutes) until it has a
// result – but only if its players and its court are free: a pair still in an earlier unfinished match cannot have
// started the next one, so that one is "waiting".
import type { TournamentMatch } from './rankedin';

export type MatchStatus = 'live' | 'waiting';
const WINDOW = 90 * 60_000;

export function matchStatus(matches: TournamentMatch[], now: number = Date.now()): Map<number, MatchStatus> {
  const due = matches
    .filter((m) => !m.played && m.date && Date.parse(m.date) <= now && now < Date.parse(m.date) + WINDOW)
    .sort((a, b) => Date.parse(a.date!) - Date.parse(b.date!));
  const busyPlayers = new Set<number>();
  const busyCourts = new Set<string>();
  const out = new Map<number, MatchStatus>();
  for (const m of due) {
    const ids = m.sides.flatMap((s) => s.ids);
    const blocked = ids.some((id) => busyPlayers.has(id)) || (!!m.court && busyCourts.has(m.court));
    out.set(m.id, blocked ? 'waiting' : 'live');
    if (!blocked) {
      ids.forEach((id) => busyPlayers.add(id));
      if (m.court) busyCourts.add(m.court);
    }
  }
  return out;
}
