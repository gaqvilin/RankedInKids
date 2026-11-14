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

/** auth: include enter-result buttons for the logged-in account (slower, not shared-cached). */
export async function getUpcomingMatches(playerId: number, fresh = false, auth = false): Promise<UpcomingMatch[]> {
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
  }>(`player/GetPlayerMatchesAsync?playerid=${playerId}&takehistory=false&skip=0&take=30&language=sv`, { fresh, auth });

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

/** fresh: skip every cache (organiser just changed pairs). */
export async function getClassPairs(tournamentId: number, classId: number, fresh = false): Promise<Pair[]> {
  type RP = { Id: number; Name: string; RankedinId: string | null; HasValidLicense: boolean } | null;
  const raw = await rin<{
    Participants: { Participant: { FirstPlayer: RP; SecondPlayer: RP; Seed: string } }[];
  }>(`Tournament/GetPlayersForClassAsync?tournamentId=${tournamentId}&tournamentClassId=${classId}&language=sv`, fresh ? { fresh: true, auth: true } : {});
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
  /** A playoff match Rankedin has scheduled but not listed yet: at least one pair is still "1:a grupp B". */
  upcoming?: boolean;
  /** Set on playoff matches: the round ("Final", "Om plats 3–4"). */
  playoff?: string;
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
  }>(`tournament/GetMatchesSectionAsync?Id=${tournamentId}&LanguageCode=sv&IsReadonly=true`, { fresh, auth: true });

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
    >(`TeamLeague/GetTeamLeagueTeamsMatchesAsync?teamMatchId=${teamMatchId}&language=sv`, { fresh, auth: true }),
    rin<Record<'firstTeam' | 'secondTeam', RawLineupTeam>>(`TeamLeague/GetTeamsLineupsAsync?teamMatchId=${teamMatchId}&language=sv`, { fresh, auth: true }),
    rin<{ scoresViewModels: { participantName: string; participantUrl: string }[] }>(
      `TeamLeague/TeamLeagueTeamMatchStandingsAsync?teamMatchId=${teamMatchId}&language=sv`,
    ).catch(() => ({ scoresViewModels: [] })),
  ]);

  // Lineup names can be truncated ("Varberg Padelklubb G..."); standings carry full names.
  const fullName = (team: { id: number; name: string }) =>
    standings.scoresViewModels.find((s) => s.participantUrl?.endsWith(`/${team.id}`))?.participantName || team.name;

  // Lineup slots come from the first block (one match type); results and score from every block.
  const block = rawMatches?.[0]?.matches;
  const allRaw = (rawMatches ?? []).flatMap((b) => b?.matches?.matches ?? []);
  const emptyTeam = { id: 0, name: 'Okänt lag', players: [], canLineupTeam: false } as unknown as RawLineupTeam;
  const firstTeam = lineups?.firstTeam ?? emptyTeam;
  const secondTeam = lineups?.secondTeam ?? emptyTeam;
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
  // Rankedin names unset lineup slots "Pending" (id 0); keep only real players.
  const side = (s: RawTLSide, won: boolean): Side => {
    const slots: [string | null, number | null][] = s ? [[s.name, s.player1Id], [s.player2Name, s.player2Id]] : [];
    const real = slots.filter((x): x is [string, number] => !!x[0] && !!x[1]);
    return { names: real.map((x) => x[0]), ids: real.map((x) => x[1]), isWinner: won };
  };
  const matches: TournamentMatch[] = allRaw.map((m) => {
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
      { id: firstTeam.id, name: fullName(firstTeam) },
      { id: secondTeam.id, name: fullName(secondTeam) },
    ],
    score: [matches.filter((m) => m.sides[0].isWinner).length, matches.filter((m) => m.sides[1].isWinner).length],
    matches,
    canLineup: [!!firstTeam.canLineupTeam, !!secondTeam.canLineupTeam],
    rosters: [roster(firstTeam), roster(secondTeam)],
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

export type TeamMatchInfo = { date: string | null; division: string | null; leagueId: number | null; leagueName: string | null };

/** Date, division and league for a team match (null fields when Rankedin hasn't opened it yet). */
export async function getTeamMatchInfo(teamMatchId: number): Promise<TeamMatchInfo> {
  const raw = await rin<{
    teamLeagueId: number;
    teamMatchResultsModel: {
      matchDate: string | null;
      pool: { divisionName: string | null } | null;
      eventInfo: { id: number; name: string } | null;
    } | null;
  }>(`TeamLeague/GetTeamMatchResultModelAsync?matchId=${teamMatchId}`);
  const m = raw.teamMatchResultsModel;
  return {
    date: m?.matchDate ?? null,
    division: m?.pool?.divisionName ?? null,
    leagueId: m?.eventInfo?.id ?? (raw.teamLeagueId || null),
    leagueName: m?.eventInfo?.name?.trim() ?? null,
  };
}

/**
 * Organiser HTML from Rankedin → plain paragraphs. We never render their HTML
 * directly; tags are dropped and entities decoded.
 */
export function htmlToParagraphs(html: string | null | undefined): string[] {
  if (!html) return [];
  const withBreaks = html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/\s*(p|div|li|h\d|tr)\s*>/gi, '\n')
    .replace(/<\s*li[^>]*>/gi, '• ');
  const noTags = withBreaks.replace(/<[^>]*>/g, '');
  const decoded = noTags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
  return decoded
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

export type TournamentDetails = {
  venue: string | null;
  address: string | null;
  mapUrl: string | null;
  organiser: { name: string; rankedinId: string | null } | null;
  sanctioned: boolean;
  fees: { className: string; price: number; currency: string }[];
  regulations: string[];
};

export async function getTournamentDetails(id: number): Promise<TournamentDetails> {
  const [info, regs] = await Promise.all([
    rin<{
      TournamentSidebarModel: {
        LocationName: string | null;
        Address: string | null;
        Latitude: number | null;
        Longtitude: number | null;
        HasFee: boolean;
        Fees: { Price: number; CurrencyCode: string; ClassName: string }[] | null;
        Rankings: { Name: string }[] | null;
        AdminCarouselVm: { AdminsList: { Name: string; Url: string }[] | null } | null;
      };
    }>(`Tournament/GetInfoAsync?id=${id}&language=sv`),
    rin<string | null>(`Tournament/GetRegulationsAsync?id=${id}&language=sv`).catch(() => null),
  ]);
  const t = info.TournamentSidebarModel;
  const admin = t.AdminCarouselVm?.AdminsList?.[0];
  const address = t.Address ? t.Address.replace(/,\s*Sweden$/i, '').trim() : null;
  return {
    venue: t.LocationName,
    address,
    mapUrl: t.Latitude && t.Longtitude ? `https://www.google.com/maps/search/?api=1&query=${t.Latitude},${t.Longtitude}` : address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : null,
    organiser: admin ? { name: admin.Name, rankedinId: admin.Url.match(/R\d{9}/)?.[0] ?? null } : null,
    sanctioned: (t.Rankings || []).some((r) => /SPF/i.test(r.Name)),
    fees: t.HasFee ? (t.Fees || []).filter((f) => f.Price > 0).map((f) => ({ className: f.ClassName, price: f.Price, currency: f.CurrencyCode })) : [],
    regulations: htmlToParagraphs(typeof regs === 'string' ? regs : null),
  };
}

/** Series text written by the league organiser (e.g. SPF for SPL/Klubbligan). */
export async function getLeagueRegulations(id: number): Promise<string[]> {
  const regs = await rin<string | null>(`TeamLeague/GetRegulationsAsync?id=${id}&language=sv`).catch(() => null);
  return htmlToParagraphs(typeof regs === 'string' ? regs : null);
}

// ---------- Draws (groups) ----------

export type DrawPair = { index: number; names: string[]; ids: number[] };
export type DrawCell = { matchId: number; challengeId: number; date: string | null; court: string | null; played: boolean };
export type DrawStanding = {
  position: number;
  names: string[];
  ids: number[];
  played: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  gamesWon: number;
  gamesLost: number;
};
/** cells is a plain object ("row-col" → cell), not a Map, so it survives the device cache (JSON). */
export type DrawGroup = { name: string; pairs: DrawPair[]; cells: Record<string, DrawCell>; standings: DrawStanding[] };

/** Rankedin's group draws for a class: pairs, the match grid (row vs column) and the official standings. */
export async function getClassDraws(classId: number, fresh = false): Promise<DrawGroup[]> {
  type RP = { Id: number; Name: string } | null;
  type Cell = {
    CellType: string;
    ParticipantCell: { Index: number; Rotated: boolean; Players: RP[] } | null;
    MatchCell: { MatchId: number; ChallengeId: number; Date: string | null; Court: string | null; ShowDate: boolean; MatchResults: { IsPlayed: boolean } | null } | null;
  };
  type St = {
    DoublesPlayer1Model: RP;
    DoublesPlayer2Model: RP;
    Standing: number;
    Played: number;
    Wins: number;
    Draws?: number;
    Losses: number;
    MatchPoints: number;
    GamesWon: number;
    GamesLost: number;
  };
  const raw = await rin<{ BaseType: string; RoundRobin: { Name: string; Pool: Cell[][]; Standings: St[] } | null }[]>(
    `tournament/GetDrawsForStageAndStrengthAsync?tournamentClassId=${classId}&drawStrength=0&drawStage=0&isReadonly=true&language=sv`,
    fresh ? { fresh: true, auth: true } : {},
  );
  const players = (list: RP[]) => list.filter((p): p is NonNullable<RP> => !!p && p.Id > 0);
  return (raw || [])
    .filter((d) => d.RoundRobin && Array.isArray(d.RoundRobin.Pool))
    .map((d) => {
      const rr = d.RoundRobin!;
      const pairs: DrawPair[] = [];
      const cells: Record<string, DrawCell> = {};
      rr.Pool.forEach((row, r) => {
        row.forEach((cell, c) => {
          // Row headers (first column) list the pairs in order.
          if (cell.CellType === 'ParticipantCell' && c === 0 && cell.ParticipantCell && !cell.ParticipantCell.Rotated) {
            const ps = players(cell.ParticipantCell.Players);
            pairs.push({ index: cell.ParticipantCell.Index, names: ps.map((p) => p.Name), ids: ps.map((p) => p.Id) });
          }
          if (cell.CellType === 'MatchCell' && cell.MatchCell) {
            const m = cell.MatchCell;
            cells[`${r}-${c}`] = { matchId: m.MatchId, challengeId: m.ChallengeId, date: m.ShowDate ? m.Date : null, court: m.Court, played: !!m.MatchResults?.IsPlayed };
          }
        });
      });
      const standings = (rr.Standings || []).map((s) => {
        const ps = players([s.DoublesPlayer1Model, s.DoublesPlayer2Model]);
        return { position: s.Standing, names: ps.map((p) => p.Name), ids: ps.map((p) => p.Id), played: s.Played, wins: s.Wins, draws: s.Draws ?? 0, losses: s.Losses, points: s.MatchPoints, gamesWon: s.GamesWon, gamesLost: s.GamesLost };
      });
      return { name: rr.Name.replace(/^Group\b/i, 'Grupp'), pairs, cells, standings };
    })
    .filter((g) => g.pairs.length > 0);
}

/** One side of a playoff match: real players once known, else Rankedin's placeholder ("Group A#1" → group A, place 1). */
export type PlayoffSide = { names: string[]; ids: number[]; group: string | null; place: number | null };
export type PlayoffMatch = {
  matchId: number;
  challengeId: number;
  round: number;
  maxRound: number;
  order: number;
  date: string | null;
  court: string | null;
  /** Places decided by the match when it's a placement draw (e.g. [3, 4]), else null. */
  places: [number, number] | null;
  sides: [PlayoffSide, PlayoffSide];
};

/** Rankedin's playoff (stage 1, elimination) for a class; empty when the class has only groups. */
export async function getClassPlayoff(classId: number, fresh = false): Promise<PlayoffMatch[]> {
  type RPl = { Id: number; Name: string | null } | null;
  type RPart = { FirstPlayer: RPl; SecondPlayer: RPl } | null;
  type RCell = {
    Round: number;
    MaxRound: number;
    MatchOrder: number;
    MatchId: number;
    ChallengeId: number;
    Date: string | null;
    CourtName: string | null;
    ShouldShowSchedule: boolean;
    ChallengerParticipant: RPart;
    ChallengedParticipant: RPart;
  };
  type RElim = { DrawCells: RCell[] | null; Consolation: number; PlacesStartPos: number } | null;
  const raw = await rin<{ Elimination: RElim }[]>(
    `tournament/GetDrawsForStageAndStrengthAsync?tournamentClassId=${classId}&drawStrength=0&drawStage=1&isReadonly=true&language=sv`,
    fresh ? { fresh: true, auth: true } : {},
  );
  const side = (p: RPart): PlayoffSide => {
    const real = [p?.FirstPlayer, p?.SecondPlayer].filter((x): x is NonNullable<RPl> => !!x && x.Id > 0 && !!x.Name);
    if (real.length) return { names: real.map((x) => x.Name!), ids: real.map((x) => x.Id), group: null, place: null };
    const m = /group\s+(\S+)\s*#\s*(\d+)/i.exec(p?.FirstPlayer?.Name || '');
    return { names: [], ids: [], group: m ? m[1] : null, place: m ? Number(m[2]) : null };
  };
  return (raw || []).flatMap((d) => {
    const e = d.Elimination;
    if (!e || !Array.isArray(e.DrawCells)) return [];
    // Placement draws ("Consolation") play every round-1 match for two places: 1–2, 3–4, …
    const placement = !!e.Consolation && e.DrawCells.every((c) => c.MaxRound === 1);
    const start = e.PlacesStartPos || 1;
    return e.DrawCells.map((c) => ({
      matchId: c.MatchId,
      challengeId: c.ChallengeId,
      round: c.Round,
      maxRound: c.MaxRound,
      order: c.MatchOrder,
      date: c.ShouldShowSchedule ? c.Date : null,
      court: c.CourtName,
      places: placement ? ([start + 2 * (c.MatchOrder - 1), start + 2 * (c.MatchOrder - 1) + 1] as [number, number]) : null,
      sides: [side(c.ChallengerParticipant), side(c.ChallengedParticipant)] as [PlayoffSide, PlayoffSide],
    }));
  });
}

/** "Final", "Om plats 3–4", "Semifinal" … */
export function playoffRoundName(m: PlayoffMatch): string {
  if (m.places) return m.places[0] === 1 ? 'Final' : `Om plats ${m.places[0]}–${m.places[1]}`;
  const left = m.maxRound - m.round;
  return left === 0 ? 'Final' : left === 1 ? 'Semifinal' : left === 2 ? 'Kvartsfinal' : `Omgång ${m.round}`;
}

/**
 * Playoff matches as match cards, so the schedule shows them (time and court) before Rankedin lists them.
 * A pair that is not decided yet is named by its place: "1:a grupp B".
 */
export function playoffAsMatches(className: string, list: PlayoffMatch[]): TournamentMatch[] {
  const side = (s: PlayoffSide): Side => ({
    names: s.names.length ? s.names : s.group && s.place ? [`${s.place}:${s.place <= 2 ? 'a' : 'e'} grupp ${s.group}`] : [],
    ids: s.ids,
    isWinner: false,
  });
  return list.map((m) => ({
    id: m.challengeId,
    date: m.date,
    className,
    draw: playoffRoundName(m),
    court: m.court,
    sides: [side(m.sides[0]), side(m.sides[1])],
    sets: [],
    played: false,
    canEnterResult: false,
    awaitingConfirmation: false,
    upcoming: true,
    playoff: playoffRoundName(m),
  }));
}

/** Group letter from our group name ("Grupp A" → "A"). */
export const groupLetter = (name: string) => name.replace(/^(grupp|group)\s*/i, '').trim();

/** A group is decided when every pair has played everyone else. */
export const groupDone = (g: DrawGroup) => g.standings.length > 0 && g.standings.every((s) => s.played >= g.pairs.length - 1);

/** Fill a placeholder side from the group tables: decided → the pair, otherwise the current holder of that place. */
export function resolvePlayoffSide(s: PlayoffSide, groups: DrawGroup[]): PlayoffSide & { label: string | null; provisional: boolean } {
  if (s.names.length || !s.group || !s.place) return { ...s, label: null, provisional: false };
  const label = `${s.place}:${s.place <= 2 ? 'a' : 'e'} grupp ${s.group}`;
  const g = groups.find((x) => groupLetter(x.name).toUpperCase() === s.group!.toUpperCase());
  const anyPlayed = !!g && g.standings.some((x) => x.played > 0);
  const st = anyPlayed ? g!.standings.find((x) => x.position === s.place) : undefined;
  if (!st) return { ...s, label, provisional: false };
  return { ...s, names: st.names, ids: st.ids, label, provisional: !groupDone(g!) };
}
