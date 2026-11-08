// Organiser draw flow for one tournament class, mirroring Rankedin's admin UI
// (see docs/research/rankedin-draw-flow.md). Each action is one step the organiser
// confirms; callers re-read state afterwards. Generation and scheduling run
// asynchronously at Rankedin, so a 2xx only means "accepted".
import { prop, type Call } from './pairing.js';

export class DrawError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Rankedin's exception codes → Swedish explanations. */
const CODES: Record<number, string> = {
  2: 'Ditt konto saknar behörighet för tävlingen.',
  3: 'Tävlingen är i fel läge för det här steget.',
  1103: 'Klassen har för få anmälda.',
  1104: 'Tävlingen är låst.',
  1110: 'Tävlingen är redan avslutad.',
  1112: 'Det finns matcher schemalagda på banan.',
  1122: 'Tävlingen kan inte ändras just nu.',
  1324: 'Lägg till minst en bana först.',
  1326: 'Klassen saknar speldagar. Välj datum för klassen i Rankedin.',
  1327: 'Det är för sent att öppna anmälan igen.',
  1328: 'Rankedin schemalägger just nu – vänta någon minut.',
  1329: 'Spelaren finns redan i lottning och matcher.',
};

async function post(call: Call, path: string, body: unknown, what: string) {
  const r = await call('POST', path, body);
  if (r.ok) return r.data;
  const code = Number(prop(r.data, 'code') ?? prop(r.data, 'Code')) || 0;
  const msg = String(prop(r.data, 'message') ?? '');
  if (r.status === 401 || r.status === 403) throw new DrawError('not_admin', 'Ditt konto är inte administratör för tävlingen.');
  throw new DrawError('rejected', `${what} gick inte: ${CODES[code] ?? (msg || `Rankedin svarade ${r.status}`)}`);
}

async function get(call: Call, path: string) {
  const r = await call('GET', path);
  if (r.status === 401 || r.status === 403) throw new DrawError('not_admin', 'Ditt konto är inte administratör för tävlingen.');
  if (!r.ok) {
    const code = Number(prop(r.data, 'code') ?? prop(r.data, 'Code')) || 0;
    throw new DrawError('upstream', CODES[code] ?? `Rankedin svarade ${r.status}.`);
  }
  return r.data;
}

const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const bool = (o: unknown, k: string) => !!prop(o, k);

export type ClassStatus = {
  classId: number;
  name: string;
  signInOpen: boolean;
  drawType: number;
  generated: boolean;
  scheduled: boolean;
  participants: number;
  seedingValid: boolean;
};

export type TournamentStatus = {
  classes: ClassStatus[];
  courts: { id: number; name: string }[];
  days: { settingsId: number; day: string; startTime: string; endTime: string; duration: number; maxCourts: number; minBreak: number }[];
  drawsPublished: boolean;
  matchesPublished: boolean;
  allMatchesHaveCourt: boolean;
  scheduling: boolean;
};

const hhmm = (v: unknown) => {
  const s = String(v ?? '');
  const m = s.match(/(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : s.slice(-5);
};

export async function loadStatus(call: Call, tournamentId: number): Promise<TournamentStatus> {
  const [signIn, scheduling, courts, times] = await Promise.all([
    get(call, `tournament/GetCloseSignInInfoAsync?tournamentId=${tournamentId}`),
    get(call, `tournament/GetClassesForSchedulingAsync?tournamentid=${tournamentId}`),
    get(call, `tournament/GetCourtsAsync?tournamentId=${tournamentId}`),
    get(call, `tournament/GetTimeSettingsAsync?tournamentid=${tournamentId}`),
  ]);
  // MatchesSettings answers 1328 while a schedule is being built.
  const ms = await call('GET', `tournament/MatchesSettingsAsync?tournamentId=${tournamentId}`);
  const msCode = Number(prop(ms.data, 'code') ?? prop(ms.data, 'Code')) || 0;
  const matchesSettings = ms.ok ? ms.data : null;

  const signInClasses = list(prop(signIn, 'classes'));
  const sched = list(scheduling);
  const classes = await Promise.all(
    signInClasses.map(async (c) => {
      const classId = Number(prop(c, 'tournamentClassId'));
      const ds = await get(call, `tournament/GetDrawsSettingsAsync?tournamentId=${tournamentId}&tournamentClassId=${classId}`);
      const sc = sched.find((x) => Number(prop(x, 'id')) === classId);
      return {
        classId,
        name: String(prop(c, 'tournamentClassName') ?? ''),
        signInOpen: bool(c, 'isSignInOpen'),
        drawType: Number(prop(ds, 'drawTypeIndex')) || 0,
        generated: bool(ds, 'areMatchesGeneratedForSelectedClass') || bool(sc, 'areDrawsGenerated'),
        scheduled: bool(sc, 'isScheduled'),
        participants: Number(prop(ds, 'selectedClassParticipantsCount')) || 0,
        seedingValid: prop(ds, 'isSeedingValid') !== false,
      };
    }),
  );
  return {
    classes,
    courts: list(courts).map((c) => ({ id: Number(prop(c, 'id')), name: String(prop(c, 'courtName') ?? '') })),
    days: list(prop(times, 'settingsCollection')).map((d) => ({
      settingsId: Number(prop(d, 'settingsId')),
      day: String(prop(d, 'day') ?? ''),
      startTime: hhmm(prop(d, 'startTime')),
      endTime: hhmm(prop(d, 'endTime')),
      duration: Number(prop(d, 'duration')) || 0,
      maxCourts: Number(prop(d, 'maxCourts')) || 0,
      minBreak: Number(prop(d, 'minBreak')) || 0,
    })),
    drawsPublished: bool(matchesSettings, 'allDrawsArePublished'),
    matchesPublished: bool(matchesSettings, 'areMatchesPublished'),
    allMatchesHaveCourt: matchesSettings ? prop(matchesSettings, 'allMatchesHaveCourt') !== false : true,
    scheduling: msCode === 1328,
  };
}

export async function closeSignIn(call: Call, tournamentId: number, classId: number) {
  await post(call, 'tournament/CloseTournamentClassSignInAsync', { tournamentClassId: classId, tournamentId }, 'Stänga anmälan');
}
export async function openSignIn(call: Call, tournamentId: number, classId: number) {
  await post(call, 'tournament/OpenTournamentClassSignInAsync', { tournamentClassId: classId, tournamentId }, 'Öppna anmälan');
}

/** One pool: everyone meets everyone ("Round Robin" draw type), then generate. */
export async function drawOnePool(call: Call, tournamentId: number, classId: number) {
  const ds = await get(call, `tournament/GetDrawsSettingsAsync?tournamentId=${tournamentId}&tournamentClassId=${classId}`);
  if (bool(ds, 'areMatchesGeneratedForSelectedClass')) throw new DrawError('already', 'Klassen är redan lottad. Ta bort lottningen först om du vill göra om den.');
  if (prop(ds, 'isSeedingValid') === false) throw new DrawError('seeding', 'Seedningen i klassen är ogiltig. Rätta den i Rankedin.');
  const el = prop(ds, 'el');
  await post(
    call,
    'tournament/DrawsSettingsAsync',
    { TournamentId: tournamentId, DrawTypeIndex: 1, TournamentClassId: classId, Plates: prop(el, 'plates') ?? 0, Playoffs: prop(el, 'playoffs') ?? 0 },
    'Välja lottningstyp',
  );
  await post(call, 'tournament/GenerateMatchesAsync', { TournamentId: tournamentId, SelectedClassId: classId }, 'Lottningen');
}

/** Several pools via Rankedin's draw creator, then generate. Rankedin places pairs by seeding. */
export async function drawPools(call: Call, tournamentId: number, classId: number, pools: number) {
  if (!Number.isInteger(pools) || pools < 2 || pools > 8) throw new DrawError('bad_pools', 'Välj 2–8 grupper.');
  const ds = await get(call, `tournament/GetDrawsSettingsAsync?tournamentId=${tournamentId}&tournamentClassId=${classId}`);
  if (bool(ds, 'areMatchesGeneratedForSelectedClass')) throw new DrawError('already', 'Klassen är redan lottad. Ta bort lottningen först om du vill göra om den.');
  if (prop(ds, 'isSeedingValid') === false) throw new DrawError('seeding', 'Seedningen i klassen är ogiltig. Rätta den i Rankedin.');
  const data = await get(call, `tournament/GetDrawCreatorDataAsync?tournamentId=${tournamentId}&tournamentClassId=${classId}`);
  if (list(prop(data, 'draws')).length) throw new DrawError('structure_exists', 'Klassen har redan en lottningsstruktur. Ta bort lottningen först.');
  const participants = list(prop(data, 'availableParticipants'));
  if (participants.length < pools * 2) throw new DrawError('too_few', `För få par för ${pools} grupper (${participants.length} anmälda).`);
  const names = Array.from({ length: pools }, (_, i) => `Grupp ${String.fromCharCode(65 + i)}`);
  await post(
    call,
    'tournament/SaveDrawCreatorAsync',
    {
      classId,
      tournamentId,
      needRegeneration: true,
      draws: [
        {
          stage: 0,
          strength: 0,
          type: 12,
          name: 'Gruppspel',
          size: participants.length,
          poolsCount: pools,
          poolsNames: names,
          pools: names.map((n) => ({ DrawName: n, DrawId: 0 })),
          playoffs: null,
          plates: null,
          output: 0,
          hasDraw: true,
          players: participants.map((p) => ({
            ParticipantId: prop(p, 'participantId'),
            Name: prop(p, 'name'),
            InitialOrder: prop(p, 'initialOrder'),
            RankingPosition: prop(p, 'rankingPosition'),
            LowSeed: prop(p, 'lowSeed'),
            HighSeed: prop(p, 'highSeed'),
            IsSelected: true,
            DrawStrength: 0,
            DrawStage: 0,
          })),
          links: [],
          selectedLinks: [],
        },
      ],
    },
    'Spara grupperna',
  );
  // The Generate step needs a draw type; saving the creator should set it.
  const after = await get(call, `tournament/GetDrawsSettingsAsync?tournamentId=${tournamentId}&tournamentClassId=${classId}`);
  if (!Number(prop(after, 'drawTypeIndex'))) {
    throw new DrawError('no_type', 'Grupperna sparades men Rankedin har ingen lottningstyp för klassen. Ta bort lottningen och välj en grupp, eller lotta i Rankedin.');
  }
  await post(call, 'tournament/GenerateMatchesAsync', { TournamentId: tournamentId, SelectedClassId: classId }, 'Lottningen');
}

/** Remove schedule and draw for a class (before publishing). */
export async function clearDraw(call: Call, tournamentId: number, classId: number) {
  await call('POST', 'tournament/DeleteScheduleForClassAsync', { tournamentClassId: classId }); // fine if nothing was scheduled
  await post(call, 'tournament/ClearDrawCreatorAsync', { tournamentId, tournamentClassId: classId }, 'Ta bort lottningen');
}

export async function addCourt(call: Call, tournamentId: number, court: { courtName: string; locationName: string; address: string; city: string; order: number }) {
  if (!court.courtName || !court.locationName || !court.address || !court.city) throw new DrawError('court_fields', 'Fyll i banans namn, anläggning, adress och ort.');
  await post(
    call,
    'tournament/AddCourtAsync',
    {
      address: court.address,
      city: court.city,
      countryIndex: 152,
      courtName: court.courtName,
      id: 0,
      latitude: 0,
      locationName: court.locationName,
      longitude: 0,
      reference: '',
      courtOrder: court.order,
      tournamentId,
    },
    `Lägga till ${court.courtName}`,
  );
}

export type DayEdit = { settingsId: number; startTime: string; endTime: string; duration: number; maxCourts: number; breakFactor: number };

export async function saveTimes(call: Call, tournamentId: number, edits: DayEdit[]) {
  const model = await get(call, `tournament/GetTimeSettingsAsync?tournamentid=${tournamentId}`);
  const rows = list(prop(model, 'settingsCollection')) as Record<string, unknown>[];
  if (!rows.length) throw new DrawError('no_days', 'Tävlingen saknar speldagar i Rankedin.');
  const ok = (t: string) => /^\d{2}:\d{2}$/.test(t);
  for (const e of edits) {
    if (!ok(e.startTime) || !ok(e.endTime) || e.endTime <= e.startTime) throw new DrawError('bad_time', 'Kontrollera start- och sluttid.');
    if (!(e.duration >= 10 && e.duration <= 180)) throw new DrawError('bad_duration', 'Matchlängden ska vara 10–180 minuter.');
    if (!(e.maxCourts >= 1 && e.maxCourts <= 40)) throw new DrawError('bad_courts', 'Antal banor ska vara 1–40.');
  }
  const set = (row: Record<string, unknown>, key: string, value: unknown) => {
    const k = Object.keys(row).find((x) => x.toLowerCase() === key.toLowerCase()) ?? key;
    row[k] = value;
  };
  for (const row of rows) {
    const e = edits.find((x) => x.settingsId === Number(prop(row, 'settingsId')));
    if (!e) continue;
    set(row, 'StartTime', e.startTime);
    set(row, 'EndTime', e.endTime);
    set(row, 'Duration', e.duration);
    set(row, 'MaxCourts', e.maxCourts);
    set(row, 'MinBreak', e.duration * Math.max(0, Math.min(5, Math.round(e.breakFactor))));
    set(row, 'IsChanged', true);
  }
  await post(
    call,
    'tournament/UpdateSchedulingSettingsAsync',
    { TournamentId: tournamentId, TimeSettingsCollection: rows, AdvancedSettingsCollection: prop(model, 'schedulingAdvancedSettings') ?? [] },
    'Spara tiderna',
  );
}

export async function scheduleClass(call: Call, classId: number) {
  await post(call, 'tournament/ScheduleSingleClassAsync', { tournamentClassId: classId }, 'Schemaläggningen');
}
export async function unscheduleClass(call: Call, classId: number) {
  await post(call, 'tournament/DeleteScheduleForClassAsync', { tournamentClassId: classId }, 'Ta bort schemat');
}

/** Publish draws and match times for the whole tournament. PublishMatches is a toggle: only call when off. */
export async function publish(call: Call, tournamentId: number) {
  await post(call, 'tournament/PublishTournamentDrawsAsync', { tournamentId, publish: true }, 'Publicera lottningen');
  const ms = await get(call, `tournament/MatchesSettingsAsync?tournamentId=${tournamentId}`);
  if (!bool(ms, 'areMatchesPublished')) await post(call, 'tournament/PublishMatchesAsync', { tournamentId }, 'Publicera matchtiderna');
}

export async function unpublish(call: Call, tournamentId: number) {
  const ms = await get(call, `tournament/MatchesSettingsAsync?tournamentId=${tournamentId}`);
  if (bool(ms, 'areMatchesPublished')) await post(call, 'tournament/PublishMatchesAsync', { tournamentId }, 'Dölja matchtiderna');
  await post(call, 'tournament/PublishTournamentDrawsAsync', { tournamentId, publish: false }, 'Dölja lottningen');
}
