// What belongs to "my" players (saved + logged-in accounts): their teams,
// clubs and what's coming up. Used by the sidebar; cached on the device.
import { useKnownPlayers } from './known';
import { loadOverview } from './overview';
import { getProfile } from './rankedin';
import { getSavedTeams } from './storage';
import { useAsync } from './useAsync';

export type MyTeam = { id: number; name: string; league: string; nextDate: string | null };
export type MyClub = { id: number; name: string };
export type MyUpcoming = { date: string; title: string; detail: string; who: string[]; kind: 'tournament' | 'round'; to: string };

export type Mine = { teams: MyTeam[]; clubs: MyClub[]; upcoming: MyUpcoming[] };

async function loadMine(players: { id: number; rankedinId: string; name: string }[]): Promise<Mine> {
  const perPlayer = await Promise.all(
    players.map(async (p) => {
      const [profile, overview] = await Promise.all([getProfile(p.rankedinId).catch(() => null), loadOverview(p.id).catch(() => null)]);
      return { p, profile, overview };
    }),
  );
  const teams = new Map<number, MyTeam>();
  const clubs = new Map<number, MyClub>();
  const upcoming = new Map<string, MyUpcoming>();
  const first = (n: string) => n.split(' ')[0];

  for (const { p, profile, overview } of perPlayer) {
    if (profile?.clubId && profile.club) clubs.set(profile.clubId, { id: profile.clubId, name: profile.club });
    for (const t of overview?.leagueTeams.filter((x) => x.active) ?? []) {
      const nextDate = t.next?.date?.slice(0, 10) ?? null;
      teams.set(t.teamId, { id: t.teamId, name: t.teamName, league: t.leagueName, nextDate });
      for (const d of [...new Set(t.upcoming.map((f) => f.date?.slice(0, 10)).filter((x): x is string => !!x))]) {
        const opps = t.upcoming.filter((f) => f.date?.slice(0, 10) === d).map((f) => (f.home.id === t.teamId ? f.away.name : f.home.name));
        const key = `round-${t.teamId}-${d}`;
        const prev = upcoming.get(key);
        upcoming.set(key, {
          date: d,
          title: `${t.teamName} mot ${opps.join(' och ')}`,
          detail: `Speldag · ${t.leagueName.replace(/\s*\b(HT|VT)\s*\d{2}\b.*$/i, '').replace(/^SPL Swedish Padel League\s*/i, 'SPL ')}`,
          who: [...new Set([...(prev?.who ?? []), first(p.name)])],
          kind: 'round',
          to: `/lag/${t.teamId}/omgang/${d}`,
        });
      }
    }
    for (const e of overview?.entries ?? []) {
      const date = e.event.startDate.slice(0, 10);
      const key = `t-${e.event.id}`;
      const prev = upcoming.get(key);
      upcoming.set(key, {
        date,
        title: e.event.name,
        detail: `Tävling · ${e.className ?? 'klass okänd'}${e.missingPartner ? ' · partner saknas' : e.partner ? ` · med ${e.partner}` : ''}`,
        who: [...new Set([...(prev?.who ?? []), first(p.name)])],
        kind: 'tournament',
        to: `/tavling/${e.event.id}?spelare=${p.id}${e.className ? `&klass=${encodeURIComponent(e.className)}` : ''}`,
      });
    }
  }
  // Teams saved by hand are "mine" too.
  for (const s of getSavedTeams()) if (!teams.has(s.id)) teams.set(s.id, { id: s.id, name: s.name, league: s.league, nextDate: null });

  const today = new Date().toLocaleDateString('sv-SE');
  return {
    teams: [...teams.values()],
    clubs: [...clubs.values()],
    upcoming: [...upcoming.values()].filter((u) => u.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8),
  };
}

export function useMine() {
  const players = useKnownPlayers();
  const key = players.map((p) => p.id).join(',');
  return useAsync(() => (players.length ? loadMine(players) : Promise.resolve({ teams: [], clubs: [], upcoming: [] })), [key], key ? `mine-nav.v2.${key}` : undefined);
}
