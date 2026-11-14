// Pure helpers for turning a typed-in padel score into Rankedin's
// SubmitResultAsync payload. Shared by the API function and the UI.

/** GetChallengeResultAsync response (Rankedin returns PascalCase, swagger says camelCase). */
export type ChallengeResult = Record<string, unknown>;

export type SetScore = [number, number];

function pick(obj: ChallengeResult, name: string): unknown {
  if (name in obj) return obj[name];
  const pascal = name[0].toUpperCase() + name.slice(1);
  if (pascal in obj) return obj[pascal];
  const lower = name.toLowerCase();
  const key = Object.keys(obj).find((k) => k.toLowerCase() === lower);
  return key ? obj[key] : undefined;
}

/** Validates a list of set scores and returns sets won by each side. Rankedin requires a winner (its own dialog rejects equal set scores). */
export function summarizeSets(sets: SetScore[]): { p1: number; p2: number } {
  if (!Array.isArray(sets) || sets.length === 0) throw new Error('Ange minst ett set.');
  if (sets.length > 5) throw new Error('För många set.');
  let p1 = 0;
  let p2 = 0;
  for (const set of sets) {
    if (!Array.isArray(set) || set.length !== 2) throw new Error('Ogiltigt set.');
    const [a, b] = set.map((n) => Number(n));
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a > 99 || b > 99) {
      throw new Error('Ogiltiga siffror.');
    }
    if (a === b) throw new Error('Ett set kan inte sluta oavgjort.');
    if (a > b) p1++;
    else p2++;
  }
  if (p1 === p2) throw new Error('Rankedin kräver en vinnare. Vid 1–1: skriv det avgörande supertiebreaket som ett tredje set, t.ex. 10–8.');
  return { p1, p2 };
}

/** Mirrors submitResultModel() in rankedin.com's enter-results dialog. */
export function buildSubmitPayload(challengeId: number, challenge: ChallengeResult, sets: SetScore[]) {
  const { p1, p2 } = summarizeSets(sets);
  const games1 = sets.map((s) => `${Number(s[0])},`).join('');
  const games2 = sets.map((s) => `${Number(s[1])},`).join('');
  const durations = sets.map(() => '0,').join('');
  return {
    challengeId,
    participant1CancellationType: 0,
    participant2CancellationType: 0,
    reset: false,
    participant1Score: p1,
    participant2Score: p2,
    participant1Games: games1,
    participant2Games: games2,
    setDurations: durations,
    participant1ID: Number(pick(challenge, 'participant1ID')) || 0,
    participant2ID: Number(pick(challenge, 'participant2ID')) || 0,
    duration: false,
    games: false,
    matchDuration: 0,
    tiebreaks: [],
    currPlayerId: Number(pick(challenge, 'currentPlayerId')) || 0,
  };
}

/** Mirrors resetModel() in rankedin.com's enter-results dialog ("Reset result"): clears the score so the match is unplayed. */
export function buildResetPayload(challengeId: number, challenge: ChallengeResult) {
  return {
    challengeId,
    participant1CancellationType: 0,
    participant2CancellationType: 0,
    reset: true,
    participant1Score: 0,
    participant2Score: 0,
    participant1Games: '',
    participant2Games: '',
    setDuration: '',
    duration: false,
    games: false,
    currPlayerId: Number(pick(challenge, 'currentPlayerId')) || 0,
  };
}

/** The sets Rankedin currently holds for a challenge ([] when unplayed). Games come as arrays or "6,4," strings. */
export function currentSets(challenge: ChallengeResult): SetScore[] {
  const games = (v: unknown): number[] =>
    (Array.isArray(v) ? v : String(v ?? '').split(','))
      .map((x) => String(x).trim())
      .filter((x) => x !== '')
      .map(Number)
      .filter((n) => Number.isFinite(n));
  const a = games(pick(challenge, 'firstPlayerGames') ?? pick(challenge, 'participant1Games'));
  const b = games(pick(challenge, 'secondPlayerGames') ?? pick(challenge, 'participant2Games'));
  const n = Math.min(a.length, b.length);
  const sets: SetScore[] = [];
  for (let i = 0; i < n; i++) if (a[i] || b[i]) sets.push([a[i], b[i]]);
  const score = (Number(pick(challenge, 'participant1Score')) || 0) + (Number(pick(challenge, 'participant2Score')) || 0);
  return sets.length || score ? sets : [];
}

const same = (x: SetScore[], y: SetScore[]) => x.length === y.length && x.every((s, i) => s[0] === y[i][0] && s[1] === y[i][1]);

/**
 * A result queued offline was entered against what the phone saw then (`expected`: [] = unplayed).
 * If Rankedin now holds something else – someone else reported meanwhile – it is a conflict, unless it already equals ours.
 */
export function resultConflict(challenge: ChallengeResult, expected: SetScore[], ours: SetScore[] | null): SetScore[] | null {
  const now = currentSets(challenge);
  if (same(now, expected)) return null;
  if (ours && same(now, ours)) return null;
  if (!ours && now.length === 0) return null;
  return now;
}
