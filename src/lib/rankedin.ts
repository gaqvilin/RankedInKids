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
  clubId: number | null;
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
      HomeClubUrl: string | null;
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
    clubId: Number(h.HomeClubUrl?.match(/organisation\/(\d+)/)?.[1]) || null,
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
  teamMatchId: number | null;
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
        TeamModel: { Team1Name: string; Team2Name: string; TeamMatchLink: string | null } | null;
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
      teamMatchId: Number(m.Info.TeamModel?.TeamMatchLink?.match(/matchresults\/(\d+)/)?.[1]) || null,
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

export type CalendarLevel = 'Step In' | 'Level Up' | 'SPT Future' | 'USM' | 'Övrigt';

export type CalendarEvent = {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  address: string | null;
  /** Best guess of the town, from the address ("Härdgatan 7, 432 32 Varberg, Sverige" → "Varberg"). */
  town: string | null;
  level: CalendarLevel;
  sanctioned: boolean;
};

export function levelFromName(name: string): CalendarLevel {
  const n = name.toLowerCase();
  if (/spt\s*future/.test(n)) return 'SPT Future';
  if (/\busm\b|ungdoms-?sm/.test(n)) return 'USM';
  if (/level\s*up/.test(n)) return 'Level Up';
  if (/step\s*-?\s*in/.test(n)) return 'Step In';
  return 'Övrigt';
}

export function townFromAddress(address: string | null): string | null {
  if (!address) return null;
  const parts = address
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p && !/^(sverige|sweden)$/i.test(p));
  const withZip = parts.find((p) => /^\d{3}\s?\d{2}\s+\S/.test(p));
  if (withZip) return withZip.replace(/^\d{3}\s?\d{2}\s+/, '');
  const last = parts[parts.length - 1];
  return last && !/\d/.test(last) ? last : null;
}

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
    }[]
  >(`Calendar/GetEventsAsync?Country=${COUNTRY_SWEDEN}&Sport=${SPORT_PADEL}&CalendarAgeGroups=1&CalendarDateFilter=1&From=0&Take=100${geo}`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return (raw || [])
    .filter((e) => e.Type === 4 && new Date(e.EndDate || e.StartDate) >= today)
    .map((e) => ({
      id: e.EventId,
      name: e.EventName.trim(),
      startDate: e.StartDate,
      endDate: e.EndDate,
      address: e.Address,
      town: townFromAddress(e.Address),
      level: levelFromName(e.EventName),
      sanctioned: /SPF/i.test(e.OrganisationName || ''),
    }))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
}

export function rinUrl(path: string): string {
  if (!path) return RIN_WEB;
  if (/^https?:/.test(path)) return path;
  return `${RIN_WEB}${path.startsWith('/') ? '' : '/'}${path}`;
}

// ---------- Team league matches (e.g. Klubbligan) ----------

export type LineupPlayer = { id: number; name: string; rankedinId: string | null; hasLicense: boolean; rating: number | null; points: number | null };

export type TeamMatch = {
  id: number;
  eventId: number;
  finished: boolean;
  teams: [{ id: number; name: string }, { id: number; name: string }];
  /** Whether the logged-in user may set each team's lineup (team captain/admin). */
  canLineup: [boolean, boolean];
  /** Players available for each team's lineup (only visible to captains). */
  rosters: [LineupPlayer[], LineupPlayer[]];
  matchType: number;
  /** Current player ids per individual match, 0 = not set. */
  slots: { challengeId: number; first: number[]; second: number[] }[];
  /** Individual matches won by each team. */
  score: [number, number];
  matches: TournamentMatch[];
};

type RawTLSide = { name: string; player2Name: string | null; player1Id: number; player2Id: number | null } | null;

export async function getTeamMatch(teamMatchId: number, fresh = false): Promise<TeamMatch> {
  const [rawMatches, lineups, standings] = await Promise.all([
    rin<
      {
        matches: {
          eventId: number;
          isEventFinished: boolean;
          matches: {
            id: number;
            date: string | null;
            challenger: RawTLSide;
            challenged: RawTLSide;
            matchResult: {
              isPlayed: boolean;
              isFirstParticipantWinner: boolean | null;
              score: { detailedScoring: { firstParticipantScore: number; secondParticipantScore: number }[] | null } | null;
            } | null;
            enterResultsButton: boolean;
            awaitingResultConfirmation?: boolean;
          }[];
        };
      }[]
    >(`TeamLeague/GetTeamLeagueTeamsMatchesAsync?teamMatchId=${teamMatchId}&language=sv`, { fresh }),
    rin<Record<'firstTeam' | 'secondTeam', RawLineupTeam>>(`TeamLeague/GetTeamsLineupsAsync?teamMatchId=${teamMatchId}&language=sv`, { fresh }),
    rin<{ scoresViewModels: { participantName: string; participantUrl: string }[] }>(
      `TeamLeague/TeamLeagueTeamMatchStandingsAsync?teamMatchId=${teamMatchId}&language=sv`,
    ).catch(() => ({ scoresViewModels: [] })),
  ]);

  // Lineup names can be truncated ("Varberg Padelklubb G..."); standings carry full names.
  const fullName = (team: { id: number; name: string }) =>
    standings.scoresViewModels.find((s) => s.participantUrl?.endsWith(`/${team.id}`))?.participantName || team.name;

  const block = rawMatches[0]?.matches;
  const matchType = (rawMatches[0] as unknown as { settings?: { matchType: number } })?.settings?.matchType ?? 3;
  const licenseRequired = (lineups as unknown as { isLicenseRequired?: boolean }).isLicenseRequired !== false;
  const roster = (t: RawLineupTeam): LineupPlayer[] =>
    (t.players || []).map((p) => ({
      id: p.playerId,
      name: `${p.firstName} ${p.lastName}`.trim(),
      rankedinId: p.playerRankedinId,
      hasLicense: !licenseRequired || p.hasLicense,
      rating: p.ratingBegin,
      points: p.rankingTypePoints?.length ? Math.max(...p.rankingTypePoints.map((r) => r.points)) : null,
    }));
  const side = (s: RawTLSide, won: boolean): Side => ({
    names: s ? [s.name, s.player2Name].filter((n): n is string => !!n) : [],
    ids: s ? [s.player1Id, s.player2Id].filter((n): n is number => !!n) : [],
    isWinner: won,
  });
  const matches: TournamentMatch[] = (block?.matches || []).map((m) => {
    const r = m.matchResult;
    const played = !!r?.isPlayed;
    return {
      id: m.id,
      date: null,
      className: '',
      draw: '',
      court: null,
      sides: [side(m.challenger, played && r?.isFirstParticipantWinner === true), side(m.challenged, played && r?.isFirstParticipantWinner === false)],
      sets: (r?.score?.detailedScoring || []).map((s) => [s.firstParticipantScore, s.secondParticipantScore] as [number, number]),
      played,
      canEnterResult: !!m.enterResultsButton,
      awaitingConfirmation: !!m.awaitingResultConfirmation,
    };
  });

  return {
    id: teamMatchId,
    eventId: block?.eventId ?? 0,
    finished: !!block?.isEventFinished,
    teams: [
      { id: lineups.firstTeam.id, name: fullName(lineups.firstTeam) },
      { id: lineups.secondTeam.id, name: fullName(lineups.secondTeam) },
    ],
    score: [matches.filter((m) => m.sides[0].isWinner).length, matches.filter((m) => m.sides[1].isWinner).length],
    matches,
    canLineup: [!!lineups.firstTeam.canLineupTeam, !!lineups.secondTeam.canLineupTeam],
    rosters: [roster(lineups.firstTeam), roster(lineups.secondTeam)],
    matchType,
    slots: (block?.matches || []).map((m) => ({
      challengeId: m.id,
      first: [m.challenger?.player1Id || 0, m.challenger?.player2Id || 0],
      second: [m.challenged?.player1Id || 0, m.challenged?.player2Id || 0],
    })),
  };
}

type RawLineupTeam = {
  id: number;
  name: string;
  canLineupTeam: boolean;
  players: {
    playerId: number;
    firstName: string;
    lastName: string;
    playerRankedinId: string | null;
    hasLicense: boolean;
    ratingBegin: number | null;
    rankingTypePoints?: { rankingType: number; points: number }[] | null;
  }[];
};

/** Turns a pasted rankedin.com link into an in-app path, if we have a view for it. */
export function appPathFromRankedinUrl(input: string): string | null {
  const s = input.trim();
  const team = s.match(/team\/matchresults\/(\d+)/i);
  if (team) return `/lagmatch/${team[1]}`;
  const teamHome = s.match(/team\/homepage\/(\d+)/i);
  if (teamHome) return `/lag/${teamHome[1]}`;
  const club = s.match(/organi[sz]ation\/(\d+)/i);
  if (club) return `/klubb/${club[1]}`;
  const league = s.match(/teamleague\/(\d+)/i);
  if (league) return `/liga/${league[1]}`;
  const tour = s.match(/tournament\/(\d+)/i);
  if (tour) return `/tavling/${tour[1]}`;
  const player = s.match(/R\d{9}/i);
  if (player) return `/spelare/${player[0].toUpperCase()}`;
  return null;
}
