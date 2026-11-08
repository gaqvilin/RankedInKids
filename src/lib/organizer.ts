// Tournament-day logic for the organiser ("tävlingsledning"). Pure functions, tested.
import type { Pair, TournamentMatch } from './rankedin';

/** Typical Step In / Level Up match slot. */
export const SLOT_MINUTES = 45;

export type CourtState = {
  court: string;
  /** Scheduled to have started and not yet reported. */
  now: TournamentMatch | null;
  /** The next match after "now" on this court. */
  next: TournamentMatch | null;
  /** Minutes "now" is over its slot (0 if on time). */
  lateMinutes: number;
  done: number;
  total: number;
};

const time = (m: TournamentMatch) => (m.date ? new Date(m.date).getTime() : Number.POSITIVE_INFINITY);
const byTime = (a: TournamentMatch, b: TournamentMatch) => time(a) - time(b);

/** Natural court order: "Bana 2" before "Bana 10". */
export const courtOrder = (a: string, b: string) => a.localeCompare(b, 'sv', { numeric: true });

export function courtBoard(matches: TournamentMatch[], now: Date = new Date()): CourtState[] {
  const t = now.getTime();
  const courts = new Map<string, TournamentMatch[]>();
  for (const m of matches) {
    if (!m.court || !m.date) continue;
    courts.set(m.court, [...(courts.get(m.court) ?? []), m]);
  }
  return [...courts.entries()]
    .sort(([a], [b]) => courtOrder(a, b))
    .map(([court, list]) => {
      const sorted = [...list].sort(byTime);
      const open = sorted.filter((m) => !m.played);
      // On court now: the earliest unplayed match whose start has passed; else nothing yet.
      const current = open.find((m) => time(m) <= t) ?? null;
      const next = open.find((m) => m !== current) ?? null;
      const late = current ? Math.max(0, Math.round((t - time(current)) / 60000) - SLOT_MINUTES) : 0;
      return { court, now: current, next, lateMinutes: late, done: sorted.filter((m) => m.played).length, total: sorted.length };
    });
}

/** Matches whose slot is over but have no result, oldest first. */
export function missingResults(matches: TournamentMatch[], now: Date = new Date()): TournamentMatch[] {
  const cutoff = now.getTime() - SLOT_MINUTES * 60000;
  return matches.filter((m) => !m.played && m.date && time(m) <= cutoff && m.sides.every((s) => s.ids.length > 0)).sort(byTime);
}

export type Seeker = { className: string; playerId: number; name: string; rankedinId: string | null; hasLicense: boolean };

/** Everyone registered without a partner, per class. */
export function partnerSeekers(pairsByClass: Map<string, Pair[]>): Map<string, Seeker[]> {
  const out = new Map<string, Seeker[]>();
  for (const [className, pairs] of pairsByClass) {
    const seekers = pairs
      .filter((p) => p.missingPartner && p.players[0])
      .map((p) => ({ className, playerId: p.players[0].id, name: p.players[0].name, rankedinId: p.players[0].rankedinId, hasLicense: p.players[0].hasLicense }));
    if (seekers.length) out.set(className, seekers);
  }
  return out;
}

/** Players entered without a valid licence (they can't be drawn in sanctioned classes). */
export function unlicensed(pairsByClass: Map<string, Pair[]>): { className: string; name: string }[] {
  return [...pairsByClass].flatMap(([className, pairs]) => pairs.flatMap((p) => p.players.filter((x) => !x.hasLicense).map((x) => ({ className, name: x.name }))));
}
