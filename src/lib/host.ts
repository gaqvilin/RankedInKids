// Tools for the club hosting an SPL round ("sammandrag"): court schedule and
// the invitation ("kallelse") SPF asks hosts to send by Monday.

export type HostTeamMatch = { id: number; home: string; away: string };
export type ScheduleSlot = { start: string; courts: (string | null)[] };

const pad = (n: number) => String(n).padStart(2, '0');
const addMinutes = (hhmm: string, minutes: number) => {
  const [h, m] = hhmm.split(':').map(Number);
  const t = h * 60 + m + minutes;
  return `${pad(Math.floor(t / 60) % 24)}:${pad(t % 60)}`;
};

/**
 * Greedy court schedule: each team match is 3 individual matches.
 * - A team is never in two different team matches at the same time.
 * - With freeThirdMatch (div 2+), match 3 starts after matches 1 and 2.
 */
export function buildSchedule(
  teamMatches: HostTeamMatch[],
  opts: { courts: number; start: string; slotMinutes: number; freeThirdMatch: boolean },
): ScheduleSlot[] {
  type Game = { tm: HostTeamMatch; n: number; label: string };
  const queue: Game[] = teamMatches.flatMap((tm) => [1, 2, 3].map((n) => ({ tm, n, label: `${tm.home} – ${tm.away} · match ${n}` })));
  const doneSlot = new Map<string, number>(); // "tmId-n" -> slot index it was played in
  const slots: ScheduleSlot[] = [];
  let guard = 0;
  while (queue.length && guard++ < 200) {
    const slotIndex = slots.length;
    const courts: (string | null)[] = Array(opts.courts).fill(null);
    const busyTeams = new Map<string, number>(); // team -> team match id playing this slot
    let c = 0;
    for (let i = 0; i < queue.length && c < opts.courts; ) {
      const g = queue[i];
      const clash = [g.tm.home, g.tm.away].some((team) => busyTeams.has(team) && busyTeams.get(team) !== g.tm.id);
      const waitsForFirstTwo =
        opts.freeThirdMatch && g.n === 3 && [1, 2].some((n) => !(doneSlot.has(`${g.tm.id}-${n}`) && doneSlot.get(`${g.tm.id}-${n}`)! < slotIndex));
      if (clash || waitsForFirstTwo) {
        i++;
        continue;
      }
      courts[c++] = g.label;
      busyTeams.set(g.tm.home, g.tm.id);
      busyTeams.set(g.tm.away, g.tm.id);
      doneSlot.set(`${g.tm.id}-${g.n}`, slotIndex);
      queue.splice(i, 1);
    }
    slots.push({ start: addMinutes(opts.start, slotIndex * opts.slotMinutes), courts });
  }
  return slots;
}

export function scheduleAsText(slots: ScheduleSlot[], slotMinutes: number): string {
  return slots
    .map((s) => {
      const games = s.courts.map((g, i) => (g ? `  Bana ${i + 1}: ${g}` : null)).filter(Boolean);
      return `${s.start}–${addMinutes(s.start, slotMinutes)}\n${games.join('\n')}`;
    })
    .join('\n');
}

export type InvitationInput = {
  hostClub: string;
  division: string;
  dateLabel: string;
  venue: string;
  contact: string;
  startTime: string;
  teamMatches: HostTeamMatch[];
  schedule?: string;
  freeThirdMatch: boolean;
  feePerTeamMatch: number;
};

/** SPF's example invitation, filled in. */
export function buildInvitation(i: InvitationInput): string {
  const lines = [
    `Hej och välkommen till ${i.hostClub} för sammandrag ${i.division}.`,
    '',
    `Datum: ${i.dateLabel}`,
    `Plats: ${i.venue || '[adress]'}`,
    `Kontaktperson: ${i.contact || '[namn, telefon, e-post]'}`,
    `Starttid sammandrag: ${i.startTime}`,
    '',
    'Lagmatcher:',
    ...i.teamMatches.map((tm) => `- ${tm.home} – ${tm.away}`),
    '',
    i.schedule ? `Spelschema:\n${i.schedule}` : 'Spelschema kommer finnas i hallen vid ankomst.',
    '',
    'Kom ihåg att laguppställning ska vara inlagd i Rankedin 15 minuter före första matchen startar.',
    ...(i.freeThirdMatch ? ['Den 3:e matchens uppställning ska vara inlagd senast 5 minuter efter att match 1 och 2 spelats färdigt.'] : []),
    'Se till att du har ett inlogg som administratör/spelare för ditt lag vid ankomst och att alla spelare som ska användas har en aktiv licens – utan licens går spelaren inte att välja i laguppställningen.',
    '',
    `Avgiften är ${i.feePerTeamMatch} kr per lagmatch och betalas till ${i.hostClub} vid ankomst.`,
    '',
    'Bekräfta gärna att ni tagit emot kallelsen och hur många som vill äta.',
    '',
    `Varmt välkomna till ${i.hostClub}!`,
  ];
  return lines.join('\n');
}
