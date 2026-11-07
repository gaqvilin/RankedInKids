// Per-device conveniences (saved players). Never critical state.
export type SavedPlayer = { rankedinId: string; name: string; id: number };

const KEY = 'padelkids.players.v1';

export function getSavedPlayers(): SavedPlayer[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SavedPlayer[]) : [];
  } catch {
    return [];
  }
}

export function savePlayer(p: SavedPlayer): SavedPlayer[] {
  const list = getSavedPlayers().filter((x) => x.rankedinId !== p.rankedinId);
  list.unshift(p);
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 10)));
  } catch {
    /* storage unavailable */
  }
  return list;
}

export function removePlayer(rankedinId: string): SavedPlayer[] {
  const list = getSavedPlayers().filter((x) => x.rankedinId !== rankedinId);
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable */
  }
  return list;
}

export function isSaved(rankedinId: string): boolean {
  return getSavedPlayers().some((p) => p.rankedinId === rankedinId);
}

// ---------- Saved teams (team leagues such as SPL / Klubbligan) ----------
export type SavedTeam = { id: number; name: string; league: string };

const TEAM_KEY = 'padelkids.teams.v1';

export function getSavedTeams(): SavedTeam[] {
  try {
    const raw = localStorage.getItem(TEAM_KEY);
    return raw ? (JSON.parse(raw) as SavedTeam[]) : [];
  } catch {
    return [];
  }
}

export function toggleTeam(t: SavedTeam): SavedTeam[] {
  const list = getSavedTeams();
  const next = list.some((x) => x.id === t.id) ? list.filter((x) => x.id !== t.id) : [t, ...list].slice(0, 10);
  try {
    localStorage.setItem(TEAM_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable */
  }
  return next;
}
