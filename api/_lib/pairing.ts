// Organiser pairing in a tournament class, done the way Rankedin's own admin UI does it:
//   read:   GET  Tournament/PlayerSettingsAsync?TournamentId&TournamentClassId
//   pair:   POST Tournament/UpdateDoubleAsync      (set player 2 on an entry that has "No partner")
//           POST Tournament/RemoveParticipantAsync (remove the partner's own single entry)
//   unpair: POST Tournament/RemoveParticipantAsync (the pair)
//           POST Tournament/MultiSignInDoublesAsync (add both back without partner)
// Every step is verified by reading the class again. Nothing is done after a draw exists.

export type Entry = {
  entryId: number; // the double's id (UpdateDoubleAsync "id")
  tournamentPlayerId: number; // for RemoveParticipantAsync
  player1: { id: number; name: string } | null;
  player2: { id: number; name: string } | null;
  drawCreated: boolean;
};

export type Call = (method: 'GET' | 'POST', path: string, body?: unknown) => Promise<{ ok: boolean; status: number; data: unknown }>;

/** Case-insensitive property read: Rankedin answers PascalCase or camelCase. */
export function prop(o: unknown, key: string): unknown {
  if (!o || typeof o !== 'object') return undefined;
  const rec = o as Record<string, unknown>;
  if (key in rec) return rec[key];
  const k = Object.keys(rec).find((x) => x.toLowerCase() === key.toLowerCase());
  return k ? rec[k] : undefined;
}

export function parseEntries(settings: unknown): Entry[] {
  const list = prop(settings, 'participants');
  if (!Array.isArray(list)) return [];
  const player = (p: unknown) => {
    const id = Number(prop(p, 'id')) || 0;
    return id > 0 ? { id, name: String(prop(p, 'name') ?? '') } : null;
  };
  return list.map((row) => {
    const part = prop(row, 'participant');
    return {
      entryId: Number(prop(row, 'id')) || 0,
      tournamentPlayerId: Number(prop(part, 'tournamentPlayerId')) || 0,
      player1: player(prop(part, 'firstPlayer')),
      player2: player(prop(part, 'secondPlayer')),
      drawCreated: !!prop(row, 'isDrawCreated') || !!prop(row, 'isAnyMatchGenerated'),
    };
  });
}

export class PairingError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

const has = (e: Entry, id: number) => e.player1?.id === id || e.player2?.id === id;

export async function loadEntries(call: Call, tournamentId: number, classId: number): Promise<Entry[]> {
  const r = await call('GET', `Tournament/PlayerSettingsAsync?TournamentId=${tournamentId}&TournamentClassId=${classId}&OrderBy=d`);
  if (r.status === 401 || r.status === 403) throw new PairingError('not_admin', 'Ditt konto är inte administratör för tävlingen.');
  if (!r.ok) throw new PairingError('upstream', `Rankedin svarade ${r.status}.`);
  const selected = Number(prop(r.data, 'selectedTournamentClass'));
  if (selected && selected !== classId) throw new PairingError('wrong_class', 'Rankedin visade en annan klass än den valda.');
  return parseEntries(r.data);
}

function assertNoDraw(entries: Entry[]) {
  if (entries.some((e) => e.drawCreated)) throw new PairingError('draw_exists', 'Klassen är redan lottad. Ändra par i Rankedin eller ta bort lottningen först.');
}

/** Pair A (who has an entry without partner) with B (also without partner) in the same class. */
export async function pairPlayers(call: Call, tournamentId: number, classId: number, aId: number, bId: number): Promise<Entry[]> {
  if (aId === bId) throw new PairingError('same_player', 'Välj två olika spelare.');
  const before = await loadEntries(call, tournamentId, classId);
  assertNoDraw(before);
  const aEntry = before.find((e) => e.player1?.id === aId && !e.player2);
  const bEntry = before.find((e) => e.player1?.id === bId && !e.player2);
  if (!aEntry) throw new PairingError('a_not_single', 'Första spelaren saknas eller har redan en partner.');
  if (!bEntry) throw new PairingError('b_not_single', 'Andra spelaren saknas eller har redan en partner.');

  // 1. Put B on A's entry (Rankedin's "edit double" in the admin player list).
  const upd = await call('POST', 'Tournament/UpdateDoubleAsync', {
    eventId: classId,
    id: aEntry.entryId,
    player1Id: aId,
    player2Id: bId,
    player1Edited: false,
    player2Edited: true,
  });
  if (!upd.ok) throw new PairingError('rejected', `Rankedin tog inte emot ihopparningen (${upd.status}). Inget är ändrat.`);
  const mid = await loadEntries(call, tournamentId, classId);
  const paired = mid.find((e) => e.entryId === aEntry.entryId);
  if (!(paired?.player1 && paired.player2 && has(paired, aId) && has(paired, bId))) {
    throw new PairingError('not_applied', 'Rankedin svarade OK men paret syns inte. Kontrollera klassen i Rankedin.');
  }

  // 2. B's own single entry is now a duplicate: remove it (if Rankedin didn't already).
  const leftover = mid.find((e) => e.entryId !== aEntry.entryId && e.player1?.id === bId && !e.player2);
  if (leftover) {
    const rem = await call('POST', 'Tournament/RemoveParticipantAsync', { tournamentId, tournamentPlayerId: leftover.tournamentPlayerId });
    if (!rem.ok) throw new PairingError('partly', `Paret är skapat, men ${leftover.player1?.name} står kvar även ensam. Ta bort den raden i Rankedin.`);
  }
  return loadEntries(call, tournamentId, classId);
}

/** Split a pair: both players are put back in the class without partner. */
export async function unpairPlayers(call: Call, tournamentId: number, classId: number, entryId: number): Promise<Entry[]> {
  const before = await loadEntries(call, tournamentId, classId);
  assertNoDraw(before);
  const pair = before.find((e) => e.entryId === entryId);
  if (!pair?.player1 || !pair.player2) throw new PairingError('not_pair', 'Paret finns inte längre.');
  const [a, b] = [pair.player1, pair.player2];

  const rem = await call('POST', 'Tournament/RemoveParticipantAsync', { tournamentId, tournamentPlayerId: pair.tournamentPlayerId });
  if (!rem.ok) throw new PairingError('rejected', `Rankedin tog inte bort paret (${rem.status}). Inget är ändrat.`);

  const single = (p: { id: number }, i: number) => [
    { PlayerId: p.id, Invited: false, Index: i },
    { PlayerId: null, Invited: false, Index: null },
  ];
  const add = await call('POST', 'Tournament/MultiSignInDoublesAsync', {
    tournamentClassId: classId,
    eventId: tournamentId,
    eventType: 4,
    addedInvitedCouples: [single(a, 0), single(b, 1)],
  });
  const after = await loadEntries(call, tournamentId, classId);
  const back = (id: number) => after.some((e) => e.player1?.id === id && !e.player2);
  if (!add.ok || !back(a.id) || !back(b.id)) {
    // Put the pair back rather than leave anyone out of the class.
    const missing = [a, b].filter((p) => !after.some((e) => has(e, p.id)));
    if (missing.length === 2) {
      await call('POST', 'Tournament/MultiSignInDoublesAsync', {
        tournamentClassId: classId,
        eventId: tournamentId,
        eventType: 4,
        addedInvitedCouples: [
          [
            { PlayerId: a.id, Invited: false, Index: 0 },
            { PlayerId: b.id, Invited: false, Index: 1 },
          ],
        ],
      });
    }
    const final = await loadEntries(call, tournamentId, classId);
    const gone = [a, b].filter((p) => !final.some((e) => has(e, p.id)));
    throw new PairingError(
      'partly',
      gone.length
        ? `Kunde inte lägga tillbaka ${gone.map((p) => p.name).join(' och ')} i klassen. Lägg till dem i Rankedin.`
        : 'Kunde inte dela paret – det är återställt som det var.',
    );
  }
  return after;
}
