// Clubs (Rankedin "organisations"): info, teams in current leagues, members,
// and the club's own upcoming tournaments.
import { rin } from './api';
import { levelFromName } from './rankedin';

export type ClubInfo = {
  id: number;
  name: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  federation: string | null;
  admins: { name: string; rankedinId: string | null }[];
  memberCount: number | null;
};

export async function getClub(id: number): Promise<ClubInfo> {
  const raw = await rin<{
    id: number;
    contact: {
      organisationName: string;
      address: string | null;
      city: string | null;
      phone: string | null;
      email: string | null;
      websiteLink: string | null;
      admins: { name: string; url: string }[] | null;
      parentFederation: { parentFederationName: string | null; hasParentFederation: boolean } | null;
    };
    statistics?: { memberPlayersTotal?: string };
  }>(`Organization/GetOrganizationInfoAsync?organisationId=${id}&language=sv`);
  const c = raw.contact;
  return {
    id: raw.id,
    name: c.organisationName,
    address: c.address,
    city: c.city,
    phone: c.phone,
    email: c.email,
    website: c.websiteLink,
    federation: c.parentFederation?.hasParentFederation ? c.parentFederation.parentFederationName : null,
    admins: (c.admins || []).map((a) => ({ name: a.name, rankedinId: a.url.match(/R\d{9}/)?.[0] ?? null })),
    memberCount: Number(raw.statistics?.memberPlayersTotal) || null,
  };
}

export type ClubLeague = {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  active: boolean;
  teams: { id: number; name: string; division: string | null }[];
};

export async function getClubLeagues(id: number): Promise<ClubLeague[]> {
  const raw = await rin<{
    payload: { id: number; name: string; startDate: string; endDate: string; teams: { id: number; name: string; division: string | null }[] }[];
  }>(`Organization/GetOrganisationTeamLeaguesAsync?OrganisationId=${id}&IsFinished=false&Language=sv&Skip=0&Take=50`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return (raw.payload || [])
    .map((l) => ({
      id: l.id,
      name: l.name.trim(),
      startDate: l.startDate,
      endDate: l.endDate,
      active: new Date(l.endDate) >= today,
      teams: (l.teams || []).map((t) => ({ id: t.id, name: t.name, division: t.division })),
    }))
    .filter((l) => !/^test\b/i.test(l.name))
    .sort((a, b) => Number(b.active) - Number(a.active) || b.startDate.localeCompare(a.startDate));
}

export type ClubMember = { id: number; name: string; rankedinId: string };

export async function getClubMembers(id: number): Promise<ClubMember[]> {
  const raw = await rin<{ participants: { playerId: number; playerRankedinId: string; playerFirstName: string; playerLastName: string }[] }[]>(
    `Organization/GetMembersAsync?id=${id}&language=sv`,
  );
  return (raw || [])
    .flatMap((g) => g.participants || [])
    .map((p) => ({ id: p.playerId, name: `${p.playerFirstName} ${p.playerLastName}`.trim(), rankedinId: p.playerRankedinId }));
}

export type ClubTournament = { id: number; name: string; startDate: string; level: string };

/** Rankedin can't list a club's tournaments by id, so search by the club's name and keep upcoming ones. */
export async function getClubTournaments(name: string): Promise<ClubTournament[]> {
  const raw = await rin<{ Url: string; Name: string; StartDate: string; Sport: string | null }[]>(
    `Search/GetTournamentsAsync?term=${encodeURIComponent(name)}&language=sv&take=30&skip=0`,
  );
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const iso = (d: string) => {
    const m = d.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
    return m ? `${m[3]}-${m[2]}-${m[1]}T${m[4] ?? '00'}:${m[5] ?? '00'}:00` : d;
  };
  return (raw || [])
    .filter((t) => !t.Sport || t.Sport === 'padel')
    .map((t) => ({ id: Number(t.Url.match(/tournament\/(\d+)/)?.[1]), name: t.Name.trim(), startDate: iso(t.StartDate), level: levelFromName(t.Name) }))
    .filter((t) => t.id > 0 && new Date(t.startDate) >= today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
}

// ---------- Admin (needs a logged-in Rankedin account) ----------

export type AdminOrg = { id: number; name: string; location: string | null; eventsCount: number; managerUrl: string | null };
export type AdminEvent = {
  id: number;
  name: string;
  startDate: string | null;
  state: string | number | null;
  link: string;
  adminLink: string | null;
};

export async function getAdminOrganisations(): Promise<AdminOrg[]> {
  const raw = await rin<{ payload: { id: number; name: string; location: string | null; eventsCount: number; managerUrl: string | null }[] }>(
    `Player/GetAdminOrganizationsAsync?Language=sv&Skip=0&Take=50`,
    { fresh: true },
  );
  return (raw.payload || []).map((o) => ({ id: o.id, name: o.name, location: o.location, eventsCount: o.eventsCount, managerUrl: o.managerUrl }));
}

export async function getAdminEvents(): Promise<AdminEvent[]> {
  const raw = await rin<{ payload: { id: number; name: string; startDate: string | null; state: string | number | null; link: string; adminLink: string | null }[] }>(
    `Player/GetAdminOrganizedEventsAsync?Language=sv&Skip=0&Take=100`,
    { fresh: true },
  );
  return (raw.payload || []).map((e) => ({ id: e.id, name: e.name.trim(), startDate: e.startDate, state: e.state, link: e.link, adminLink: e.adminLink }));
}
