import { t } from './i18n';
// Client for Rankedin's live referee API (the same one used by
// live.rankedin.com/refereePanel.html). Works with a match's referee code,
// no login needed. CORS is open, so the browser talks to it directly.

export const LIVE_API = 'https://live.rankedin.com/api/v1';

export type LiveScore = {
  firstParticipantScore: number;
  secondParticipantScore: number;
  isTieBreak?: boolean;
  isSuperTieBreak?: boolean;
  loserTiebreak?: number | null;
  detailedResult?: LiveScore[] | null;
};

export type LivePlayer = { id: number; firstName: string; lastName: string };

export type RefereeState = {
  eTag: string;
  wrongETag?: boolean;
  serve?: { isFirstParticipantServing: boolean | null; isServingLeft: boolean | null } | null;
  score: LiveScore;
  duration?: { isPaused: boolean; totalDurationInSeconds: number } | null;
  termination?: { isEndMatchSuggested: boolean; isMatchEnded: boolean } | null;
  settings?: {
    askForSuperTieBreak: boolean;
    useSuperTieBreak: boolean;
    askForMatchGamesCount: boolean;
    matchGamesCount: number;
    askForMatchGamePoints: boolean;
    matchGamePoints: number;
  } | null;
  matchDetails?: { matchId: number; eventName: string | null; eventType: string | null } | null;
  firstParticipant?: LivePlayer[] | null;
  secondParticipant?: LivePlayer[] | null;
};

export type MatchAction = 'Score' | 'Undo' | 'Serve' | 'Pause' | 'Play' | 'End';
export type MatchSubject = 'FirstParticipant' | 'SecondParticipant' | 'Match';

export class RefereeSession {
  state: RefereeState | null = null;
  matchId = 0;

  constructor(
    public code: string,
    public refereePlayerId = 0,
  ) {}

  async init(): Promise<RefereeState> {
    const q = new URLSearchParams({ refereeCode: this.code, refereePlayerId: String(this.refereePlayerId) });
    const res = await fetch(`${LIVE_API}/Referee/init?${q}`);
    if (!res.ok) throw new Error(res.status === 404 || res.status === 400 ? t('Okänd domarkod.') : t('Live-tjänsten svarade {status}', { status: res.status }));
    const data = (await res.json()) as RefereeState;
    if (!data || !data.matchDetails) throw new Error(t('Okänd domarkod.'));
    this.state = data;
    this.matchId = data.matchDetails.matchId;
    return data;
  }

  private base() {
    if (!this.state) throw new Error('Inte initierad');
    return {
      eTag: this.state.eTag,
      matchId: this.matchId,
      refereeCode: this.code,
      refereePlayerId: this.refereePlayerId,
    };
  }

  private merge(next: Partial<RefereeState>): RefereeState {
    this.state = { ...(this.state as RefereeState), ...next };
    return this.state;
  }

  async post(matchAction: MatchAction, matchSubject: MatchSubject, isLeftServePosition?: boolean): Promise<RefereeState> {
    const res = await fetch(`${LIVE_API}/Referee`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...this.base(), matchAction, matchSubject, isLeftServePosition }),
    });
    if (!res.ok) throw new Error(t('Live-tjänsten svarade {status}', { status: res.status }));
    const next = (await res.json()) as RefereeState;
    if (next.wrongETag) {
      // Someone else (or another tab) refereed meanwhile: reload the true state.
      return this.init();
    }
    return this.merge(next);
  }

  point(first: boolean) {
    return this.post('Score', first ? 'FirstParticipant' : 'SecondParticipant');
  }
  undo() {
    return this.post('Undo', 'Match');
  }
  serve(first: boolean, left: boolean) {
    return this.post('Serve', first ? 'FirstParticipant' : 'SecondParticipant', left);
  }
  end() {
    return this.post('End', 'Match');
  }

  async updateSettings(settings: NonNullable<RefereeState['settings']>): Promise<RefereeState> {
    const res = await fetch(`${LIVE_API}/Referee/UpdateSettings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...this.base(), settings }),
    });
    if (!res.ok) throw new Error(t('Live-tjänsten svarade {status}', { status: res.status }));
    const next = (await res.json()) as RefereeState;
    if (next.wrongETag) return this.init();
    return this.merge({ ...next, settings });
  }
}

// ---------- Score presentation ----------

export type ScoreView = {
  /** Finished and current sets as [first, second] games. */
  sets: [number, number][];
  /** Points in the current game as display strings ("15", "40", "AD", or tiebreak numbers). */
  points: [string, string];
  inTiebreak: boolean;
  setsWon: [number, number];
};

const TENNIS = ['0', '15', '30', '40'];

export function tennisPoints(a: number, b: number): [string, string] {
  if (a >= 3 && b >= 3) {
    if (a === b) return ['40', '40'];
    return a > b ? ['AD', '40'] : ['40', 'AD'];
  }
  return [TENNIS[Math.min(a, 3)], TENNIS[Math.min(b, 3)]];
}

/**
 * Live score is nested: match -> sets -> games -> points.
 * score.detailedResult = sets; last set's detailedResult = games; last game's numbers = points.
 */
export function toScoreView(score: LiveScore | null | undefined): ScoreView {
  const empty: ScoreView = { sets: [], points: ['0', '0'], inTiebreak: false, setsWon: [0, 0] };
  if (!score) return empty;
  const sets = score.detailedResult || [];
  const view: ScoreView = {
    sets: sets.map((s) => [s.firstParticipantScore, s.secondParticipantScore]),
    points: ['0', '0'],
    inTiebreak: false,
    setsWon: [score.firstParticipantScore, score.secondParticipantScore],
  };
  const current = sets[sets.length - 1];
  if (!current) return view;
  const lowest = deepestLast(score);
  const superTiebreak = !!(score.isSuperTieBreak || current.isSuperTieBreak);
  const tiebreak = superTiebreak || !!(score.isTieBreak || current.isTieBreak || lowest.isTieBreak);
  // A super tiebreak replaces the deciding set, so it is shown as points, not as a set.
  if (superTiebreak) view.sets = view.sets.slice(0, -1);
  view.inTiebreak = tiebreak;
  if (lowest !== current || superTiebreak) {
    view.points = tiebreak
      ? [String(lowest.firstParticipantScore), String(lowest.secondParticipantScore)]
      : tennisPoints(lowest.firstParticipantScore, lowest.secondParticipantScore);
  }
  return view;
}

function deepestLast(score: LiveScore): LiveScore {
  let node = score;
  while (node.detailedResult && node.detailedResult.length > 0) {
    node = node.detailedResult[node.detailedResult.length - 1];
  }
  return node;
}
