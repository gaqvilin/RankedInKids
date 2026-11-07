// Team leagues (SPL Swedish Padel League, Klubbligan, ...): league -> pools
// (divisions) -> teams -> team matches -> individual doubles.
import { rin } from './api';

export type LeagueSummary = { id: number; name: string; startDate: string | null; url: string };

export async function searchLeagues(term: string): Promise<LeagueSummary[]> {
  const raw = await rin<{ Url: string; Name: string; StartDate: string | null; CountryFlag: string }[]>(
    `Search/GetTeamLeaguesAsync?term=${encodeURIComponent(term)}&language=sv&take=20&skip=0`,
  );
  return (raw || [])
    .filter((l) => l.CountryFlag === 'se')
    .map((l) => ({
      id: Number(l.Url.match(/teamleague\/(\d+)/)?.[1]),
      name: l.Name.trim(),
      startDate: l.StartDate,
      url: l.Url,
    }))
    .filter((l) => l.id > 0);
}

/** The current SPL seasons (newest first, one per gender). */
export async function currentSplLeagues(): Promise<LeagueSummary[]> {
  const all = (await searchLeagues('SPL')).filter((l) => /swedish padel league/i.test(l.name));
  const season = (l: LeagueSummary) => l.name.match(/(\d{4})-(\d{2})/)?.[0] ?? '';
  const newest = all.map(season).sort().pop();
  return all.filter((l) => season(l) === newest).sort((a, b) => b.name.localeCompare(a.name, 'sv'));
}

export type Pool = { id: number; name: string; region: string; division: string };

export type League = {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  active: boolean;
  teamsCount: number | null;
  pools: Pool[];
};

/** "R6 Sydväst - Div 1 Sydväst" -> region "R6 Sydväst", division "Div 1 Sydväst". */
export function splitPoolName(name: string): { region: string; division: string } {
  const i = name.indexOf(' - ');
  return i > 0 ? { region: name.slice(0, i).trim(), division: name.slice(i + 3).trim() } : { region: '', division: name.trim() };
}

export async function getLeague(id: number): Promise<League> {
  const [header, info, pools] = await Promise.all([
    rin<{ Id: number; Name: string; StartDate: string; EndDate: string; EventState: number }>(`TeamLeague/GetHeaderAsync?id=${id}&language=sv`),
    rin<{ PoolsStatistics?: { TeamsCount: number } }>(`TeamLeague/GetInfoAsync?id=${id}&language=sv`).catch(() => ({}) as { PoolsStatistics?: { TeamsCount: number } }),
    rin<{ pools: { id: number; name: string }[] }>(`TeamLeague/GetPoolsInfoAsync?id=${id}`),
  ]);
  return {
    id: header.Id,
    name: header.Name.trim(),
    startDate: header.StartDate,
    endDate: header.EndDate,
    active: header.EventState === 3,
    teamsCount: info.PoolsStatistics?.TeamsCount ?? null,
    pools: (pools.pools || []).map((p) => ({ id: p.id, name: p.name, ...splitPoolName(p.name) })),
  };
}

export type StandingRow = {
  position: number;
  teamId: number;
  name: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  matchesWon: number;
  matchesLost: number;
  gamesWon: number;
  gamesLost: number;
};

const teamIdFromUrl = (url: string | null | undefined) => Number(url?.match(/homepage\/(\d+)/)?.[1]) || 0;

export async function getStandings(poolId: number, fresh = false): Promise<StandingRow[]> {
  const raw = await rin<{
    scoresViewModels: {
      standing: number;
      participantUrl: string;
      participantName: string;
      matchPoints: number;
      played: number;
      wins: number;
      draws: number;
      losses: number;
      gamesWon: number;
      gamesLost: number;
      scoredPoints: number;
      concededPoints: number;
    }[];
  }>(`TeamLeague/GetTeamStandingsAsync?poolId=${poolId}&language=sv`, { fresh });
  // In team standings, "games" are individual matches and "points" are games.
  return (raw.scoresViewModels || []).map((r) => ({
    position: r.standing,
    teamId: teamIdFromUrl(r.participantUrl),
    name: r.participantName,
    played: r.played,
    wins: r.wins,
    draws: r.draws,
    losses: r.losses,
    points: r.matchPoints,
    matchesWon: r.gamesWon,
    matchesLost: r.gamesLost,
    gamesWon: r.scoredPoints,
    gamesLost: r.concededPoints,
  }));
}

export type Fixture = {
  teamMatchId: number;
  round: number | null;
  date: string | null;
  location: string | null;
  home: { id: number; name: string; result: number; isWinner: boolean };
  away: { id: number; name: string; result: number; isWinner: boolean };
  played: boolean;
  canEnterResult: boolean;
  isMyTeamCaptain: boolean;
};

type RawFixture = {
  matchId: number;
  team1: { id: number; name: string; result: number; isWinner: boolean; isCurrentPlayerTeamCaptain: boolean };
  team2: { id: number; name: string; result: number; isWinner: boolean; isCurrentPlayerTeamCaptain: boolean };
  showResults: boolean;
  showPlayerEnterResultButton: boolean;
  showAdminEnterResultButton: boolean;
  location: string | null;
  details: { locationName: string | null; city: string | null; time: string | null; round: number | null } | null;
};

/** "03/10/2026 18:30" -> ISO local. */
function parseDate(value: string | null | undefined): string | null {
  const m = value?.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}T${m[4] ?? '00'}:${m[5] ?? '00'}:00`;
}

function toFixture(f: RawFixture): Fixture {
  // showResults is Rankedin's own "has a result" flag; it also covers drawn team matches (e.g. 3–3).
  const played = !!f.showResults;
  const where = [f.details?.locationName || f.location, f.details?.city].filter(Boolean).join(', ');
  return {
    teamMatchId: f.matchId,
    round: f.details?.round ?? null,
    date: parseDate(f.details?.time),
    location: where || null,
    home: { id: f.team1.id, name: f.team1.name, result: f.team1.result, isWinner: f.team1.isWinner },
    away: { id: f.team2.id, name: f.team2.name, result: f.team2.result, isWinner: f.team2.isWinner },
    played,
    canEnterResult: f.showPlayerEnterResultButton || f.showAdminEnterResultButton,
    isMyTeamCaptain: f.team1.isCurrentPlayerTeamCaptain || f.team2.isCurrentPlayerTeamCaptain,
  };
}

export async function getPoolFixtures(poolId: number, fresh = false): Promise<Fixture[]> {
  const raw = await rin<{ matches: RawFixture[] }>(`TeamLeague/GetMatchesForPoolAsync?poolId=${poolId}&language=sv`, { fresh });
  return fillMissingScores((raw.matches || []).map(toFixture), fresh);
}

export async function getTeamFixtures(teamId: number, fresh = false): Promise<Fixture[]> {
  const raw = await rin<{ matches: RawFixture[] }>(`TeamLeague/GetTeamMatchesAsync?teamId=${teamId}&language=sv`, { fresh });
  return fillMissingScores((raw.matches || []).map(toFixture), fresh);
}

/**
 * Some leagues (e.g. Klubbligan) send result 0–0 in fixture lists even for
 * played matches. The team match's own standings hold the real score: the
 * number of individual matches each team won.
 */
async function fillMissingScores(fixtures: Fixture[], fresh: boolean): Promise<Fixture[]> {
  const missing = fixtures.filter((f) => f.played && f.home.result === 0 && f.away.result === 0);
  const queue = [...missing];
  const worker = async () => {
    for (let f = queue.shift(); f; f = queue.shift()) {
      try {
        const st = await rin<{ scoresViewModels: { participantUrl: string; gamesWon: number }[] }>(
          `TeamLeague/TeamLeagueTeamMatchStandingsAsync?teamMatchId=${f.teamMatchId}&language=sv`,
          { fresh },
        );
        const won = (teamId: number) => st.scoresViewModels.find((r) => teamIdFromUrl(r.participantUrl) === teamId)?.gamesWon;
        const h = won(f.home.id);
        const a = won(f.away.id);
        if (h != null && a != null) {
          f.home = { ...f.home, result: h };
          f.away = { ...f.away, result: a };
        }
      } catch {
        /* keep 0–0 rather than failing the list */
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, queue.length) }, worker));
  return fixtures;
}

export type TeamPlayer = { id: number; name: string; rankedinId: string; hasLicense: boolean; rating: number | null; isCaptain: boolean };

export type Team = {
  id: number;
  name: string;
  club: string | null;
  clubImageUrl: string | null;
  leagueId: number;
  leagueName: string;
  poolId: number;
  region: string | null;
  division: string | null;
  players: TeamPlayer[];
  captainIds: number[];
};

export async function getTeam(teamId: number): Promise<Team> {
  const raw = await rin<{
    poolId: number;
    teamLeagueId: number;
    teamLeagueName: string;
    team: {
      id: number;
      name: string;
      homeClub: { name: string | null } | null;
      homeClubImageUrl: string | null;
      regionName: string | null;
      divisionName: string | null;
      initiator: { id: number }[];
      players: { id: number; firstName: string; lastName: string; rankedinId: string; hasLicense: boolean; ratingBegin: number | null }[];
    };
  }>(`TeamLeague/GetTeamLeagueTeamHomepageAsync?TeamId=${teamId}&Language=sv`);
  const captainIds = (raw.team.initiator || []).map((i) => i.id);
  return {
    id: raw.team.id,
    name: raw.team.name,
    club: raw.team.homeClub?.name ?? null,
    clubImageUrl: raw.team.homeClubImageUrl,
    leagueId: raw.teamLeagueId,
    leagueName: (raw.teamLeagueName || '').trim(),
    poolId: raw.poolId,
    region: raw.team.regionName,
    division: raw.team.divisionName,
    captainIds,
    players: (raw.team.players || []).map((p) => ({
      id: p.id,
      name: `${p.firstName} ${p.lastName}`.trim(),
      rankedinId: p.rankedinId,
      hasLicense: p.hasLicense,
      rating: p.ratingBegin,
      isCaptain: captainIds.includes(p.id),
    })),
  };
}

/** Which team(s) a player has in a given league. */
export async function getPlayerTeams(leagueId: number, playerId: number): Promise<{ teamId: number; name: string; division: string; region: string }[]> {
  const raw = await rin<{ teamId: number; teamName: string; divisionName: string; regionName: string }[]>(
    `TeamLeague/GetTeamLeagueTeamDetailsAsync?teamLeagueId=${leagueId}&participantId=${playerId}&language=sv`,
  );
  return (raw || []).map((t) => ({ teamId: t.teamId, name: t.teamName, division: t.divisionName, region: t.regionName }));
}

/** "Klubbligan Sydväst 10-14 år HT 26" -> sortable season key, e.g. 2026.5 for HT 26. */
export function klubbliganSeason(name: string): number | null {
  const m = name.match(/\b(HT|VT)\s*-?\s*(\d{2})\b/i);
  if (!m) return null;
  return 2000 + Number(m[2]) + (m[1].toUpperCase() === 'HT' ? 0.5 : 0);
}

/** The current season's Klubbligan leagues (youth team leagues run by SPF). */
export async function currentKlubbligan(): Promise<LeagueSummary[]> {
  const all = (await searchLeagues('Klubbligan')).filter((l) => /klubbligan/i.test(l.name));
  const seasons = all.map((l) => klubbliganSeason(l.name)).filter((s): s is number => s != null);
  if (seasons.length === 0) return [];
  const newest = Math.max(...seasons);
  return all.filter((l) => klubbliganSeason(l.name) === newest).sort((a, b) => a.name.localeCompare(b.name, 'sv'));
}

/** "Klubbligan Sydväst 10-14 år HT 26" -> "Sydväst 10–14 år". */
export function shortKlubbliganName(name: string): string {
  return name
    .replace(/^Klubbligan\s+(region\s+)?/i, '')
    .replace(/\s*\b(HT|VT)\s*-?\s*\d{2}\b.*$/i, '')
    .replace(/(\d+)-(\d+)/g, '$1–$2')
    .trim();
}
