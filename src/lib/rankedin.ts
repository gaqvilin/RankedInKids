// Rankedin read model: raw PascalCase payloads in, small domain types out.
import { rin } from './api';

export const SPORT_PADEL = 5;
export const COUNTRY_SWEDEN = 152;
export const RIN_WEB = 'https://www.rankedin.com';

// ---------- Players ----------

export type PlayerHit = { id: number; name: string; rankedinId: string };

export async function searchPlayers(name: string): Promise<PlayerHit[]> {
  const raw = await rin<{ Id: number; Name: string; RankedinId: string }[]>(
    `Search/GetPlayersByNameSimpleAsync?name=${encodeURIComponent(name)}&take=12&skip=0`,
  );
  return (raw || []).map((p) => ({ id: p.Id, name: p.Name, rankedinId: p.RankedinId }));
}

export type Profile = {
  id: number;
  rankedinId: string;
  name: string;
  firstName: string;
  club: string | null;
  age: string | null;
  form: string[];
  doublesThisYear: string;
  doublesCareer: string;
  imageUrl: string | null;
};

export async function getProfile(rankedinId: string): Promise<Profile> {
  const raw = await rin<{
    Header: {
      PlayerId: number;
      RankedinId: string;
      FirstName: string;
      LastName: string;
      HomeClubName: string | null;
      Age: string | null;
      Form: string[] | null;
      ImageThumbnailUrl: string | null;
    };
    Statistics: { WinLossDoublesCurrentYear: string; CareerWinLossDoubles: string };
  }>(`Player/PlayerProfileInfoAsync?rankedinId=${encodeURIComponent(rankedinId)}&language=sv`);
  const h = raw.Header;
  return {
    id: h.PlayerId,
    rankedinId: h.RankedinId,
    name: `${h.FirstName} ${h.LastName}`.trim(),
    firstName: h.FirstName,
    club: h.HomeClubName,
    age: h.Age,
    form: h.Form || [],
    doublesThisYear: raw.Statistics?.WinLossDoublesCurrentYear || '0-0',
    doublesCareer: raw.Statistics?.CareerWinLossDoubles || '0-0',
    imageUrl: h.ImageThumbnailUrl && !h.ImageThumbnailUrl.includes('rin_logo') ? h.ImageThumbnailUrl : null,
  };
}

export type EventKind = 'tournament' | 'teamleague' | 'clubleague' | 'other';

export type PlayerEvent = {
  id: number;
  name: string;
  kind: EventKind;
  state: number; // 1 = open/upcoming, 2 = closed for sign-in, 3 = ongoing, 4 = finished
  startDate: string;
  link: string;
};

function eventKind(type: number): EventKind {
  if (type === 4) return 'tournament';
  if (type === 3) return 'teamleague';
  if (type === 2) return 'clubleague';
  return 'other';
}

export async function getPlayerEvents(playerId: number): Promise<PlayerEvent[]> {
  const raw = await rin<{
    Payload: { Id: number; Name: string; Type: number; State: number; StartDate: string; Link: string }[];
  }>(`Player/ParticipatedEventsAsync?PlayerId=${playerId}&Language=sv&Skip=0&Take=30`);
  return (raw.Payload || []).map((e) => ({
    id: e.Id,
    name: e.Name,
    kind: eventKind(e.Type),
    state: e.State,
    startDate: e.StartDate,
    link: e.Link,
  }));
}

// ---------- Matches ----------

export type Side = { names: string[]; ids: number[]; isWinner: boolean };

export type UpcomingMatch = {
  challengeId: number;
  matchId: number;
  eventName: string;
  eventUrl: string;
  eventKind: EventKind;
  date: string | null;
  court: string | null;
  location: string | null;
  teamNames: [string, string] | null;
  sides: [Side, Side];
  refereeCode: string | null;
  sets: [number, number][];
  canEnterResult: boolean;
  awaitingConfirmation: boolean;
  canConfirm: boolean;
};

type RawP = { Id: number; Name: string; IsWinner: boolean } | null;

export async function getUpcomingMatches(playerId: number, fresh = false): Promise<UpcomingMatch[]> {
  const raw = await rin<{
    Payload: {
      ChallengeId: number;
      MatchId: number;
      Info: {
        EventName: string;
        EventType: number;
        EventUrl: string;
        Challenger: RawP;
        Challenged: RawP;
        Challenger1: RawP;
        Challenged1: RawP;
        TeamModel: { Team1Name: string; Team2Name: string } | null;
        RefereeCode: string | null;
        Date: string | null;
        Location: string | null;
        Court: string | null;
      };
      Score: { Score: { Score1: number; Score2: number }[] } | null;
      Buttons: Record<string, { IsActive: boolean } | number>;
    }[];
  }>(`player/GetPlayerMatchesAsync?playerid=${playerId}&takehistory=false&skip=0&take=30&language=sv`, { fresh });

  const side = (a: RawP, b: RawP): Side => {
    const players = [a, b].filter((p): p is NonNullable<RawP> => !!p && !!p.Id);
    return { names: players.map((p) => p.Name), ids: players.map((p) => p.Id), isWinner: !!a?.IsWinner };
  };
  const active = (b: Record<string, { IsActive: boolean } | number>, key: string) =>
    typeof b?.[key] === 'object' && !!(b[key] as { IsActive: boolean }).IsActive;

  return (raw.Payload || [])
    .filter((m) => m.ChallengeId > 0 && m.Info?.EventName !== 'EventName')
    .map((m) => ({
      challengeId: m.ChallengeId,
      matchId: m.MatchId,
      eventName: m.Info.EventName,
      eventUrl: m.Info.EventUrl,
      eventKind: eventKind(m.Info.EventType),
      date: parseRinDate(m.Info.Date),
      court: m.Info.Court,
      location: m.Info.Location,
      teamNames: m.Info.TeamModel ? [m.Info.TeamModel.Team1Name, m.Info.TeamModel.Team2Name] : null,
      sides: withoutUnplayedWinner(
        [side(m.Info.Challenger, m.Info.Challenger1), side(m.Info.Challenged, m.Info.Challenged1)],
        (m.Score?.Score || []).length > 0,
      ),
      refereeCode: m.Info.RefereeCode,
      sets: (m.Score?.Score || []).map((s) => [s.Score1, s.Score2] as [number, number]),
      canEnterResult: active(m.Buttons, 'EnterResult') || active(m.Buttons, 'EditResult'),
      awaitingConfirmation: active(m.Buttons, 'AwaitingResultConfirmation'),
      canConfirm: active(m.Buttons, 'ConfirmResult'),
    }));
}

/** Only mark a winner once there is a score to show. */
function withoutUnplayedWinner(sides: [Side, Side], hasScore: boolean): [Side, Side] {
  return hasScore ? sides : [{ ...sides[0], isWinner: false }, { ...sides[1], isWinner: false }];
}

/** Rankedin player-match dates come as "dd/MM/yyyy HH:mm". */
export function parseRinDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const m = value.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  if (!m) return value;
  const [, dd, mm, yyyy, hh = '00', mi = '00'] = m;
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:00`;
}

// ---------- Tournaments ----------

export type TournamentHeader = {
  id: number;
  name: string;
  city: string | null;
  startDate: string;
  endDate: string;
  closeSignInDate: string | null;
  signInOpen: boolean;
  state: number;
  isPremium: boolean;
  url: string;
  playerCount: number;
};

export async function getTournament(id: number): Promise<TournamentHeader> {
  const h = await rin<{
    Id: number;
    Name: string;
    City: string | null;
    StartDate: string;
    EndDate: string;
    CloseSignInDate: string | null;
    EventState: number;
    EventStatusText: string;
    IsPremium: boolean;
    EventUrl: string;
    UniquePlayersCount: number;
  }>(`Tournament/GetHeaderAsync?id=${id}&language=sv`);
  return {
    id: h.Id,
    name: h.Name,
    city: h.City,
    startDate: h.StartDate,
    endDate: h.EndDate,
    closeSignInDate: h.CloseSignInDate,
    signInOpen: /SignInOpen/i.test(h.EventStatusText || ''),
    state: h.EventState,
    isPremium: !!h.IsPremium,
    url: h.EventUrl,
    playerCount: h.UniquePlayersCount,
  };
}

export type TournamentClass = { id: number; name: string; published: boolean };

export async function getClasses(tournamentId: number): Promise<TournamentClass[]> {
  const raw = await rin<{ Id: number; Name: string; IsPublished: boolean }[]>(
    `Tournament/GetClassesAndDrawNamesAsync?tournamentId=${tournamentId}`,
  );
  return (raw || []).map((c) => ({ id: c.Id, name: c.Name, published: c.IsPublished }));
}

export type Pair = {
  players: { id: number; name: string; rankedinId: string | null; hasLicense: boolean }[];
  missingPartner: boolean;
  seed: string;
};

export async function getClassPairs(tournamentId: number, classId: number): Promise<Pair[]> {
  type RP = { Id: number; Name: string; RankedinId: string | null; HasValidLicense: boolean } | null;
  const raw = await rin<{
    Participants: { Participant: { FirstPlayer: RP; SecondPlayer: RP; Seed: string } }[];
  }>(`Tournament/GetPlayersForClassAsync?tournamentId=${tournamentId}&tournamentClassId=${classId}&language=sv`);
  return (raw.Participants || []).map(({ Participant: p }) => {
    const players = [p.FirstPlayer, p.SecondPlayer]
      .filter((x): x is NonNullable<RP> => !!x && x.Id > 0)
      .map((x) => ({ id: x.Id, name: x.Name, rankedinId: x.RankedinId, hasLicense: x.HasValidLicense }));
    return { players, missingPartner: players.length < 2, seed: p.Seed || '' };
  });
}

export type TournamentMatch = {
  id: number;
  date: string | null;
  className: string;
  draw: string;
  court: string | null;
  sides: [Side, Side];
  sets: [number, number][];
  played: boolean;
  canEnterResult: boolean;
  awaitingConfirmation: boolean;
};

export async function getTournamentMatches(tournamentId: number, fresh = false): Promise<TournamentMatch[]> {
  type RSide = { Name: string; Player2Name: string | null; Player1Id: number; Player2Id: number | null } | null;
  const raw = await rin<{
    Matches: {
      Id: number;
      Date: string | null;
      Challenger: RSide;
      Challenged: RSide;
      TournamentClassName: string;
      Draw: string;
      Court: string | null;
      IsMatchScheduled: boolean;
      MatchResult: {
        IsPlayed: boolean;
        IsFirstParticipantWinner: boolean | null;
        Score: { DetailedScoring: { FirstParticipantScore: number; SecondParticipantScore: number }[] | null } | null;
      } | null;
      EnterResultsButton: boolean;
      AwaitingResultConfirmation: boolean;
    }[];
  }>(`tournament/GetMatchesSectionAsync?Id=${tournamentId}&LanguageCode=sv&IsReadonly=true`, { fresh });

  const side = (s: RSide, won: boolean): Side => ({
    names: s ? [s.Name, s.Player2Name].filter((n): n is string => !!n) : [],
    ids: s ? [s.Player1Id, s.Player2Id].filter((n): n is number => !!n) : [],
    isWinner: won,
  });

  return (raw.Matches || []).map((m) => {
    const r = m.MatchResult;
    const p1Won = r?.IsFirstParticipantWinner === true;
    const p2Won = r?.IsFirstParticipantWinner === false && !!r?.IsPlayed;
    return {
      id: m.Id,
      date: m.IsMatchScheduled ? m.Date : null,
      className: m.TournamentClassName,
      draw: m.Draw,
      court: m.Court,
      sides: [side(m.Challenger, p1Won), side(m.Challenged, p2Won)],
      sets: (r?.Score?.DetailedScoring || []).map((s) => [s.FirstParticipantScore, s.SecondParticipantScore] as [number, number]),
      played: !!r?.IsPlayed,
      canEnterResult: !!m.EnterResultsButton,
      awaitingConfirmation: !!m.AwaitingResultConfirmation,
    };
  });
}

// ---------- Calendar ----------

export type CalendarEvent = {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  address: string | null;
  organisation: string | null;
  sanctioned: boolean;
  posterUrl: string | null;
};

export async function getJuniorCalendar(opts: { lat?: number; lng?: number; radiusKm?: number } = {}): Promise<CalendarEvent[]> {
  const geo =
    opts.lat != null && opts.lng != null ? `&Lat=${opts.lat}&Lng=${opts.lng}&RadiusKm=${opts.radiusKm ?? 100}` : '';
  const raw = await rin<
    {
      EventId: number;
      EventName: string;
      Type: number;
      StartDate: string;
      EndDate: string;
      Address: string | null;
      OrganisationName: string | null;
      PosterUrl: string | null;
    }[]
  >(`Calendar/GetEventsAsync?Country=${COUNTRY_SWEDEN}&Sport=${SPORT_PADEL}&CalendarAgeGroups=1&From=0&Take=60${geo}`);
  return (raw || [])
    .filter((e) => e.Type === 4)
    .map((e) => ({
      id: e.EventId,
      name: e.EventName,
      startDate: e.StartDate,
      endDate: e.EndDate,
      address: e.Address,
      organisation: e.OrganisationName,
      sanctioned: /SPF/i.test(e.OrganisationName || ''),
      posterUrl: e.PosterUrl && !e.PosterUrl.includes('rin_logo') ? e.PosterUrl : null,
    }));
}

export function rinUrl(path: string): string {
  if (!path) return RIN_WEB;
  if (/^https?:/.test(path)) return path;
  return `${RIN_WEB}${path.startsWith('/') ? '' : '/'}${path}`;
}
