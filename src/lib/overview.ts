// Everything a parent wants to know about one child, gathered in one place:
// upcoming matches, tournament entries (and missing partners), and league
// teams with season dates, table position and next fixture.
import { rin } from './api';
import { getPlayerTeams, getStandings, getTeam, getTeamFixtures, type Fixture } from './leagues';
import {
  getClasses,
  getClassPairs,
  getPlayerEvents,
  getTournament,
  type PlayerEvent,
} from './rankedin';

export type Entry = {
  event: PlayerEvent;
  closeSignInDate: string | null;
  signInOpen: boolean;
  className: string | null;
  partner: string | null;
  missingPartner: boolean;
};

export type LeagueTeamSummary = {
  leagueId: number;
  leagueName: string;
  startDate: string | null;
  endDate: string | null;
  active: boolean;
  teamId: number;
  teamName: string;
  division: string;
  position: number | null;
  teamsInDivision: number | null;
  points: number | null;
  next: Fixture | null;
  last: Fixture | null;
  /** All remaining team matches this season. */
  upcoming: Fixture[];
};

/** For upcoming tournaments: which class the player is in, and whether a partner is missing. */
export async function loadEntries(playerId: number, events: PlayerEvent[]): Promise<Entry[]> {
  const upcoming = events.filter((e) => e.kind === 'tournament' && e.state !== 4);
  return Promise.all(
    upcoming.map(async (event) => {
      const entry: Entry = { event, closeSignInDate: null, signInOpen: false, className: null, partner: null, missingPartner: false };
      try {
        const [header, classes] = await Promise.all([getTournament(event.id), getClasses(event.id)]);
        entry.closeSignInDate = header.closeSignInDate;
        entry.signInOpen = header.signInOpen;
        const perClass = await Promise.all(classes.map(async (c) => ({ c, pairs: await getClassPairs(event.id, c.id).catch(() => []) })));
        for (const { c, pairs } of perClass) {
          const pair = pairs.find((p) => p.players.some((x) => x.id === playerId));
          if (pair) {
            entry.className = c.name;
            entry.missingPartner = pair.missingPartner;
            entry.partner = pair.players.find((x) => x.id !== playerId)?.name ?? null;
            break;
          }
        }
      } catch {
        /* keep partial info */
      }
      return entry;
    }),
  );
}

async function leagueDates(leagueId: number): Promise<{ startDate: string | null; endDate: string | null; active: boolean }> {
  const h = await rin<{ StartDate: string; EndDate: string; EventState: number }>(`TeamLeague/GetHeaderAsync?id=${leagueId}&language=sv`);
  return { startDate: h.StartDate, endDate: h.EndDate, active: h.EventState !== 4 && new Date(h.EndDate) >= startOfToday() };
}

function startOfToday() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** The player's team in every league they play, newest season first. */
export async function loadLeagueTeams(playerId: number, events: PlayerEvent[]): Promise<LeagueTeamSummary[]> {
  const leagues = events.filter((e) => e.kind === 'teamleague');
  const results = await Promise.all(
    leagues.map(async (l): Promise<LeagueTeamSummary | null> => {
      try {
        const [teams, dates] = await Promise.all([getPlayerTeams(l.id, playerId), leagueDates(l.id)]);
        const team = teams[0];
        if (!team) return null;
        const summary: LeagueTeamSummary = {
          leagueId: l.id,
          leagueName: l.name.trim(),
          ...dates,
          teamId: team.teamId,
          teamName: team.name,
          division: team.division,
          position: null,
          teamsInDivision: null,
          points: null,
          next: null,
          last: null,
          upcoming: [],
        };
        if (dates.active) {
          const [fixtures, info] = await Promise.all([getTeamFixtures(team.teamId), getTeam(team.teamId)]);
          summary.upcoming = fixtures.filter((f) => !f.played);
          summary.next = summary.upcoming[0] ?? null;
          summary.last = [...fixtures].reverse().find((f) => f.played) ?? null;
          const table = await getStandings(info.poolId);
          const row = table.find((r) => r.teamId === team.teamId);
          summary.position = row?.position ?? null;
          summary.points = row?.points ?? null;
          summary.teamsInDivision = table.length || null;
        }
        return summary;
      } catch {
        return null;
      }
    }),
  );
  return results
    .filter((x): x is LeagueTeamSummary => !!x)
    .sort((a, b) => Number(b.active) - Number(a.active) || (b.startDate ?? '').localeCompare(a.startDate ?? ''));
}

export async function loadOverview(playerId: number) {
  const events = await getPlayerEvents(playerId);
  const [entries, leagueTeams] = await Promise.all([loadEntries(playerId, events), loadLeagueTeams(playerId, events)]);
  const pastTournaments = events.filter((e) => e.kind === 'tournament' && e.state === 4);
  return { events, entries, leagueTeams, pastTournaments };
}

/** One line in a child's schedule: a tournament or a team match. */
export type AgendaItem =
  | { kind: 'tournament'; date: string; entry: Entry }
  | { kind: 'teammatch'; date: string | null; fixture: Fixture; team: LeagueTeamSummary };

/** Everything coming up for a child, in date order. */
export function buildAgenda(entries: Entry[], leagueTeams: LeagueTeamSummary[]): AgendaItem[] {
  const items: AgendaItem[] = [
    ...entries.map((entry) => ({ kind: 'tournament' as const, date: entry.event.startDate, entry })),
    ...leagueTeams.flatMap((team) => team.upcoming.map((fixture) => ({ kind: 'teammatch' as const, date: fixture.date, fixture, team }))),
  ];
  return items.sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999'));
}
